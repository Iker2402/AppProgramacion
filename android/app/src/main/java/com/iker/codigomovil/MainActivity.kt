package com.iker.codigomovil

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import java.io.ByteArrayInputStream
import java.io.FileNotFoundException
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * La app es una WebView que carga la interfaz (assets/www) desde
 * https://appassets.androidplatform.net/. Todo funciona sin internet:
 * los compiladores e interpretes son WebAssembly/JavaScript dentro del APK.
 *
 * Ademas responde a /__io/... para que los programas puedan leer del teclado
 * de forma bloqueante (scanf, input(), getch...) desde su Web Worker.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private val lines = LinkedBlockingQueue<String>()
    private val keys = LinkedBlockingQueue<Int>()
    @Volatile private var generation = 0
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingSave: String? = null

    companion object {
        private const val HOST = "appassets.androidplatform.net"
        private const val EOF = "\u0000EOF"
        private const val REQ_FILE = 1
        private const val REQ_SAVE = 2
        private val MIME = mapOf(
            "html" to "text/html", "js" to "text/javascript", "mjs" to "text/javascript",
            "css" to "text/css", "json" to "application/json", "wasm" to "application/wasm",
            "zip" to "application/zip", "tar" to "application/x-tar", "svg" to "image/svg+xml",
            "png" to "image/png", "h" to "text/plain", "c" to "text/plain", "txt" to "text/plain",
        )
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web = WebView(this)
        setContentView(web)

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            setSupportZoom(false)
            builtInZoomControls = false
            mediaPlaybackRequiresUserGesture = false
            textZoom = 100
        }
        web.addJavascriptInterface(Bridge(), "CodigoMovil")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val url = request.url
                if (url.host != HOST) return null
                return handle(url)
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == HOST) return false
                // Enlaces externos de la vista previa: se abren en el navegador.
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams,
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                return try {
                    startActivityForResult(Intent.createChooser(intent, "Importar archivos"), REQ_FILE)
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    false
                }
            }
        }
        if (savedInstanceState == null) web.loadUrl("https://$HOST/index.html")
        else web.restoreState(savedInstanceState)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    private fun handle(url: Uri): WebResourceResponse {
        val path = url.path ?: "/"
        return when (path) {
            "/__io/stdin" -> text(waitLine())
            "/__io/key" -> text(waitKey().toString())
            "/__io/kbhit" -> text(if (keys.isEmpty()) "0" else "1")
            "/__io/sleep" -> {
                val ms = url.getQueryParameter("ms")?.toLongOrNull() ?: 0L
                val gen = generation
                var left = ms.coerceIn(0, 3_600_000)
                while (left > 0 && gen == generation) {
                    val step = minOf(left, 100)
                    Thread.sleep(step)
                    left -= step
                }
                text("ok")
            }
            else -> asset(if (path == "/") "/index.html" else path)
        }
    }

    private fun waitLine(): String {
        val gen = generation
        while (gen == generation) {
            val l = lines.poll(200, TimeUnit.MILLISECONDS) ?: continue
            return l
        }
        return EOF
    }

    private fun waitKey(): Int {
        val gen = generation
        while (gen == generation) {
            val k = keys.poll(200, TimeUnit.MILLISECONDS) ?: continue
            return k
        }
        return -1
    }

    private fun text(s: String): WebResourceResponse {
        val r = WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(s.toByteArray(Charsets.UTF_8)))
        r.responseHeaders = mapOf("Cache-Control" to "no-store")
        return r
    }

    private fun asset(path: String): WebResourceResponse {
        val clean = path.trimStart('/')
        if (clean.contains("..")) return notFound()
        val ext = clean.substringAfterLast('.', "").lowercase()
        val mime = MIME[ext] ?: "application/octet-stream"
        return try {
            val stream = assets.open("www/$clean")
            val r = WebResourceResponse(mime, if (mime.startsWith("text/")) "utf-8" else null, stream)
            r.responseHeaders = mapOf("Cache-Control" to "no-cache", "Access-Control-Allow-Origin" to "*")
            r
        } catch (e: FileNotFoundException) {
            notFound()
        }
    }

    private fun notFound() =
        WebResourceResponse("text/plain", "utf-8", 404, "Not Found", mapOf(), ByteArrayInputStream(ByteArray(0)))

    inner class Bridge {
        @JavascriptInterface
        fun provideInput(text: String) { lines.offer(text) }

        @JavascriptInterface
        fun pushKey(code: Int) { keys.offer(code) }

        @JavascriptInterface
        fun resetIO() {
            lines.clear()
            keys.clear()
        }

        @JavascriptInterface
        fun cancelInput() {
            generation++
            lines.clear()
            keys.clear()
        }

        @JavascriptInterface
        fun saveFile(name: String, content: String) {
            runOnUiThread {
                pendingSave = content
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TITLE, name.substringAfterLast('/'))
                }
                try {
                    startActivityForResult(intent, REQ_SAVE)
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "No se puede exportar: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            REQ_FILE -> {
                val cb = fileCallback ?: return
                fileCallback = null
                if (resultCode != RESULT_OK || data == null) {
                    cb.onReceiveValue(null)
                    return
                }
                val uris = mutableListOf<Uri>()
                val clip = data.clipData
                if (clip != null) for (i in 0 until clip.itemCount) uris.add(clip.getItemAt(i).uri)
                else data.data?.let { uris.add(it) }
                cb.onReceiveValue(uris.toTypedArray())
            }
            REQ_SAVE -> {
                val content = pendingSave
                pendingSave = null
                val uri = data?.data
                if (resultCode == RESULT_OK && uri != null && content != null) {
                    try {
                        contentResolver.openOutputStream(uri)?.use { it.write(content.toByteArray(Charsets.UTF_8)) }
                        Toast.makeText(this, "Archivo exportado", Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        Toast.makeText(this, "Error al exportar: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("window.onAndroidBack ? window.onAndroidBack() : false") { r ->
            if (r != "true") {
                @Suppress("DEPRECATION")
                super.onBackPressed()
            }
        }
    }
}

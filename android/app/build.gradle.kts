plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.iker.codigomovil"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.iker.codigomovil"
        minSdk = 26
        targetSdk = 35
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        versionName = "0.1.0"
    }

    // Si existen los secretos del repositorio (ver README) se firma con una clave
    // propia; si no, con la clave de depuracion (suficiente para instalar a mano).
    val storePath = System.getenv("SIGNING_STORE_FILE")
    val hasReleaseKey = storePath != null && file(storePath).exists()
    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                storeFile = file(storePath!!)
                storePassword = System.getenv("SIGNING_STORE_PASSWORD")
                keyAlias = System.getenv("SIGNING_KEY_ALIAS")
                keyPassword = System.getenv("SIGNING_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName(if (hasReleaseKey) "release" else "debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

// Los assets web se generan con `npm run build` en la carpeta web/.
val checkWebAssets by tasks.registering {
    doLast {
        val index = file("src/main/assets/www/index.html")
        if (!index.exists()) {
            throw GradleException("Faltan los assets web. Ejecuta: cd web && npm ci && npm run build")
        }
    }
}
tasks.named("preBuild") { dependsOn(checkWebAssets) }

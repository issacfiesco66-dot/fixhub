import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // El plugin de Flutter debe aplicarse después de los plugins de Android y Kotlin.
    id("dev.flutter.flutter-gradle-plugin")
}

// Credenciales del Wearables Developer Center de Meta (android/local.properties):
//   mwdat_application_id=...   mwdat_client_token=...
// En Developer Mode (pruebas con tus propias gafas) basta con "0" en ambas.
val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
val mwdatApplicationId: String = localProperties.getProperty("mwdat_application_id", "0")
val mwdatClientToken: String = localProperties.getProperty("mwdat_client_token", "0")

android {
    namespace = "app.faro.faro_app"
    // El SDK de gafas Meta (mwdat 1.0.1) se compila contra API 36.
    compileSdk = maxOf(flutter.compileSdkVersion, 36)
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "app.faro.faro_app"
        // minSdk 29 (Android 10): mínimo declarado por los AAR mwdat-core/mwdat-camera 1.0.1.
        minSdk = 29
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["mwdat_application_id"] = mwdatApplicationId
        manifestPlaceholders["mwdat_client_token"] = mwdatClientToken
    }

    buildTypes {
        release {
            // TODO(lanzamiento): firma de producción (android/key.properties).
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Meta Wearables Device Access Toolkit (Maven Central, sin token de acceso).
    implementation("com.meta.wearable:mwdat-core:1.0.1")
    implementation("com.meta.wearable:mwdat-camera:1.0.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("androidx.activity:activity-ktx:1.10.1")
}

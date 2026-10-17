package app.faro.faro_app

import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine

// FlutterFragmentActivity (y no FlutterActivity) porque el SDK de gafas Meta usa la
// Activity Result API para pedir el permiso de cámara a través de la app Meta AI.
class MainActivity : FlutterFragmentActivity() {
    // Se crea como propiedad para que su launcher de permisos quede registrado antes de onStart().
    private val glasses = GlassesBridge(this)

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        glasses.register(flutterEngine.dartExecutor.binaryMessenger)
    }

    override fun onDestroy() {
        glasses.dispose()
        super.onDestroy()
    }
}

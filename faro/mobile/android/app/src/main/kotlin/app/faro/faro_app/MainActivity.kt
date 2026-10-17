package app.faro.faro_app

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    private var glasses: GlassesBridge? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        glasses = GlassesBridge(this).also { it.register(flutterEngine.dartExecutor.binaryMessenger) }
    }

    override fun onDestroy() {
        glasses?.dispose()
        super.onDestroy()
    }
}

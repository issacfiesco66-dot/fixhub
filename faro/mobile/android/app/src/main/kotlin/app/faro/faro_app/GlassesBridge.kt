package app.faro.faro_app

import android.content.Context
import android.os.Handler
import android.os.Looper
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

/**
 * Puente Flutter <-> gafas Meta (Ray-Ban Meta / Oakley Meta).
 *
 * Canales:
 *   MethodChannel "faro/glasses":        isAvailable | connect | startStream(maxWidth) | stopStream
 *   EventChannel  "faro/glasses/frames": emite cada fotograma como JPEG (ByteArray)
 *
 * Integración real: Meta Wearables Device Access Toolkit (DAT), artefactos en Maven Central
 *   implementation("com.meta.wearable:mwdat-core:1.0.1")
 *   implementation("com.meta.wearable:mwdat-camera:1.0.1")
 * y el APPLICATION_ID del Wearables Developer Center en el AndroidManifest.
 * El flujo del SDK es: registrar la app con la app Meta AI -> pedir permiso de dispositivo ->
 * abrir una sesión de cámara -> recibir fotogramas de vídeo -> comprimirlos a JPEG y emitirlos.
 * Mientras no haya gafas emparejadas, isAvailable() devuelve false y la app usa la cámara del
 * teléfono (ver lib/services/frame_source.dart).
 */
class GlassesBridge(private val context: Context) : EventChannel.StreamHandler {
    private var events: EventChannel.EventSink? = null
    private val main = Handler(Looper.getMainLooper())
    private var streaming = false

    fun register(messenger: BinaryMessenger) {
        MethodChannel(messenger, "faro/glasses").setMethodCallHandler { call, result ->
            when (call.method) {
                "isAvailable" -> result.success(isGlassesPaired())
                "connect" -> {
                    // TODO(DAT): Wearables.registerApp(context) + solicitar permiso de cámara en las gafas.
                    result.success(null)
                }
                "startStream" -> {
                    val maxWidth = call.argument<Int>("maxWidth") ?: 640
                    startStream(maxWidth)
                    result.success(null)
                }
                "stopStream" -> {
                    stopStream()
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
        EventChannel(messenger, "faro/glasses/frames").setStreamHandler(this)
    }

    private fun isGlassesPaired(): Boolean {
        // TODO(DAT): consultar al SDK si hay un dispositivo Meta conectado.
        return false
    }

    private fun startStream(maxWidth: Int) {
        if (streaming) return
        streaming = true
        // TODO(DAT): abrir CameraStream del SDK, suscribirse a los fotogramas, convertir cada uno
        // a JPEG (YuvImage.compressToJpeg / Bitmap.compress) reescalado a `maxWidth` y llamar a
        // emitFrame(jpegBytes). Limitar a ~3 fps para ahorrar batería de las gafas.
    }

    private fun stopStream() {
        streaming = false
        // TODO(DAT): cerrar la sesión de cámara.
    }

    /** Llamar desde el callback de fotogramas del SDK (cualquier hilo). */
    fun emitFrame(jpeg: ByteArray) {
        main.post { events?.success(jpeg) }
    }

    override fun onListen(arguments: Any?, sink: EventChannel.EventSink?) {
        events = sink
    }

    override fun onCancel(arguments: Any?) {
        events = null
    }

    fun dispose() {
        stopStream()
        events = null
    }
}

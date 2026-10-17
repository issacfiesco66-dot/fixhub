package app.faro.faro_app

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.meta.wearable.dat.camera.Camera
import com.meta.wearable.dat.camera.addCamera
import com.meta.wearable.dat.camera.types.StreamConfiguration
import com.meta.wearable.dat.camera.types.VideoFrame
import com.meta.wearable.dat.camera.types.VideoQuality
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.selectors.AutoDeviceSelector
import com.meta.wearable.dat.core.session.DeviceSession
import com.meta.wearable.dat.core.session.DeviceSessionState
import com.meta.wearable.dat.core.types.Permission
import com.meta.wearable.dat.core.types.PermissionStatus
import com.meta.wearable.dat.core.types.RegistrationState
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import java.io.ByteArrayOutputStream
import kotlin.coroutines.resume
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Puente Flutter <-> gafas Meta (Ray-Ban Meta / Oakley Meta) con el
 * Meta Wearables Device Access Toolkit 1.0.1 (com.meta.wearable:mwdat-core / mwdat-camera).
 *
 * Canales:
 *   MethodChannel "faro/glasses":        isAvailable | connect | startStream(maxWidth) | stopStream
 *   EventChannel  "faro/glasses/frames": fotogramas JPEG (ByteArray), ~3 por segundo
 *
 * Flujo: Wearables.initialize -> startRegistration (abre Meta AI) -> permiso CAMERA (Meta AI)
 *        -> createSession -> STARTED -> addCamera(LOW, 7 fps) -> videoStream -> JPEG -> Flutter.
 * En Developer Mode (app Meta AI > Ajustes > Tus gafas) los placeholders del manifiesto pueden ser "0".
 */
class GlassesBridge(private val activity: FragmentActivity) : EventChannel.StreamHandler {
    companion object {
        private const val TAG = "FaroGlasses"
        private const val EMIT_INTERVAL_MS = 330L
        private const val REGISTRATION_TIMEOUT_MS = 180_000L

        /**
         * Disposición del búfer YUV 4:2:0 que entrega el SDK (VideoFrame.buffer):
         * "NV21" (Y + VU intercalado), "NV12" (Y + UV intercalado) o "I420" (Y + U + V planos).
         * Si los colores del vídeo se ven invertidos o con franjas, cambia este valor.
         */
        private const val YUV_LAYOUT = "NV21"
    }

    private val main = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var events: EventChannel.EventSink? = null
    private var initialized = false
    private var session: DeviceSession? = null
    private var camera: Camera? = null
    private val streamJobs = mutableListOf<Job>()
    private var lastEmitMs = 0L
    private var pendingPermission: ((PermissionStatus?) -> Unit)? = null

    // Registrado al construir la Activity (antes de STARTED), como exige la Activity Result API.
    private val permissionLauncher: ActivityResultLauncher<Permission> =
        activity.registerForActivityResult(Wearables.RequestPermissionContract()) { result ->
            val status = result.getOrNull()
            pendingPermission?.invoke(status)
            pendingPermission = null
        }

    fun register(messenger: BinaryMessenger) {
        MethodChannel(messenger, "faro/glasses").setMethodCallHandler { call, result ->
            when (call.method) {
                "isAvailable" -> result.success(isAvailable())
                "connect" -> connect(result)
                "startStream" -> startStream(result)
                "stopStream" -> {
                    stopStream()
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
        EventChannel(messenger, "faro/glasses/frames").setStreamHandler(this)
    }

    // ------------------------------------------------------------------ inicialización

    private fun hasBluetoothPermission(): Boolean =
        ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT) ==
            PackageManager.PERMISSION_GRANTED

    private fun ensureInitialized(): Boolean {
        if (initialized) return true
        if (!hasBluetoothPermission()) {
            Log.w(TAG, "Falta el permiso BLUETOOTH_CONNECT; el SDK de Meta no se inicializa todavía")
            return false
        }
        var ok = true
        Wearables.initialize(activity.applicationContext).onFailure { error, _ ->
            ok = false
            Log.e(TAG, "No se pudo inicializar el SDK de Meta: ${error.description}")
        }
        initialized = ok
        return ok
    }

    /** true si la app ya está registrada en Meta AI y hay gafas vinculadas. */
    private fun isAvailable(): Boolean {
        if (!ensureInitialized()) return false
        return Wearables.registrationState.value == RegistrationState.REGISTERED &&
            Wearables.devices.value.isNotEmpty()
    }

    // ------------------------------------------------------------------ registro + permiso

    private fun connect(result: MethodChannel.Result) {
        if (!ensureInitialized()) {
            result.error("init_failed", "No se pudo iniciar el SDK de Meta (revisa el permiso de Bluetooth)", null)
            return
        }
        scope.launch {
            try {
                if (Wearables.registrationState.value != RegistrationState.REGISTERED) {
                    Wearables.startRegistration(activity) // abre la app Meta AI
                    val registered = withTimeoutOrNull(REGISTRATION_TIMEOUT_MS) {
                        Wearables.registrationState.first { it == RegistrationState.REGISTERED }
                    }
                    if (registered == null) {
                        result.error("registration_unavailable", "Meta AI no completó el registro", null)
                        return@launch
                    }
                }
                val status = Wearables.checkPermissionStatus(Permission.CAMERA).getOrNull()
                if (status != PermissionStatus.Granted && !requestCameraPermission()) {
                    result.error("permission_denied", "Permiso de cámara de las gafas denegado", null)
                    return@launch
                }
                result.success(true)
            } catch (t: Throwable) {
                Log.e(TAG, "connect falló", t)
                result.error("connect_failed", t.message ?: "error desconocido", null)
            }
        }
    }

    private suspend fun requestCameraPermission(): Boolean = suspendCancellableCoroutine { cont ->
        pendingPermission = { status ->
            if (cont.isActive) cont.resume(status == PermissionStatus.Granted)
        }
        permissionLauncher.launch(Permission.CAMERA)
    }

    // ------------------------------------------------------------------ sesión + stream

    private fun startStream(result: MethodChannel.Result) {
        if (!ensureInitialized()) {
            result.error("init_failed", "SDK de Meta no inicializado", null)
            return
        }
        if (session != null) {
            result.success(null)
            return
        }
        Wearables.createSession(AutoDeviceSelector()).fold(
            onSuccess = { newSession ->
                session = newSession
                // Suscribirse antes de start() para no perder la primera transición.
                streamJobs += scope.launch {
                    newSession.errors.collect { error -> Log.w(TAG, "Sesión: ${error.description}") }
                }
                streamJobs += scope.launch {
                    newSession.state.collect { state ->
                        when (state) {
                            DeviceSessionState.STARTED -> if (camera == null) attachCamera(newSession)
                            DeviceSessionState.STOPPED -> Log.i(TAG, "Sesión con las gafas detenida")
                            else -> Unit
                        }
                    }
                }
                newSession.start() // fire-and-forget; los fallos llegan por newSession.errors
                result.success(null)
            },
            onFailure = { error, _ -> result.error("stream_failed", error.description, null) },
        )
    }

    private fun attachCamera(deviceSession: DeviceSession) {
        // Baja resolución (360x640) y 7 fps: de sobra para analizar 2-3 fotogramas por segundo
        // y mucho más amable con la batería de las gafas y el ancho de banda Bluetooth.
        deviceSession.addCamera(StreamConfiguration(videoQuality = VideoQuality.LOW, frameRate = 7)).fold(
            onSuccess = { cam ->
                camera = cam
                streamJobs += scope.launch {
                    cam.stream.errorStream.collect { error -> Log.w(TAG, "Stream: ${error.description}") }
                }
                streamJobs += scope.launch(Dispatchers.Default) {
                    cam.stream.videoStream.collect { frame -> handleFrame(frame) }
                }
                cam.stream.start().onFailure { error, _ ->
                    Log.e(TAG, "No se pudo iniciar el stream: ${error.description}")
                }
            },
            onFailure = { error, _ -> Log.e(TAG, "addCamera falló: ${error.description}") },
        )
    }

    private fun handleFrame(frame: VideoFrame) {
        val now = System.currentTimeMillis()
        if (frame.isCompressed || now - lastEmitMs < EMIT_INTERVAL_MS) return
        lastEmitMs = now
        val jpeg = yuvToJpeg(frame) ?: return
        emitFrame(jpeg)
    }

    private fun yuvToJpeg(frame: VideoFrame): ByteArray? {
        val w = frame.width
        val h = frame.height
        if (w <= 0 || h <= 0) return null
        val buffer = frame.buffer.duplicate() // no alterar la posición del búfer del SDK
        val expected = w * h * 3 / 2
        if (buffer.remaining() < expected) return null
        val bytes = ByteArray(expected)
        buffer.get(bytes)
        val nv21 = when (YUV_LAYOUT) {
            "I420" -> i420ToNv21(bytes, w, h)
            "NV12" -> nv12ToNv21(bytes, w, h)
            else -> bytes
        }
        val out = ByteArrayOutputStream()
        val ok = YuvImage(nv21, ImageFormat.NV21, w, h, null).compressToJpeg(Rect(0, 0, w, h), 60, out)
        return if (ok) out.toByteArray() else null
    }

    private fun i420ToNv21(src: ByteArray, w: Int, h: Int): ByteArray {
        val ySize = w * h
        val uvSize = ySize / 4
        val dst = ByteArray(src.size)
        System.arraycopy(src, 0, dst, 0, ySize)
        var o = ySize
        for (i in 0 until uvSize) {
            dst[o++] = src[ySize + uvSize + i] // V
            dst[o++] = src[ySize + i] // U
        }
        return dst
    }

    private fun nv12ToNv21(src: ByteArray, w: Int, h: Int): ByteArray {
        val ySize = w * h
        val dst = src.copyOf()
        var i = ySize
        while (i + 1 < src.size) {
            dst[i] = src[i + 1]
            dst[i + 1] = src[i]
            i += 2
        }
        return dst
    }

    private fun stopStream() {
        streamJobs.forEach { it.cancel() }
        streamJobs.clear()
        camera?.stop()
        camera = null
        session?.stop()
        session = null
    }

    /** Entrega un JPEG a Flutter (se puede llamar desde cualquier hilo). */
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
        scope.cancel()
        events = null
    }
}

import Flutter
import Foundation

/// Puente Flutter <-> gafas Meta en iOS.
///
/// Integración real: Meta Wearables Device Access Toolkit (Swift Package
/// https://github.com/facebook/meta-wearables-dat-ios). El SDK registra la app con la app
/// Meta AI, pide permiso de dispositivo, abre una sesión de cámara y entrega fotogramas de vídeo;
/// aquí se comprimen a JPEG y se emiten por el EventChannel "faro/glasses/frames".
/// Mientras no haya gafas emparejadas, `isAvailable` devuelve false y la app usa la cámara del
/// iPhone (ver lib/services/frame_source.dart).
final class GlassesBridge: NSObject, FlutterStreamHandler {
  private var sink: FlutterEventSink?
  private var streaming = false

  init(messenger: FlutterBinaryMessenger) {
    super.init()
    let method = FlutterMethodChannel(name: "faro/glasses", binaryMessenger: messenger)
    method.setMethodCallHandler { [weak self] call, result in
      guard let self = self else { return }
      switch call.method {
      case "isAvailable":
        // TODO(DAT): consultar al SDK si hay unas gafas Meta conectadas.
        result(false)
      case "connect":
        // TODO(DAT): registrar la app y solicitar permiso de cámara en las gafas.
        result(nil)
      case "startStream":
        let args = call.arguments as? [String: Any]
        let maxWidth = args?["maxWidth"] as? Int ?? 640
        self.startStream(maxWidth: maxWidth)
        result(nil)
      case "stopStream":
        self.stopStream()
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    FlutterEventChannel(name: "faro/glasses/frames", binaryMessenger: messenger)
      .setStreamHandler(self)
  }

  private func startStream(maxWidth: Int) {
    guard !streaming else { return }
    streaming = true
    // TODO(DAT): abrir el stream de cámara del SDK; por cada CVPixelBuffer/UIImage generar JPEG
    // (UIImage.jpegData(compressionQuality: 0.6)) reescalado a maxWidth y llamar a emit(jpeg).
  }

  private func stopStream() {
    streaming = false
    // TODO(DAT): cerrar la sesión de cámara.
  }

  /// Llamar desde el callback de fotogramas del SDK.
  func emit(_ jpeg: Data) {
    DispatchQueue.main.async { [weak self] in
      self?.sink?(FlutterStandardTypedData(bytes: jpeg))
    }
  }

  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    sink = events
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    sink = nil
    return nil
  }
}

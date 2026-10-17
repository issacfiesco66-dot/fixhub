import Flutter
import Foundation
import UIKit

#if canImport(MWDATCore) && canImport(MWDATCamera)
import MWDATCamera
import MWDATCore
#endif

/// Puente Flutter <-> gafas Meta (Ray-Ban Meta / Oakley Meta) con el
/// Meta Wearables Device Access Toolkit (Swift Package https://github.com/facebook/meta-wearables-dat-ios).
///
/// Canales:
///   MethodChannel "faro/glasses":        isAvailable | connect | startStream(maxWidth) | stopStream
///   EventChannel  "faro/glasses/frames": fotogramas JPEG (FlutterStandardTypedData)
///
/// El código del SDK está dentro de `#if canImport(...)`: la app compila aunque todavía no hayas
/// añadido el paquete en Xcode; en ese caso `isAvailable` devuelve false y Faro usa la cámara del iPhone.
final class GlassesBridge: NSObject, FlutterStreamHandler {
  private var sink: FlutterEventSink?
  private var maxWidth = 640
  private var lastEmit = Date.distantPast

  #if canImport(MWDATCore) && canImport(MWDATCamera)
  private var session: DeviceSession?
  private var camera: Camera?
  private let tokens = ListenerTokenBag()
  #endif

  /// Llamar una vez al arrancar la app (AppDelegate).
  static func configureSDK() {
    #if canImport(MWDATCore)
    do {
      try Wearables.configure()
    } catch {
      NSLog("[Faro] No se pudo configurar el SDK de Meta: \(error)")
    }
    #endif
  }

  init(messenger: FlutterBinaryMessenger) {
    super.init()
    let method = FlutterMethodChannel(name: "faro/glasses", binaryMessenger: messenger)
    method.setMethodCallHandler { [weak self] call, result in
      guard let self = self else { return }
      switch call.method {
      case "isAvailable":
        self.isAvailable(result)
      case "connect":
        self.connect(result)
      case "startStream":
        let args = call.arguments as? [String: Any]
        self.maxWidth = args?["maxWidth"] as? Int ?? 640
        self.startStream(result)
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

  /// Reenvía al SDK las URLs de retorno de Meta AI (faro://...?metaWearablesAction=...).
  @discardableResult
  func handle(url: URL) -> Bool {
    #if canImport(MWDATCore)
    guard
      let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
      components.queryItems?.contains(where: { $0.name == "metaWearablesAction" }) == true
    else {
      return false
    }
    Task { @MainActor in
      do {
        _ = try await Wearables.shared.handleUrl(url)
      } catch {
        NSLog("[Faro] handleUrl falló: \(error)")
      }
    }
    return true
    #else
    return false
    #endif
  }

  // MARK: - Métodos

  private func isAvailable(_ result: @escaping FlutterResult) {
    #if canImport(MWDATCore)
    Task { @MainActor in
      let wearables = Wearables.shared
      result(wearables.registrationState == .registered && !wearables.devices.isEmpty)
    }
    #else
    result(false)
    #endif
  }

  /// Registro con Meta AI (abre la app Meta AI) y permiso de cámara en las gafas.
  private func connect(_ result: @escaping FlutterResult) {
    #if canImport(MWDATCore)
    Task { @MainActor in
      let wearables = Wearables.shared
      do {
        if wearables.registrationState != .registered {
          try await wearables.startRegistration()
          for await state in wearables.registrationStateStream() {
            if state == .registered { break }
            if state == .unavailable {
              result(FlutterError(code: "registration_unavailable",
                                  message: "Meta AI no permitió el registro", details: nil))
              return
            }
          }
        }
        if try await wearables.checkPermissionStatus(.camera) != .granted {
          guard try await wearables.requestPermission(.camera) == .granted else {
            result(FlutterError(code: "permission_denied",
                                message: "Permiso de cámara de las gafas denegado", details: nil))
            return
          }
        }
        result(true)
      } catch {
        result(FlutterError(code: "connect_failed", message: "\(error)", details: nil))
      }
    }
    #else
    result(FlutterError(code: "sdk_missing",
                        message: "Añade el paquete MWDAT (meta-wearables-dat-ios) en Xcode", details: nil))
    #endif
  }

  private func startStream(_ result: @escaping FlutterResult) {
    #if canImport(MWDATCore) && canImport(MWDATCamera)
    Task { @MainActor in
      do {
        let wearables = Wearables.shared
        let session = try wearables.createSession(
          deviceSelector: AutoDeviceSelector(wearables: wearables))
        self.session = session
        Task { @MainActor in
          for await state in session.stateStream() {
            if state == .started {
              self.attachCamera(to: session)
              break
            }
            if state == .stopped { break }
          }
        }
        try session.start()
        result(nil)
      } catch {
        result(FlutterError(code: "stream_failed", message: "\(error)", details: nil))
      }
    }
    #else
    result(FlutterError(code: "sdk_missing", message: "SDK de Meta no incluido", details: nil))
    #endif
  }

  #if canImport(MWDATCore) && canImport(MWDATCamera)
  @MainActor
  private func attachCamera(to session: DeviceSession) {
    do {
      // Resolución baja y 7 fps: suficiente para analizar 2-3 fotogramas por segundo
      // y mucho más amable con la batería de las gafas y el Bluetooth.
      let config = StreamConfiguration(videoCodec: .raw, resolution: .low, frameRate: 7)
      guard let camera = try session.addCamera(config: config) else { return }
      self.camera = camera
      camera.stream.videoFramePublisher.listen { [weak self] frame in
        self?.emit(frame: frame)
      }.store(in: tokens)
      camera.stream.errorPublisher.listen { error in
        NSLog("[Faro] error de stream de las gafas: \(error.localizedDescription)")
      }.store(in: tokens)
      camera.stream.start()
    } catch {
      NSLog("[Faro] addCamera falló: \(error)")
    }
  }

  private func emit(frame: VideoFrame) {
    let now = Date()
    guard now.timeIntervalSince(lastEmit) >= 0.33 else { return }  // ~3 fps hacia Flutter
    lastEmit = now
    guard let image = frame.makeUIImage() else { return }
    let maxWidth = CGFloat(self.maxWidth)
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      let scaled = image.size.width > maxWidth ? image.faroResized(toWidth: maxWidth) : image
      guard let data = scaled.jpegData(compressionQuality: 0.6) else { return }
      DispatchQueue.main.async {
        self?.sink?(FlutterStandardTypedData(bytes: data))
      }
    }
  }
  #endif

  private func stopStream() {
    #if canImport(MWDATCore) && canImport(MWDATCamera)
    tokens.clear()
    camera?.stop()
    camera = nil
    session?.stop()
    session = nil
    #endif
  }

  // MARK: - FlutterStreamHandler

  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    sink = events
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    sink = nil
    return nil
  }
}

private extension UIImage {
  func faroResized(toWidth width: CGFloat) -> UIImage {
    let scale = width / size.width
    let newSize = CGSize(width: width, height: size.height * scale)
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    return UIGraphicsImageRenderer(size: newSize, format: format).image { _ in
      draw(in: CGRect(origin: .zero, size: newSize))
    }
  }
}

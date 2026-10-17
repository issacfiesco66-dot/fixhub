import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  private var glasses: GlassesBridge?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GlassesBridge.configureSDK()
    GeneratedPluginRegistrant.register(with: self)
    if let controller = window?.rootViewController as? FlutterViewController {
      glasses = GlassesBridge(messenger: controller.binaryMessenger)
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  /// Retornos por URL: Meta AI (registro/permisos de las gafas) y OAuth de Uber.
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if glasses?.handle(url: url) == true {
      return true
    }
    return super.application(app, open: url, options: options)
  }
}

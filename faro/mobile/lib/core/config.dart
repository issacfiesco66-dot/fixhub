/// Configuración en tiempo de compilación (`flutter run --dart-define=...`).
class AppConfig {
  AppConfig._();

  /// URL del backend. En el emulador Android `10.0.2.2` apunta al host.
  static const String backendBaseUrl = String.fromEnvironment(
    'FARO_BACKEND_URL',
    defaultValue: 'http://10.0.2.2:8000',
  );

  /// Secreto compartido (cabecera X-API-Key). Vacío en desarrollo.
  static const String apiKey = String.fromEnvironment('FARO_API_KEY', defaultValue: '');

  /// Intervalo mínimo entre fotogramas enviados al backend.
  static const int frameIntervalMs =
      int.fromEnvironment('FARO_FRAME_INTERVAL_MS', defaultValue: 400);

  /// Ancho máximo del fotograma enviado (se reescala en el teléfono).
  static const int frameMaxWidth = int.fromEnvironment('FARO_FRAME_WIDTH', defaultValue: 640);

  /// Idioma de voz (TTS y STT).
  static const String language = 'es';
  static const String ttsLocale = 'es-MX';

  /// Duración máxima de una grabación de comando (modo lector de pantalla).
  static const Duration maxRecording = Duration(seconds: 7);

  static String get wsBaseUrl => backendBaseUrl.replaceFirst(RegExp(r'^http'), 'ws');
}

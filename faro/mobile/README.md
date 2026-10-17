# Faro · app móvil (Flutter)

Pantalla negra, controlada por gestos y voz, compatible con TalkBack y VoiceOver. Captura vídeo (gafas Meta o cámara del teléfono), GPS y brújula, graba comandos y reproduce las alertas con el TTS del sistema.

## Preparar el proyecto
Este directorio contiene `lib/`, `test/`, `pubspec.yaml` y los archivos nativos clave (manifiesto Android, `Info.plist`, puente de gafas en Kotlin/Swift). Genera el resto de la plantilla de plataforma **sin sobrescribir** lo existente:

```bash
flutter create . --org app.faro --project-name faro_app --platforms=android,ios
flutter pub get
```

`android/app/build.gradle.kts`, el manifiesto, `Info.plist`, `AppDelegate.swift` y los puentes nativos ya vienen en el repo y `flutter create` los respeta. En iOS sube el *deployment target* a 17.2 (`Podfile`: `platform :ios, '17.2'`) y añade el paquete Swift de Meta (ver más abajo).

## Ejecutar
```bash
flutter run --dart-define=FARO_BACKEND_URL=http://192.168.1.20:8000 --dart-define=FARO_API_KEY=
flutter analyze && flutter test
```
Variables (`--dart-define`): `FARO_BACKEND_URL`, `FARO_API_KEY`, `FARO_FRAME_INTERVAL_MS` (400), `FARO_FRAME_WIDTH` (640).

## Gafas Meta
La integración con el **Meta Wearables Device Access Toolkit 1.0.1** ya está implementada (registro con Meta AI, permiso de cámara y streaming) en `android/app/src/main/kotlin/app/faro/faro_app/GlassesBridge.kt` e `ios/Runner/GlassesBridge.swift`. `lib/services/frame_source.dart` usa las gafas cuando la app ya está registrada y hay gafas vinculadas; si no, la cámara del teléfono. El usuario vincula las gafas diciendo **"conecta las gafas"** o con la acción "Conectar gafas Meta" del lector de pantalla.

* **Android**: `android/app/build.gradle.kts` (incluido) añade `com.meta.wearable:mwdat-core/mwdat-camera` y lee `mwdat_application_id` / `mwdat_client_token` de `android/local.properties` (por defecto "0" = Developer Mode). El SDK está compilado con Kotlin 2.2: en `android/settings.gradle.kts` usa `org.jetbrains.kotlin.android` **2.2.x** y AGP **8.11+**.
* **iOS**: añade el paquete `https://github.com/facebook/meta-wearables-dat-ios` (productos `MWDATCore` y `MWDATCamera`) en Xcode y sube el *deployment target* a **iOS 17.2** (`Podfile`: `platform :ios, '17.2'`). El código está protegido con `#if canImport(MWDATCore)`, así que compila también sin el paquete.
* El audio de las gafas llega como auriculares Bluetooth normales: el TTS y la grabación ya salen/entran por ahí.
* Guía completa (Developer Mode vs. publicación, Developer Center, errores típicos): `docs/META_GLASSES.md`.

## Estructura
```
lib/
├── main.dart · app.dart
├── core/config.dart           # dart-defines
├── core/protocol.dart         # mensajes app <-> backend
├── services/
│   ├── backend_session.dart   # REST + WebSocket con reconexión
│   ├── frame_source.dart      # gafas (puente nativo) o cámara; YUV/BGRA -> JPEG en un isolate
│   ├── speech_output.dart     # TTS con cola de prioridades e interrupción
│   ├── location_service.dart  # GPS + brújula
│   ├── voice_input.dart       # push-to-talk (AAC 16 kHz)
│   └── haptics.dart
└── features/home/
    ├── home_controller.dart   # orquestación y acciones
    └── home_screen.dart       # gestos + Semantics/CustomSemanticsAction
```

## Pruebas de accesibilidad
Sigue la lista de `docs/ACCESSIBILITY.md`. Atajo: Android → Ajustes → Accesibilidad → TalkBack; iOS → triple clic lateral con VoiceOver configurado.

# Faro · app móvil (Flutter)

Pantalla negra, controlada por gestos y voz, compatible con TalkBack y VoiceOver. Captura vídeo (gafas Meta o cámara del teléfono), GPS y brújula, graba comandos y reproduce las alertas con el TTS del sistema.

## Preparar el proyecto
Este directorio contiene `lib/`, `test/`, `pubspec.yaml` y los archivos nativos clave (manifiesto Android, `Info.plist`, puente de gafas en Kotlin/Swift). Genera el resto de la plantilla de plataforma **sin sobrescribir** lo existente:

```bash
flutter create . --org app.faro --project-name faro_app --platforms=android,ios
flutter pub get
```

Luego, en `android/app/build.gradle(.kts)` añade dentro de `defaultConfig`:

```kotlin
manifestPlaceholders["metaWearablesAppId"] = "TU_APPLICATION_ID_DE_META"  // o "" mientras no lo tengas
minSdk = 24
```

Y en iOS: `Podfile` con `platform :ios, '14.0'`.

## Ejecutar
```bash
flutter run --dart-define=FARO_BACKEND_URL=http://192.168.1.20:8000 --dart-define=FARO_API_KEY=
flutter analyze && flutter test
```
Variables (`--dart-define`): `FARO_BACKEND_URL`, `FARO_API_KEY`, `FARO_FRAME_INTERVAL_MS` (400), `FARO_FRAME_WIDTH` (640).

## Gafas Meta
`lib/services/frame_source.dart` elige `GlassesFrameSource` si el puente nativo (`faro/glasses`) responde `isAvailable=true`; si no, usa la cámara del teléfono. Los puntos de integración del **Meta Wearables Device Access Toolkit** están marcados con `TODO(DAT)` en `android/app/src/main/kotlin/app/faro/faro_app/GlassesBridge.kt` e `ios/Runner/GlassesBridge.swift`:

* Android: `com.meta.wearable:mwdat-core` y `mwdat-camera` (Maven Central) + `com.meta.wearable.mwdat.APPLICATION_ID` en el manifiesto (ya incluido como placeholder).
* iOS: Swift Package `https://github.com/facebook/meta-wearables-dat-ios` + diccionario `MWDAT` en `Info.plist` (ya incluido).
* El audio de las gafas llega como auriculares Bluetooth normales: el TTS y la grabación ya salen/entran por ahí sin código adicional.

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

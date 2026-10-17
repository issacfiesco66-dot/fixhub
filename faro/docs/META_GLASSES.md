# Gafas Meta (Ray-Ban Meta / Oakley Meta): qué hay que hacer "en Facebook"

Resumen en una frase: **para probar con tus propias gafas no necesitas registrar nada en Meta**; basta con activar el *Modo desarrollador* en la app Meta AI. El registro en el **Wearables Developer Center** (desarrolladores de Meta/Facebook) solo hace falta para publicar la app a otros usuarios.

La integración está hecha en `mobile/android/.../GlassesBridge.kt` e `ios/Runner/GlassesBridge.swift` con el SDK oficial **Meta Wearables Device Access Toolkit (DAT) 1.0.1**: registro con Meta AI, permiso de cámara en las gafas y streaming de vídeo a 7 fps en baja resolución (se reenvían ~3 fps al backend como JPEG).

## Vía A — Probar hoy con tus gafas (Developer Mode)

1. En el teléfono: instala la app **Meta AI** y vincula las gafas con normalidad.
2. En Meta AI: **Ajustes → Tus gafas → Modo desarrollador** (Developer Mode) → activar. Es por dispositivo y puede desactivarse tras una actualización de firmware; si un día las gafas "no aparecen", revisa esto primero.
3. Compila Faro con las credenciales en "0" (es el valor por defecto):
   * Android: `android/local.properties` sin `mwdat_*` (o `mwdat_application_id=0`, `mwdat_client_token=0`).
   * iOS: deja `$(META_APP_ID)` y `$(CLIENT_TOKEN)` sin definir en Xcode; el SDK lo interpreta como "sin app ID" y omite la atestación.
4. Abre Faro y di **"conecta las gafas"** (o usa la acción "Conectar gafas Meta" del lector de pantalla). Faro abre Meta AI, apruebas la conexión, vuelves a Faro, Meta AI pide el permiso de cámara de las gafas ("permitir siempre") y el vídeo empieza a llegar al backend.
5. Requisitos técnicos: Android 10+ (minSdk 29) o iOS 17.2+, Bluetooth activo, Meta AI instalada e inicio de sesión hecho.

Si no tienes las gafas a mano, el SDK incluye **MockDeviceKit** (dispositivo simulado) — ver `samples/CameraAccess` en los repos oficiales.

## Vía B — Publicar a otros usuarios (Wearables Developer Center)

Esto es lo que requiere la cuenta de Meta/Facebook. Hay que hacerlo desde un navegador con esa sesión iniciada; desde esta sesión en la nube no tengo acceso a tu navegador ni a los dominios de Meta.

1. Entra en https://wearables.developer.meta.com con la cuenta de Meta/Facebook que vayas a usar como desarrollador. Una cuenta de Google (p. ej. una @gmail.com) no sirve para iniciar sesión en Meta; si quieres usar ese correo, crea con él una cuenta de Facebook/Meta primero.
2. Crea la **cuenta de desarrollador y la organización** (acepta los *Meta Wearables Developer Terms* y la *Acceptable Use Policy*).
3. Crea un **proyecto** y rellena **Configuration**:
   * Nombre: Faro
   * Android: paquete `app.faro.faro_app`
   * iOS: bundle ID (el que genere `flutter create`, p. ej. `app.faro.faroApp`) y tu **Apple Team ID**
   * Esquema de URL de retorno: `faro`
4. Copia el **Wearables Application ID** y el **Client Token** del proyecto:
   * Android → `android/local.properties`:
     ```
     mwdat_application_id=XXXXXXXX
     mwdat_client_token=YYYYYYYY
     ```
   * iOS → Xcode, target Runner → Build Settings → *User-Defined*: `META_APP_ID = XXXXXXXX`, `CLIENT_TOKEN = YYYYYYYY` (el `TeamID` sale solo de `DEVELOPMENT_TEAM`).
5. Configura el **canal de lanzamiento** (release channel) y añade testers; sin Developer Mode, solo los usuarios del canal pueden registrar la app.
6. Solicita la **aprobación de publicación**. El SDK está en *developer preview*: la distribución pública en App Store/Google Play requiere aprobación de Meta, y el streaming de audio de las gafas y la captura de fotos independiente están marcados como experimentales y no publicables. El vídeo de la cámara (lo que usa Faro) sí está en el alcance.

Fuentes: repos oficiales `facebook/meta-wearables-dat-android` y `facebook/meta-wearables-dat-ios` (README, AGENTS.md, skills `getting-started`, `permissions-registration`, `camera-streaming`, `debugging`) y la documentación en wearables.developer.meta.com (Manage projects, Permissions and registration).

## Qué hace el código

| Paso | Android (`GlassesBridge.kt`) | iOS (`GlassesBridge.swift`) |
|---|---|---|
| Inicializar | `Wearables.initialize(context)` (tras conceder `BLUETOOTH_CONNECT`) | `Wearables.configure()` en `AppDelegate` |
| Registrar con Meta AI | `Wearables.startRegistration(activity)` + observar `registrationState` | `startRegistration()` + `registrationStateStream()`; retorno por `faro://...?metaWearablesAction=` → `handleUrl` |
| Permiso de cámara | `checkPermissionStatus(CAMERA)` y `RequestPermissionContract` | `checkPermissionStatus(.camera)` / `requestPermission(.camera)` |
| Sesión y stream | `createSession(AutoDeviceSelector())` → `STARTED` → `addCamera(StreamConfiguration(LOW, 7 fps))` → `stream.videoStream` | `createSession` → `.started` → `addCamera(.raw, .low, 7)` → `videoFramePublisher` |
| Hacia Flutter | JPEG por `EventChannel faro/glasses/frames` (~3 fps) | ídem |

El manifiesto Android y el `Info.plist` ya incluyen todo lo que exige el SDK (meta-data `APPLICATION_ID`/`CLIENT_TOKEN`, permisos Bluetooth, esquema `faro`, `MWDAT`, modos en segundo plano, `UISupportedExternalAccessoryProtocols`, `NSBonjourServices`).

## Problemas típicos
* **"No pude vincular las gafas"**: Meta AI no instalada, sin sesión en Meta AI, Bluetooth apagado o Developer Mode desactivado.
* **Se registra pero nunca llega vídeo**: Developer Mode se desactivó tras una actualización; permiso de cámara "permitir una vez" caducado; otra app está usando las gafas (solo una app de terceros a la vez en Developer Mode).
* **La sesión se pausa**: gafas plegadas, un toque en la patilla pausa el stream (se reanuda solo), o Bluetooth fuera de alcance.

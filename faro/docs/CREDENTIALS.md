# Dependencias, APIs y credenciales que debes solicitar

## 1. Credenciales (qué pedir, dónde y para qué)

| # | Proveedor | Credencial | Dónde se obtiene | Uso en Faro | Variable de entorno | Coste orientativo |
|---|---|---|---|---|---|---|
| 1 | **Meta** (gafas) | Para **probar**: nada (Developer Mode en la app Meta AI). Para **publicar**: cuenta de desarrollador + organización + proyecto en el Wearables Developer Center → *Wearables Application ID* y *Client Token* | https://wearables.developer.meta.com (cuenta Meta/Facebook) | Vídeo de las gafas vía Meta Wearables Device Access Toolkit 1.0.1 (Android `com.meta.wearable:mwdat-core/mwdat-camera`, iOS Swift Package `meta-wearables-dat-ios`) | Android: `android/local.properties` → `mwdat_application_id`, `mwdat_client_token` · iOS: User-Defined `META_APP_ID`, `CLIENT_TOKEN` | Gratis. La distribución pública requiere aprobación de Meta (SDK en developer preview). Guía: `docs/META_GLASSES.md` |
| 2 | **Anthropic** | API key | https://console.anthropic.com | Visión de escena (escaleras, cables, baches, descripciones) | `ANTHROPIC_API_KEY`, `VLM_MODEL` | Sonnet 5.5: $2/M tokens entrada, $10/M salida; Haiku 5.5: $0,10 / $0,50. Un fotograma ≈ 1.000 tokens → a 1 fotograma cada 4 s: ≈ $1,8/h (Sonnet) o ≈ $0,10/h (Haiku). |
| 3 | **OpenAI** | API key | https://platform.openai.com | STT (`gpt-4o-mini-transcribe`, fallback `whisper-1`) y TTS opcional (`gpt-4o-mini-tts`) | `OPENAI_API_KEY`, `STT_MODEL`, `TTS_MODEL` | STT ≈ $0,003/min de audio; comandos de 3 s → despreciable. |
| 4 | **Google Cloud** | API key restringida (por IP del backend) con **Routes API**, **Places API (New)** y **Geocoding API** habilitadas; cuenta de facturación | https://console.cloud.google.com → APIs y servicios | Rutas a pie, búsqueda de destinos, "¿dónde estoy?" | `GOOGLE_MAPS_API_KEY` | Routes ≈ $5/1.000 rutas; Places Text Search ≈ $32/1.000; Geocoding ≈ $5/1.000. Crédito mensual gratuito de Google Maps Platform. **No uses la Directions API (legacy, no disponible para proyectos nuevos).** |
| 5 | **Uber** | App en el Developer Dashboard: `client_id`, `client_secret`, `server_token`, redirect URI `faro://uber/callback`; solicitar scope privilegiado `request` (y `profile`) | https://developer.uber.com | Deep link (solo `client_id`) o Ride Requests API (todo lo anterior + aprobación) | `UBER_CLIENT_ID`, `UBER_CLIENT_SECRET`, `UBER_SERVER_TOKEN`, `UBER_REDIRECT_URI`, `UBER_USE_SANDBOX`, `UBER_PROVIDER` | Gratis. La aprobación de scopes privilegiados puede tardar semanas y exige describir el caso de uso (accesibilidad es un buen argumento). Empieza con `UBER_PROVIDER=deeplink`. |
| 6 | **Apple** | Apple Developer Program; certificados y perfiles; App Store Connect | https://developer.apple.com | Publicar en iOS / TestFlight | — | $99/año |
| 7 | **Google Play** | Cuenta de desarrollador; firma de app | https://play.google.com/console | Publicar en Android | — | $25 una vez |
| 8 | **Hosting backend** | Cuenta en Fly.io / Google Cloud Run / Railway / AWS; dominio + TLS | — | Ejecutar `backend/` con HTTPS y WSS | `API_SHARED_SECRET` | Desde ≈ $10/mes (CPU); GPU T4 ≈ $0,35-0,60/h si activas YOLO en servidor |
| 9 | (Opcional) Sentry / Grafana | DSN | — | Errores y métricas | — | Planes gratuitos |

## 2. Variables de entorno del backend

Copia `backend/.env.example` → `.env`. Sin ninguna clave el backend arranca en **modo demo** (mapas, STT y Uber simulados) para desarrollar la app.

| Variable | Valor por defecto | Notas |
|---|---|---|
| `VISION_BACKEND` | `hybrid` | `yolo` · `vlm` · `hybrid` · `fake` |
| `YOLO_MODEL_PATH` | `yolov8n.pt` | se descarga solo la primera vez (ultralytics) |
| `YOLO_HAZARD_MODEL_PATH` | vacío | ruta al `best.pt` de `training/` |
| `VLM_MODEL` | `claude-sonnet-5-5` | `claude-haiku-5-5` para abaratar; `claude-opus-5-5` para máxima comprensión de escena |
| `VLM_INTERVAL_S` | `4.0` | segundos entre análisis VLM por sesión |
| `CAMERA_HORIZONTAL_FOV_DEG` | `100` | calibrar con las gafas reales (afecta a la distancia estimada) |
| `ALERT_COOLDOWN_S` / `ALERT_MIN_INTERVAL_S` | `3.0` / `1.2` | ajustar con usuarios |
| `UBER_PROVIDER` | `deeplink` | `api` cuando Uber apruebe el scope `request` |
| `API_SHARED_SECRET` | vacío | obligatorio en producción |

## 3. Dependencias de software

**Backend (Python ≥ 3.11)** — `fastapi`, `uvicorn`, `pydantic`, `pydantic-settings`, `httpx`, `python-multipart`, `pillow`, `numpy`, `anthropic`, `openai`. Opcional `vision`: `ultralytics` (YOLOv8, instala `torch`), `opencv-python-headless`. Dev: `pytest`, `pytest-asyncio`, `ruff`.

**App (Flutter ≥ 3.22)** — `camera`, `flutter_tts`, `geolocator`, `flutter_compass`, `web_socket_channel`, `record`, `http`, `url_launcher`, `permission_handler`, `image`, `path_provider`, `wakelock_plus`. Nativo: Meta Wearables DAT (Kotlin/Swift) a través del puente `faro/glasses`.

**Infra** — Docker, (opcional) GPU NVIDIA con CUDA para YOLO en servidor.

## 4. Orden recomendado para pedirlas

1. Anthropic + OpenAI (minutos): ya puedes probar visión y voz con la cámara del teléfono.
2. Google Cloud (1 h): navegación real.
3. Uber `client_id` (1 día): deep link operativo. En paralelo, solicitar scope `request`.
4. Meta Wearables Developer Center (días-semanas): registro, pruebas con gafas propias, solicitud de publicación.
5. Apple / Google Play (1-2 días por verificación de identidad).

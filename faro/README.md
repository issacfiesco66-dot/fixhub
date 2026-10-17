# Faro · asistente de movilidad por voz para personas con discapacidad visual

> Gafas inteligentes (Ray-Ban Meta) → teléfono → IA → voz al oído.
> Nombre en clave del proyecto; verifica disponibilidad de marca antes de publicar (ver `docs/LAUNCH.md`).

**Estado (prototipo funcional):** backend Python completo con 93 tests en verde · app Flutter (Android/iOS) lista para compilar · documentación de arquitectura, credenciales y lanzamiento. Lo que falta para producción está marcado en la tabla de estado más abajo.

## Qué hace

| Módulo | Qué resuelve | Dónde vive |
|---|---|---|
| 1. Visión e identificación de obstáculos | Analiza los fotogramas de la cámara (YOLOv8 local + modelo de visión Claude) y avisa por voz con frases ultra cortas: *"Escalera bajando al frente, 2 metros"*, *"Cable al frente, arriba"*, *"Vehículo a la derecha, cerca"*. Prioriza, filtra por distancia y evita repetir. | `backend/app/vision/` |
| 2. Navegación peatonal guiada | Rutas a pie con Google Routes API y guía pensada para personas ciegas: brújula (*"camina 80 metros hacia el norte"*), preaviso (*"en 20 metros, gira a la derecha"*), corrección de rumbo, recálculo y llegada tipo reloj (*"el destino está a las 2 en punto"*). | `backend/app/navigation/` |
| 3. Uber por voz | *"Pide un Uber a casa"* → cotiza → *"cuesta entre 85 y 100 pesos, el conductor llegaría en 4 minutos. ¿Confirmas?"* → *"sí"* → solicita (API) o abre Uber con el destino cargado (deep link, sin aprobación de Uber). | `backend/app/rides/` |
| 4. Interfaz accesible | Pantalla negra controlada al 100 % por gestos (mantener para hablar, deslizar para cancelar, doble toque para repetir) o por voz; compatible con TalkBack y VoiceOver (acciones personalizadas). TTS con cola de prioridades y háptica. | `mobile/lib/` |

## Arquitectura: flujo de datos

```mermaid
flowchart LR
    subgraph Usuario
        G[Gafas Ray-Ban Meta<br/>cámara + micrófonos + altavoces]
    end
    subgraph Teléfono["Teléfono (app Flutter)"]
        B[Puente nativo<br/>Meta Wearables DAT]
        C[Cámara del teléfono<br/>respaldo]
        F[Fotogramas JPEG<br/>2-3 fps]
        L[GPS + brújula]
        M[Push-to-talk<br/>grabación AAC]
        T[TTS en el dispositivo<br/>cola de prioridades + háptica]
        U[Deep link Uber]
    end
    subgraph Backend["Backend Python (FastAPI)"]
        WS[WebSocket /ws/{sesión}]
        V[Pipeline de visión<br/>YOLOv8 + VLM Claude<br/>política de alertas]
        S[STT OpenAI<br/>gpt-4o-mini-transcribe]
        I[Parser de intenciones ES]
        N[Guía peatonal<br/>Google Routes/Places/Geocoding]
        R[Flujo Uber<br/>cotizar → confirmar → pedir]
    end
    G -- Bluetooth/Wi-Fi<br/>vídeo + audio --> B
    B --> F
    C --> F
    F -- binario --> WS
    L -- JSON --> WS
    M -- multipart /voice --> S --> I
    I --> N
    I --> R
    I --> V
    WS --> V
    V -- alert --> T
    N -- nav --> T
    R -- speak / open_url --> T
    R --> U
    T -- audio Bluetooth --> G
```

Vista en texto (gafas → teléfono → APIs → audio de vuelta):

```
 Gafas Meta ──(vídeo/audio BT)──► Teléfono ──(JPEG 2-3 fps, GPS, voz)──► Backend ──► APIs
     ▲                               │                                      │      (Claude visión,
     │                               │                                      │       OpenAI STT,
     └──── audio BT (altavoces) ◄─── TTS local ◄──(alert/speak/nav JSON)───┘       Google Routes,
                                     háptica                                        Uber)
```

Presupuesto de latencia objetivo (fotograma → voz): captura 50 ms · compresión 30 ms · red 60 ms · YOLO 40-90 ms · política 1 ms · TTS 150 ms ≈ **0,4 s**. El VLM (Claude) corre en paralelo cada 4 s y sus hallazgos se funden con los de YOLO; nunca bloquea el bucle rápido. Detalle en `docs/ARCHITECTURE.md`.

## Estructura

```
faro/
├── backend/                 # Python 3.11+ · FastAPI · 93 tests
│   ├── app/
│   │   ├── main.py          # REST + WebSocket
│   │   ├── assistant.py     # orquestador: intención → módulo → mensajes de voz
│   │   ├── vision/          # hazards.py (taxonomía/frases), detector.py (YOLOv8),
│   │   │                    # vlm.py (Claude), alert_policy.py, pipeline.py
│   │   ├── speech/          # intents.py (parser ES), stt.py (OpenAI), tts.py
│   │   ├── navigation/      # google_maps.py (Routes/Places/Geocoding), guidance.py, geo.py
│   │   ├── rides/           # uber.py (API + deep link), flow.py (confirmación por voz)
│   │   └── session/         # estado por usuario
│   ├── training/            # fine-tuning YOLOv8 para escaleras, cables, postes, baches
│   └── tests/
├── mobile/                  # Flutter (iOS + Android)
│   ├── lib/features/home/   # pantalla negra accesible + controlador
│   ├── lib/services/        # cámara/gafas, TTS, GPS+brújula, grabación, sesión WebSocket
│   ├── android/ · ios/      # manifiestos, permisos y puente nativo para las gafas (DAT)
│   └── test/
└── docs/                    # ARCHITECTURE · CREDENTIALS · ACCESSIBILITY · LAUNCH
```

## Arranque rápido

Backend (sin ninguna credencial funciona en modo demo con proveedores simulados):

```bash
cd faro/backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"            # añade ".[vision]" para YOLOv8 local (instala torch)
cp .env.example .env               # rellena las claves que tengas
pytest                             # 93 tests
uvicorn --factory app.main:create_app --reload --port 8000
```

App móvil:

```bash
cd faro/mobile
flutter create . --org app.faro --project-name faro_app --platforms=android,ios   # genera lo que falta, respeta lo existente
flutter pub get
flutter run --dart-define=FARO_BACKEND_URL=http://<ip-de-tu-pc>:8000
```

Más detalle en `backend/README.md` y `mobile/README.md`.

## Estado por módulo

| Pieza | Estado | Para producción falta |
|---|---|---|
| Taxonomía de peligros, frases, distancia monocular, política de alertas | ✅ probado | Calibrar FOV real de las gafas |
| Detector YOLOv8 (COCO: vehículos, personas, bicis, animales, obstáculos) | ✅ código listo | `pip install -e ".[vision]"` y GPU en el servidor |
| Escaleras / cables / postes / baches | ✅ vía VLM Claude; 🟡 modelo YOLO fine-tuned | Entrenar con `training/` (dataset propio grabado con las gafas) |
| STT (OpenAI gpt-4o-mini-transcribe → whisper-1) | ✅ | `OPENAI_API_KEY` |
| Parser de intenciones en español | ✅ 35 casos probados | Ampliar vocabulario con usuarios reales |
| Rutas a pie + guía con brújula + recálculo | ✅ probado con rutas sintéticas | `GOOGLE_MAPS_API_KEY` (Routes, Places New, Geocoding) |
| Uber deep link (abre la app con destino) | ✅ | `UBER_CLIENT_ID` |
| Uber API (solicitud automática tras confirmar) | ✅ código + OAuth | Aprobación de Uber del scope privilegiado `request` |
| App Flutter: gestos, TalkBack/VoiceOver, TTS, cámara, GPS, voz | ✅ escrita, 🟡 no compilada en este entorno | `flutter analyze && flutter test` en tu máquina |
| Vídeo desde las gafas Meta | ✅ integración con el SDK oficial (DAT 1.0.1) en Android e iOS, 🟡 sin probar con hardware | Probar con gafas reales en Developer Mode; para publicar, registro en el Wearables Developer Center (`docs/META_GLASSES.md`) |
| Autenticación de usuarios, persistencia (Redis/Postgres), métricas | ❌ | Ver `docs/LAUNCH.md` |

## Decisiones clave

* **Alertas ultra cortas y una sola por fotograma.** `alert_policy.py` ordena por (prioridad, distancia), aplica cooldown por (peligro, zona) y deja interrumpir solo a prioridades 0-1. Es la pieza que evita abrumar al usuario.
* **Dos velocidades de visión.** YOLO local responde en decenas de milisegundos a lo que conoce; el VLM (Claude, `VLM_MODEL=claude-sonnet-5-5` por defecto, `claude-haiku-5-5` como opción barata) cubre escaleras, cables y baches cada pocos segundos hasta que exista el modelo fine-tuned. El código envía `fallbacks: "default"` para que, si un clasificador de seguridad declina un fotograma, la API reintente en un modelo sustituto dentro de la misma llamada.
* **TTS en el teléfono, no en la nube.** Las alertas no pueden depender de la red; el backend solo manda texto + prioridad. Hay un endpoint `/v1/tts` opcional para voces premium en mensajes no críticos.
* **Uber con deep link por defecto.** Lanzable hoy sin esperar la aprobación de Uber; el modo `api` queda listo para activarlo por configuración.
* **Routes API, no Directions API.** La Directions API es *legacy* y no está disponible para proyectos nuevos de Google Cloud.
* **Flutter sobre React Native** por `Semantics`/`CustomSemanticsAction` de primera clase, un solo código para TalkBack y VoiceOver y plugins maduros de cámara, TTS y brújula.

## Documentación

* `docs/ARCHITECTURE.md` — flujo de datos detallado, protocolo WebSocket, decisiones y hoja de ruta.
* `docs/CREDENTIALS.md` — todas las APIs, claves, aprobaciones y costes estimados.
* `docs/ACCESSIBILITY.md` — mapa de gestos, comportamiento con lectores de pantalla y lista de pruebas.
* `docs/LAUNCH.md` — pasos para ponerla en circulación: despliegue, tiendas, legal, pilotos y monetización.
* `docs/META_GLASSES.md` — gafas Meta: Developer Mode para probar hoy y registro en el Wearables Developer Center para publicar.

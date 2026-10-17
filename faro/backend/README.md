# Faro backend

API FastAPI que procesa vídeo, voz y ubicación y devuelve mensajes listos para leer en voz alta.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"          # + ".[vision]" para YOLOv8 local
cp .env.example .env
pytest                           # 93 tests, sin red
ruff check app tests
uvicorn --factory app.main:create_app --reload --port 8000
```

Sin claves el servidor arranca en **modo demo** (mapas, STT y Uber simulados; visión solo YOLO si está instalado). `GET /health` muestra qué proveedor está activo.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | estado y proveedores |
| POST | `/v1/sessions` | crea sesión → `session_id` |
| WS | `/ws/{session_id}?key=` | binario = JPEG; texto = JSON (`location`, `utterance`, `ping`) |
| POST | `/v1/sessions/{id}/voice` | multipart `file` + `language` → transcripción + mensajes |
| POST | `/v1/sessions/{id}/utterance` | texto ya transcrito (STT en el dispositivo) |
| POST | `/v1/sessions/{id}/location` | posición/rumbo → eventos de navegación |
| POST | `/v1/sessions/{id}/frame` | JPEG en el cuerpo → alerta o `null` |
| GET/PUT | `/v1/sessions/{id}/places` | lugares guardados (`home`, `work`) |
| GET | `/v1/sessions/{id}/state` | estado de la sesión |
| POST | `/v1/tts` | TTS en la nube (opcional) |
| GET | `/v1/uber/oauth/url` · `/callback` · POST `/v1/sessions/{id}/uber/token` | vinculación de Uber (modo `api`) |

Formato de los mensajes: `docs/ARCHITECTURE.md` §2.

## Probar a mano

```bash
SID=$(curl -s -XPOST localhost:8000/v1/sessions -H 'content-type: application/json' -d '{}' | jq -r .session_id)
curl -s -XPOST localhost:8000/v1/sessions/$SID/location -H 'content-type: application/json' -d '{"lat":19.4326,"lng":-99.1332,"heading":0}'
curl -s -XPOST localhost:8000/v1/sessions/$SID/utterance -H 'content-type: application/json' -d '{"text":"pide un uber al aeropuerto"}' | jq
curl -s -XPOST localhost:8000/v1/sessions/$SID/utterance -H 'content-type: application/json' -d '{"text":"sí"}' | jq
curl -s -XPOST localhost:8000/v1/sessions/$SID/frame --data-binary @foto.jpg -H 'content-type: image/jpeg' | jq
```

## Docker

```bash
docker build -t faro-backend .                         # sin YOLO (solo VLM)
docker build -t faro-backend --build-arg INSTALL_VISION=1 .
docker run --env-file .env -p 8000:8000 faro-backend
```

## Entrenar el detector de peligros de acera

Ver `training/README.md`. El modelo COCO base no conoce escaleras, cables, postes ni baches; mientras no exista el modelo fine-tuned esos peligros los aporta el VLM (Claude).

# Puesta en circulación: del prototipo al mercado

## Fase 0 — Esta semana (sin credenciales de Meta)
1. Clona, ejecuta `pytest` en `backend/` y `flutter test` en `mobile/`.
2. Pide claves de Anthropic, OpenAI y Google (ver `docs/CREDENTIALS.md`) y prueba el flujo completo con la **cámara del teléfono** como fuente de vídeo.
3. Graba 30-60 min de vídeo caminando (idealmente con las gafas) para empezar el dataset de escaleras, cables, postes y baches (`backend/training/README.md`).

## Fase 1 — Backend en producción
* Construye la imagen: `docker build -t faro-backend backend/` (añade `--build-arg INSTALL_VISION=1` para YOLO en servidor).
* Despliega en Fly.io / Cloud Run / Railway con **HTTPS + WebSocket**, variables de `.env.example`, `API_SHARED_SECRET` fuerte y `APP_ENV=prod`.
* Pon límites de coste en OpenAI, Anthropic y Google; activa alertas de facturación.
* Observabilidad: logs estructurados, Sentry, métricas de latencia por fotograma y tasa de alertas por minuto.
* Antes de usuarios reales: autenticación por usuario (Firebase Auth/Auth0 → JWT), Redis para sesiones, rate limiting, borrado de sesión al cerrar.

## Fase 2 — Gafas Meta
Guía completa en `docs/META_GLASSES.md`.
1. **Hoy, sin registro**: activa *Modo desarrollador* en Meta AI (Ajustes → Tus gafas), compila con credenciales "0" y di "conecta las gafas" en Faro.
2. Calibra `CAMERA_HORIZONTAL_FOV_DEG` con las gafas reales (afecta a las distancias anunciadas) y ajusta la política de alertas con el vídeo real.
3. **Para publicar**: crea cuenta, organización y proyecto en el Wearables Developer Center, copia el Application ID y el Client Token a `android/local.properties` y a los User-Defined Settings de Xcode, configura el canal de lanzamiento y solicita la aprobación de publicación de Meta.

## Fase 3 — Pilotos con personas usuarias
* 10-20 personas ciegas/baja visión durante 4 semanas, con un especialista en orientación y movilidad. Métricas: alertas útiles vs. falsas por hora, tiempo de reacción, tasa de comandos entendidos, NPS.
* Alianzas: asociaciones de personas ciegas (ONCE, CONAPRED/INDISCAPACIDAD, fundaciones locales), escuelas de perros guía, hospitales oftalmológicos.
* Itera primero en la **política de alertas** (cooldown, distancias) y el vocabulario del parser.

## Fase 4 — Tiendas
**Preparación común**
* Nombre y marca: verifica registro de marca de "Faro" en tu país/categoría (hay empresas homónimas en otros sectores); ten un plan B.
* Política de privacidad pública (obligatoria en ambas tiendas): qué se captura (imágenes, audio, ubicación), que no se almacena, proveedores (Anthropic, OpenAI, Google, Uber), base legal, contacto, borrado. Cumple GDPR (UE) y LFPDPPP (México) según mercado.
* Términos de uso con **aviso claro**: Faro es una ayuda complementaria, **no sustituye** al bastón blanco, al perro guía ni al criterio de la persona; sin garantía de detección de todos los peligros.
* Declaración de accesibilidad y vídeo de demostración (los revisores lo agradecen cuando una app pide cámara+micro+ubicación).
* Icono, capturas, ficha en español (título: "Faro: guía por voz para personas ciegas"; subtítulo: "Obstáculos, rutas a pie y Uber, solo con tu voz").

**iOS**: `flutter build ipa` → App Store Connect → TestFlight (hasta 10.000 testers) → revisión. Justifica `UIBackgroundModes` (audio/ubicación) en las notas para el revisor.

**Android**: `flutter build appbundle` → Play Console → prueba interna → cerrada → producción. Rellena el formulario de seguridad de datos y la declaración de permisos sensibles; añade un servicio en primer plano para la cámara si quieres operar con pantalla apagada.

**Meta**: coordina la aprobación de publicación con DAT (fase 2) para que la versión de tienda incluya el soporte de gafas.

## Fase 5 — Operación y crecimiento
* Modelo de negocio sugerido: gratuito para la persona usuaria con límite de minutos de visión avanzada; **B2B2C** (aseguradoras, operadoras, gobiernos y ONG que patrocinan licencias); licencias institucionales para escuelas y centros de rehabilitación; posibles subvenciones de accesibilidad.
* Costes variables por hora de uso (ver `docs/CREDENTIALS.md`): optimiza con `VLM_MODEL=claude-haiku-5-5` para el bucle continuo y Sonnet/Opus solo para "describe lo que ves".
* Roadmap técnico: YOLO en el dispositivo (TFLite/CoreML) para funcionar sin red; reconocimiento de voz en el dispositivo; lectura de letreros y semáforos; recordatorio de rutas frecuentes; modo transporte público.

## Riesgos que conviene conocer
| Riesgo | Mitigación |
|---|---|
| Meta no aprueba la publicación o cambia el SDK | La app funciona con la cámara del teléfono y con cualquier cámara BLE/UVC; el puente nativo aísla la dependencia. |
| Uber no concede el scope `request` | Deep link operativo desde el día 1. |
| Falsos negativos en peligros | Mensajería honesta, pilotos con especialistas, dataset propio y métricas por clase antes de cada versión. |
| Latencia/red | Alertas con TTS local; roadmap de detección en el dispositivo. |
| Coste por usuario | Haiku para el bucle continuo, muestreo adaptativo (menos fotogramas si el usuario está parado). |

# Accesibilidad: diseño de interacción de Faro

## Principios
1. **Cero pantalla.** Toda la información sale por voz y háptica; la pantalla negra solo muestra un estado grande para personas con baja visión o acompañantes.
2. **Brevedad.** Una alerta = peligro + posición + distancia, máximo ~6 palabras. Nunca dos alertas seguidas en menos de 1,2 s (salvo vehículo).
3. **Prioridad y interrupción.** Peligros (prioridad 0-1) cortan cualquier frase; la navegación y las respuestas esperan su turno.
4. **Confirmación explícita** para acciones con coste (Uber): la app repite destino y precio y espera un "sí".
5. **Redundancia sensorial.** Vibración `danger` (3 pulsos fuertes), `warning` (2 medios), `success` (llegada), `tick` (escuchando).

## Mapa de gestos (sin lector de pantalla)

| Gesto | Acción |
|---|---|
| Mantener presionado en cualquier punto | Grabar comando; se envía al soltar |
| Deslizar a izquierda o derecha | Cancelar (grabación, confirmación pendiente, viaje o ruta) |
| Doble toque | Repetir el último mensaje |
| Deslizar hacia arriba | "¿Dónde estoy?" |
| Deslizar hacia abajo | "¿Qué hay delante?" (descripción de escena) |
| Toque con dos dedos | Silenciar / activar alertas de obstáculos |

## Con TalkBack (Android) y VoiceOver (iOS)
* La pantalla entera es **un solo botón** con etiqueta "Faro. <estado>" y pista de uso; no hay nada más que explorar.
* Activar (doble toque) o "doble toque y mantener" alterna la escucha: una activación empieza a grabar, otra envía (o se envía solo a los 7 s).
* El resto de acciones están en el **menú de acciones personalizadas** del lector: Cancelar · Repetir · ¿Dónde estoy? · Describir lo que hay delante · Silenciar/activar alertas.
* Los cambios de estado se anuncian con `SemanticsService.announce` solo cuando no interfieren con una alerta.
* Las alertas usan el motor TTS del sistema (`flutter_tts`), el mismo que el lector, con la voz y velocidad configuradas por la persona usuaria.

## Comandos de voz (español)
* Navegar: "llévame a la farmacia", "cómo llego al metro Hidalgo", "quiero ir a casa", "vamos al trabajo".
* Uber: "pide un Uber a casa", "pedir Uber al aeropuerto", "quiero un taxi hacia la terminal". Sin destino: "pide un Uber" → "¿A dónde quieres ir?".
* Confirmar: "sí", "dale", "confirmo", "ok". Cancelar: "no", "cancela", "olvídalo".
* Ruta: "detener navegación", "cancela la ruta".
* Entorno: "¿qué hay delante?", "describe lo que ves", "¿dónde estoy?", "¿en qué calle estoy?".
* Lugares: "guarda este lugar como casa / como mi trabajo".
* Alertas: "silencia las alertas", "activa las alertas". Otros: "repite", "ayuda".

## Lista de verificación antes de cada versión
- [ ] Recorrido completo con TalkBack y con VoiceOver activados: iniciar, hablar, cancelar, repetir, pedir Uber, navegar.
- [ ] Alertas audibles con el teléfono en el bolsillo y auriculares/gafas conectados por Bluetooth (perfil A2DP y HFP).
- [ ] Ninguna alerta dura más de 2 s de voz; ninguna frase de navegación más de 6 s.
- [ ] Prueba en calle con al menos 5 personas ciegas o con baja visión y un especialista en orientación y movilidad; registrar falsos positivos/negativos por clase.
- [ ] Textos de permisos del sistema claros y leídos por el lector de pantalla.
- [ ] Modo sin red: la app avisa claramente de que las alertas no están activas.
- [ ] Contraste del estado visual ≥ 7:1 y tamaño ≥ 34 pt.
- [ ] Funciona con pantalla apagada (audio y ubicación en segundo plano en iOS; servicio en primer plano en Android pendiente).

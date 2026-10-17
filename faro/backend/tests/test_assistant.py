from app.deps import build_deps
from app.navigation.geo import destination_point
from tests.conftest import make_settings

ORIGIN = (19.4326, -99.1332)


def texts(messages):
    return [m.get("text") for m in messages if m.get("type") in ("speak", "nav")]


async def start_session(deps):
    session = deps.sessions.create("u1")
    await deps.assistant.handle_location(session, ORIGIN[0], ORIGIN[1], heading=0.0)
    return session


async def test_ride_to_home_requires_saving_home_first():
    deps = build_deps(make_settings())
    session = await start_session(deps)
    a = deps.assistant
    assert texts(await a.handle_utterance(session, "pide un uber a casa")) == [
        "No tienes guardado casa. Di: guarda este lugar como casa."
    ]
    assert texts(await a.handle_utterance(session, "guarda este lugar como casa")) == [
        "Guardado como casa."
    ]
    out = await a.handle_utterance(session, "Pide un Uber a casa")
    assert texts(out)[0].startswith("Uber UberX a casa: cuesta entre 85 y 100 pesos")
    assert out[-1]["type"] == "state" and out[-1]["pending"] == "ride"
    out = await a.handle_utterance(session, "sí")
    assert texts(out)[0].startswith("Listo. Uber solicitado a casa. Juan llega en 4 minutos")
    assert len(deps.rides.requests) == 1
    assert texts(await a.handle_utterance(session, "cancela"))[0] == "Viaje cancelado."


async def test_ride_without_destination_asks_and_accepts_free_text():
    deps = build_deps(make_settings())
    session = await start_session(deps)
    a = deps.assistant
    assert texts(await a.handle_utterance(session, "pide un uber")) == [
        "¿A dónde quieres ir en Uber?"
    ]
    out = await a.handle_utterance(session, "al aeropuerto")
    assert texts(out)[0].startswith("Uber UberX a Aeropuerto:")
    assert texts(await a.handle_utterance(session, "no"))[0] == "Cancelado."
    assert (
        texts(await a.handle_utterance(session, "sí"))[0] == "No hay nada pendiente por confirmar."
    )


async def test_navigation_until_arrival():
    deps = build_deps(make_settings())
    session = await start_session(deps)
    a = deps.assistant
    out = await a.handle_utterance(session, "llévame a la farmacia")
    assert out[0]["type"] == "nav" and out[0]["event"] == "start"
    assert out[0]["text"].startswith("Ruta a Farmacia: 300 metros")
    assert session.guide is not None
    collected = []
    for d in range(0, 301, 5):
        p = destination_point(ORIGIN, 0, d)
        collected += await a.handle_location(session, p[0], p[1], heading=0.0)
    assert collected[-1]["event"] == "arrived"
    assert collected[-1]["text"].startswith("Has llegado a Farmacia.")
    assert session.guide is None
    assert texts(await a.handle_utterance(session, "detener navegación")) == [
        "No hay ninguna ruta activa."
    ]


async def test_navigation_reroutes_when_off_route():
    deps = build_deps(make_settings())
    session = await start_session(deps)
    a = deps.assistant
    await a.handle_utterance(session, "llévame a la farmacia")
    off = destination_point(destination_point(ORIGIN, 0, 100), 90, 80)
    out = []
    for _ in range(3):
        out += await a.handle_location(session, off[0], off[1], heading=0.0)
    assert out and out[-1]["event"] == "reroute"
    assert out[-1]["text"].startswith("Ruta recalculada. Ruta a Farmacia")


async def test_misc_commands():
    deps = build_deps(make_settings())
    session = await start_session(deps)
    a = deps.assistant
    assert texts(await a.handle_utterance(session, "¿dónde estoy?")) == [
        "Estás en Calle Falsa 123, Centro, mirando hacia el norte."
    ]
    assert "Puedes decir" in texts(await a.handle_utterance(session, "ayuda"))[0]
    assert texts(await a.handle_utterance(session, "repite"))[0].startswith("Puedes decir")
    assert texts(await a.handle_utterance(session, "blablabla")) == [
        "No entendí. Di ayuda para escuchar los comandos."
    ]
    assert texts(await a.handle_utterance(session, "cancelar")) == ["No hay nada que cancelar."]
    out = await a.handle_utterance(session, "silencia las alertas")
    assert texts(out) == ["Alertas de obstáculos silenciadas."] and session.alerts_enabled is False
    assert texts(await a.handle_utterance(session, "qué hay delante")) == [
        "La descripción de escena no está disponible en este servidor."
    ]
    assert texts(await a.handle_utterance(session, "llévame a nada")) == [
        "No encontré nada. Intenta con otro nombre o dirección."
    ]


async def test_commands_without_position():
    deps = build_deps(make_settings())
    session = deps.sessions.create("u1")
    a = deps.assistant
    assert texts(await a.handle_utterance(session, "llévame a la farmacia")) == [
        "Aún no tengo tu ubicación. Espera unos segundos."
    ]
    assert texts(await a.handle_utterance(session, "¿dónde estoy?")) == [
        "Aún no tengo tu ubicación."
    ]

import pytest

from app.speech.intents import Intent, destination_from_free_text, parse_command

CASES = [
    ("Llévame a la farmacia más cercana", Intent.NAVIGATE, "farmacia mas cercana", None),
    ("¿Cómo llego al Zócalo?", Intent.NAVIGATE, "zocalo", None),
    ("quiero ir a casa", Intent.NAVIGATE, "casa", "home"),
    ("Vamos al trabajo", Intent.NAVIGATE, "trabajo", "work"),
    ("navegar hacia el parque México", Intent.NAVIGATE, "parque mexico", None),
    ("Pide un Uber a casa", Intent.RIDE_REQUEST, "casa", "home"),
    ("pedir uber al aeropuerto por favor", Intent.RIDE_REQUEST, "aeropuerto", None),
    (
        "Quiero un taxi hacia la terminal de autobuses",
        Intent.RIDE_REQUEST,
        "terminal de autobuses",
        None,
    ),
    ("pide un uber", Intent.RIDE_REQUEST, None, None),
    ("sí", Intent.CONFIRM, None, None),
    ("Sí, confirmo", Intent.CONFIRM, None, None),
    ("dale", Intent.CONFIRM, None, None),
    ("ok", Intent.CONFIRM, None, None),
    ("sí por favor", Intent.CONFIRM, None, None),
    ("no", Intent.CANCEL, None, None),
    ("cancela", Intent.CANCEL, None, None),
    ("cancela el uber", Intent.CANCEL, None, None),
    ("olvídalo", Intent.CANCEL, None, None),
    ("detener navegación", Intent.STOP_NAVIGATION, None, None),
    ("cancela la ruta", Intent.STOP_NAVIGATION, None, None),
    ("¿Qué hay delante?", Intent.DESCRIBE_SCENE, None, None),
    ("describe lo que ves", Intent.DESCRIBE_SCENE, None, None),
    ("¿Dónde estoy?", Intent.WHERE_AM_I, None, None),
    ("en qué calle estoy", Intent.WHERE_AM_I, None, None),
    ("repite", Intent.REPEAT, None, None),
    ("ayuda", Intent.HELP, None, None),
    ("guarda este lugar como casa", Intent.SAVE_PLACE, "casa", "home"),
    ("recuerda esta ubicación como mi trabajo", Intent.SAVE_PLACE, "trabajo", "work"),
    ("hola qué tal", Intent.UNKNOWN, None, None),
    ("gracias", Intent.UNKNOWN, None, None),
    ("quiero fruta", Intent.UNKNOWN, None, None),
]


@pytest.mark.parametrize("text,intent,destination,alias", CASES)
def test_parse_command(text, intent, destination, alias):
    cmd = parse_command(text)
    assert cmd.intent is intent, cmd
    assert cmd.destination == destination, cmd
    assert cmd.place_alias == alias, cmd


def test_toggle_alerts():
    assert parse_command("silencia las alertas").extra == {"enabled": False}
    assert parse_command("desactiva alertas").extra == {"enabled": False}
    assert parse_command("activa las alertas").extra == {"enabled": True}
    assert parse_command("activa las alertas").intent is Intent.TOGGLE_ALERTS


def test_context_awaiting_confirmation():
    assert parse_command("sí, pídelo ya", awaiting_confirmation=True).intent is Intent.CONFIRM
    assert (
        parse_command("no, mejor a la oficina", awaiting_confirmation=True).intent is Intent.CANCEL
    )
    # Sin contexto, "no sé dónde estoy" es una consulta de ubicación, no una cancelación.
    assert parse_command("no sé dónde estoy").intent is Intent.WHERE_AM_I
    # Un comando nuevo durante una confirmación pendiente la reemplaza.
    cmd = parse_command("pide un uber al centro", awaiting_confirmation=True)
    assert cmd.intent is Intent.RIDE_REQUEST and cmd.destination == "centro"


def test_destination_from_free_text():
    assert destination_from_free_text("al aeropuerto") == "aeropuerto"
    assert destination_from_free_text("la farmacia por favor") == "farmacia"
    assert destination_from_free_text("Zócalo") == "zocalo"
    assert destination_from_free_text("a casa") == "casa"

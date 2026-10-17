"""Parser de intenciones en español basado en reglas (rápido, determinista, sin red).

Se aplica sobre la transcripción de voz. Las frases se normalizan (minúsculas, sin acentos,
sin puntuación) y se evalúan en orden de especificidad. Confirmar y cancelar exigen una
palabra clave explícita: "gracias" o "bueno" solas nunca disparan una acción.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from enum import StrEnum


class Intent(StrEnum):
    NAVIGATE = "navigate"
    RIDE_REQUEST = "ride_request"
    CONFIRM = "confirm"
    CANCEL = "cancel"
    STOP_NAVIGATION = "stop_navigation"
    DESCRIBE_SCENE = "describe_scene"
    WHERE_AM_I = "where_am_i"
    REPEAT = "repeat"
    HELP = "help"
    SAVE_PLACE = "save_place"
    TOGGLE_ALERTS = "toggle_alerts"
    CONNECT_GLASSES = "connect_glasses"
    UNKNOWN = "unknown"


@dataclass
class ParsedCommand:
    intent: Intent
    destination: str | None = None  # texto libre del destino ("farmacia", "zocalo")
    place_alias: str | None = None  # "home" | "work" si el destino es un alias guardado
    raw: str = ""
    normalized: str = ""
    extra: dict = field(default_factory=dict)


PLACE_ALIASES: dict[str, tuple[str, ...]] = {
    "home": ("casa", "mi casa", "la casa", "hogar"),
    "work": ("trabajo", "mi trabajo", "el trabajo", "oficina", "la oficina", "mi oficina"),
}

CONFIRM_CORE = {
    "si",
    "confirmo",
    "confirmar",
    "confirma",
    "confirmado",
    "dale",
    "ok",
    "okay",
    "okey",
    "claro",
    "adelante",
    "acepto",
    "aceptar",
    "correcto",
    "exacto",
    "va",
    "vale",
    "hazlo",
    "pidelo",
    "afirmativo",
    "seguro",
    "listo",
    "acuerdo",
    "supuesto",
}
CANCEL_CORE = {
    "no",
    "cancela",
    "cancelar",
    "cancelalo",
    "cancelado",
    "detente",
    "stop",
    "olvidalo",
    "olvidar",
    "nada",
    "negativo",
    "alto",
}
FILLER = {"por", "favor", "gracias", "de", "que", "eso", "es", "ya", "bueno", "mejor", "ahora"}

CONFIRM_STARTS = (
    "si ",
    "confirmo",
    "confirma",
    "dale",
    "ok",
    "okay",
    "claro",
    "adelante",
    "acepto",
    "correcto",
    "vale",
    "hazlo",
    "pidelo",
    "afirmativo",
    "de acuerdo",
)
CANCEL_STARTS = ("cancela", "cancelar", "olvidalo", "detente", "alto", "negativo")
CANCEL_STARTS_IN_CONTEXT = CANCEL_STARTS + ("no ", "no gracias", "mejor no", "nada")

STOP_NAV_PHRASES = (
    "detener navegacion",
    "deten la navegacion",
    "detener la navegacion",
    "parar navegacion",
    "para la navegacion",
    "terminar navegacion",
    "termina la navegacion",
    "terminar la ruta",
    "termina la ruta",
    "cancelar ruta",
    "cancela la ruta",
    "cancelar la ruta",
    "cancelar navegacion",
    "cancela la navegacion",
    "salir de la ruta",
    "detener ruta",
    "deten la ruta",
    "fin de la ruta",
    "detener la ruta",
)
DESCRIBE_PHRASES = (
    "que hay delante",
    "que hay al frente",
    "que hay enfrente",
    "que hay adelante",
    "que ves",
    "describe",
    "que tengo delante",
    "que hay frente a mi",
    "que tengo enfrente",
    "describeme",
)
WHERE_PHRASES = (
    "donde estoy",
    "en que calle",
    "en donde estoy",
    "mi ubicacion",
    "donde me encuentro",
    "que calle es",
)
REPEAT_PHRASES = ("repite", "repetir", "otra vez", "que dijiste", "de nuevo", "repiteme")
HELP_PHRASES = (
    "ayuda",
    "que puedes hacer",
    "comandos",
    "instrucciones",
    "como funciona",
    "que sabes hacer",
)
GLASSES_PHRASES = (
    "conecta las gafas",
    "conectar gafas",
    "conectar las gafas",
    "conecta mis gafas",
    "conectar mis gafas",
    "vincula las gafas",
    "vincular gafas",
    "vincular las gafas",
    "empareja las gafas",
    "emparejar gafas",
    "usar las gafas",
    "activa las gafas",
    "activar las gafas",
    "conecta los lentes",
    "conectar lentes",
    "conectar los lentes",
    "vincular lentes",
    "vincula los lentes",
)

_RIDE_RE = re.compile(r"\b(?:uber|taxi|un viaje|un coche|un carro|un auto)\b")
_NAV_RE = re.compile(
    r"\b(?:llevame|llevarme|navega|navegar|quiero ir|vamos|como llego|como llegar|ruta|"
    r"guiame|guiar|caminar|camina|dirigeme|indicaciones|direccion|ir)\b"
)
_DEST_RE = re.compile(
    r"\b(?:rumbo a|con destino a|a|al|hacia|hasta|para)\s+"
    r"(?:la |el |los |las |un |una )?(?P<dest>.+)$"
)
_SAVE_RE = re.compile(
    r"\b(?:guarda|guardar|recuerda|recordar|marca|marcar|registra|registrar)\b.*"
    r"\b(?:este lugar|aqui|esta ubicacion|mi ubicacion|esta direccion|donde estoy)\b.*"
    r"\bcomo\s+(?:mi |la |el )?(?P<name>.+)$"
)
_TRAILING_NOISE = ("por favor", "porfavor", "gracias", "ahora", "ya")
_LEADING_ARTICLE_RE = re.compile(r"^(?:la|el|los|las|un|una|al|a)\s+")


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def resolve_alias(destination: str | None) -> str | None:
    if not destination:
        return None
    d = destination.strip()
    for alias, words in PLACE_ALIASES.items():
        if d in words:
            return alias
    return None


def _clean_destination(dest: str) -> str:
    dest = dest.strip()
    changed = True
    while changed:
        changed = False
        for noise in _TRAILING_NOISE:
            if dest.endswith(" " + noise) or dest == noise:
                dest = dest[: -len(noise)].strip()
                changed = True
    return dest


def _extract_destination(tail: str) -> str | None:
    m = _DEST_RE.search(tail)
    if not m:
        return None
    dest = _clean_destination(m.group("dest"))
    return dest or None


def destination_from_free_text(text: str) -> str:
    """'al aeropuerto' -> 'aeropuerto'; 'la farmacia' -> 'farmacia'; 'zocalo' -> 'zocalo'."""
    t = normalize(text)
    dest = _extract_destination(t) if _DEST_RE.match(t) else None
    if dest is None:
        dest = _LEADING_ARTICLE_RE.sub("", t)
    return _clean_destination(dest)


def _short_match(text: str, core: set[str]) -> bool:
    tokens = text.split()
    return (
        bool(tokens)
        and any(t in core for t in tokens)
        and all(t in core or t in FILLER for t in tokens)
    )


def parse_command(text: str, *, awaiting_confirmation: bool = False) -> ParsedCommand:
    raw = text
    t = normalize(text)
    cmd = ParsedCommand(intent=Intent.UNKNOWN, raw=raw, normalized=t)
    if not t:
        return cmd

    # 1) Confirmación / cancelación en frases cortas ("sí", "dale", "no", "cancela")
    if _short_match(t, CONFIRM_CORE) and not _short_match(t, CANCEL_CORE):
        cmd.intent = Intent.CONFIRM
        return cmd
    if _short_match(t, CANCEL_CORE):
        cmd.intent = Intent.CANCEL
        return cmd
    if awaiting_confirmation:
        if t.startswith(CONFIRM_STARTS):
            cmd.intent = Intent.CONFIRM
            return cmd
        if t.startswith(CANCEL_STARTS_IN_CONTEXT):
            cmd.intent = Intent.CANCEL
            return cmd

    # 2) Parar navegación (antes que cancelar/navegar porque comparte palabras)
    if any(p in t for p in STOP_NAV_PHRASES):
        cmd.intent = Intent.STOP_NAVIGATION
        return cmd
    if t.startswith(CANCEL_STARTS):
        cmd.intent = Intent.CANCEL
        return cmd

    # 3) Alertas on/off
    if "alerta" in t:
        if any(
            w in t
            for w in (
                "silencia",
                "silenciar",
                "pausa",
                "pausar",
                "apaga",
                "desactiva",
                "quita",
                "calla",
            )
        ):
            cmd.intent, cmd.extra = Intent.TOGGLE_ALERTS, {"enabled": False}
            return cmd
        if any(w in t for w in ("activa", "activar", "reanuda", "enciende", "pon", "vuelve")):
            cmd.intent, cmd.extra = Intent.TOGGLE_ALERTS, {"enabled": True}
            return cmd

    # 4) Guardar lugar
    m = _SAVE_RE.search(t)
    if m:
        name = _clean_destination(m.group("name"))
        cmd.intent = Intent.SAVE_PLACE
        cmd.destination = name
        cmd.place_alias = resolve_alias(name) or name
        return cmd

    # 5) Uber / taxi
    m = _RIDE_RE.search(t)
    if m:
        cmd.intent = Intent.RIDE_REQUEST
        cmd.destination = _extract_destination(t[m.end() :])
        cmd.place_alias = resolve_alias(cmd.destination)
        return cmd

    # 6) Consultas rápidas
    if any(p in t for p in GLASSES_PHRASES):
        cmd.intent = Intent.CONNECT_GLASSES
        return cmd
    if any(p in t for p in WHERE_PHRASES):
        cmd.intent = Intent.WHERE_AM_I
        return cmd
    if any(p in t for p in DESCRIBE_PHRASES):
        cmd.intent = Intent.DESCRIBE_SCENE
        return cmd
    if any(p in t for p in REPEAT_PHRASES):
        cmd.intent = Intent.REPEAT
        return cmd
    if any(p in t for p in HELP_PHRASES):
        cmd.intent = Intent.HELP
        return cmd

    # 7) Navegación peatonal
    m = _NAV_RE.search(t)
    if m:
        dest = _extract_destination(t[m.end() :].strip())
        if dest:
            cmd.intent = Intent.NAVIGATE
            cmd.destination = dest
            cmd.place_alias = resolve_alias(dest)
            return cmd

    return cmd

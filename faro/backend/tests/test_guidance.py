from app.navigation.geo import destination_point
from app.navigation.google_maps import LatLng, Route, RouteStep
from app.navigation.guidance import RouteGuide

A = (19.4326, -99.1332)
B = destination_point(A, 0, 100)  # 100 m al norte
C = destination_point(B, 90, 60)  # luego 60 m al este


def ll(p):
    return LatLng(lat=p[0], lng=p[1])


def make_route() -> Route:
    steps = [
        RouteStep(
            instruction="Dirígete al norte",
            maneuver="DEPART",
            distance_m=100,
            duration_s=80,
            start=ll(A),
            end=ll(B),
            polyline=[A, B],
        ),
        RouteStep(
            instruction="Gira a la derecha hacia Calle Madero",
            maneuver="TURN_RIGHT",
            distance_m=60,
            duration_s=48,
            start=ll(B),
            end=ll(C),
            polyline=[B, C],
        ),
    ]
    return Route(
        steps=steps,
        distance_m=160,
        duration_s=128,
        polyline=[A, B, C],
        destination=ll(C),
        destination_name="Farmacia",
    )


def walk(guide, start, bearing, length, heading=None, t0=0.0, step=5):
    events = []
    for d in range(0, int(length) + 1, step):
        p = destination_point(start, bearing, d)
        events += guide.update(p[0], p[1], bearing if heading is None else heading, now=t0 + d)
    return events


def test_start_text_with_and_without_heading():
    guide = RouteGuide(make_route(), "Farmacia")
    assert guide.start_text() == (
        "Ruta a Farmacia: 160 metros, unos 2 minutos. Camina 100 metros hacia el norte."
    )
    assert "Primero gira a la izquierda." in guide.start_text(heading_deg=90)
    assert "Primero" not in guide.start_text(heading_deg=10)


def test_full_walk_sequence():
    guide = RouteGuide(make_route(), "Farmacia")
    events = walk(guide, A, 0, 100)
    events += walk(guide, B, 90, 60, t0=200)
    kinds = [e.kind for e in events]
    texts = [e.text for e in events]
    assert "progress" in kinds
    assert any(t.startswith("En ") and "gira a la derecha" in t for t in texts), texts
    assert any(
        t.startswith("Gira a la derecha hacia Calle Madero. Camina 60 metros hacia el este")
        for t in texts
    ), texts
    assert any("llegas a tu destino" in t for t in texts), texts
    assert events[-1].kind == "arrived"
    assert events[-1].text == "Has llegado a Farmacia. El destino está a las 12 en punto."
    assert guide.finished
    assert guide.update(C[0], C[1], 90, now=999) == []


def test_turn_instruction_is_announced_once():
    guide = RouteGuide(make_route(), "Farmacia")
    events = walk(guide, A, 0, 100)
    turns = [e for e in events if e.text.startswith("Gira a la derecha hacia")]
    assert len(turns) == 1
    pre = [e for e in events if e.text.startswith("En ")]
    assert len(pre) == 1


def test_off_route_triggers_reroute_after_three_fixes():
    guide = RouteGuide(make_route(), "Farmacia", reroute_threshold_m=25)
    mid = destination_point(A, 0, 50)
    off = destination_point(mid, 270, 60)  # 60 m al oeste de la ruta
    assert guide.update(off[0], off[1], 0, now=0) == []
    assert guide.update(off[0], off[1], 0, now=1) == []
    events = guide.update(off[0], off[1], 0, now=2)
    assert [e.kind for e in events] == ["reroute"]


def test_heading_correction_when_facing_wrong_way():
    guide = RouteGuide(make_route(), "Farmacia")
    p = destination_point(A, 0, 30)
    events = []
    for now in (0, 1, 2, 3, 4):
        events += guide.update(p[0], p[1], heading_deg=90, now=now)
    corrections = [e for e in events if e.kind == "correction"]
    assert len(corrections) == 1
    assert corrections[0].text == "Gira a la izquierda para seguir la ruta."


def test_remaining_distance():
    guide = RouteGuide(make_route(), "Farmacia")
    assert abs(guide.remaining_m(A) - 160) < 1

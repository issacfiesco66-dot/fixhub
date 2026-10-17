import pytest

from app.navigation.geo import (
    cardinal_es,
    clock_position_es,
    decode_polyline,
    destination_point,
    distance_to_polyline_m,
    haversine_m,
    initial_bearing_deg,
    relative_angle,
    round_to,
    turn_phrase_es,
)

ORIGIN = (19.4326, -99.1332)


def test_haversine_one_degree_longitude_at_equator():
    assert haversine_m((0.0, 0.0), (0.0, 1.0)) == pytest.approx(111_195, abs=100)


def test_bearing_cardinals():
    assert initial_bearing_deg((0.0, 0.0), (1.0, 0.0)) == pytest.approx(0.0, abs=1e-6)
    assert initial_bearing_deg((0.0, 0.0), (0.0, 1.0)) == pytest.approx(90.0, abs=1e-6)
    assert cardinal_es(0) == "norte"
    assert cardinal_es(45) == "noreste"
    assert cardinal_es(90) == "este"
    assert cardinal_es(180) == "sur"
    assert cardinal_es(270) == "oeste"
    assert cardinal_es(359) == "norte"


def test_relative_angle_and_turn_phrase():
    assert relative_angle(350, 10) == pytest.approx(20)
    assert relative_angle(10, 350) == pytest.approx(-20)
    assert turn_phrase_es(5) == "sigue recto"
    assert turn_phrase_es(20) == "gira ligeramente a la derecha"
    assert turn_phrase_es(-90) == "gira a la izquierda"
    assert turn_phrase_es(170) == "da media vuelta"


def test_clock_position():
    assert clock_position_es(0) == "a las 12 en punto"
    assert clock_position_es(30) == "a las 1 en punto"
    assert clock_position_es(-90) == "a las 9 en punto"
    assert clock_position_es(180) == "a las 6 en punto"


def test_decode_polyline_google_example():
    pts = decode_polyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")
    assert pts == [
        pytest.approx((38.5, -120.2)),
        pytest.approx((40.7, -120.95)),
        pytest.approx((43.252, -126.453)),
    ]


def test_destination_point_roundtrip():
    p = destination_point(ORIGIN, 90, 100)
    assert haversine_m(ORIGIN, p) == pytest.approx(100, abs=0.5)
    assert initial_bearing_deg(ORIGIN, p) == pytest.approx(90, abs=0.1)


def test_distance_to_polyline():
    a = ORIGIN
    b = destination_point(a, 0, 200)
    mid = destination_point(a, 0, 100)
    off = destination_point(mid, 90, 30)
    dist, seg, frac = distance_to_polyline_m(off, [a, b])
    assert dist == pytest.approx(30, abs=1)
    assert seg == 0
    assert frac == pytest.approx(0.5, abs=0.02)


def test_round_to():
    assert round_to(23) == 25
    assert round_to(2) == 5
    assert round_to(163, 10) == 160

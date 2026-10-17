from app.vision.alert_policy import AlertPolicy
from app.vision.hazards import BBox, Detection
from app.vision.hazards import HazardClass as H


def det(hazard, cx=0.5, dist=None, conf=0.9):
    return Detection(hazard, conf, BBox(cx - 0.1, 0.5, cx + 0.1, 0.9), distance_m=dist)


def test_prioritizes_dangerous_over_nearer_person():
    policy = AlertPolicy()
    alert = policy.select([det(H.PERSON, dist=2.0), det(H.STAIRS_DOWN, dist=4.0)], now=0.0)
    assert alert is not None
    assert alert.hazard is H.STAIRS_DOWN
    assert alert.interrupt is True
    assert alert.text == "Escalera bajando al frente, 4 metros"


def test_cooldown_blocks_repeat_then_allows():
    policy = AlertPolicy(cooldown_s=3.0, min_interval_s=0.0)
    assert policy.select([det(H.STAIRS_DOWN, dist=4.0)], now=0.0) is not None
    assert policy.select([det(H.STAIRS_DOWN, dist=4.0)], now=1.0) is None
    assert policy.select([det(H.STAIRS_DOWN, dist=4.0)], now=3.5) is not None


def test_approaching_overrides_cooldown():
    policy = AlertPolicy(cooldown_s=3.0, min_interval_s=0.0)
    policy.select([det(H.STAIRS_DOWN, dist=4.0)], now=0.0)
    alert = policy.select([det(H.STAIRS_DOWN, dist=2.0)], now=1.0)
    assert alert is not None and "2 metros" in alert.text


def test_min_interval_defers_low_priority_but_not_vehicle():
    policy = AlertPolicy(cooldown_s=3.0, min_interval_s=1.2)
    assert policy.select([det(H.STAIRS_DOWN, dist=4.0)], now=0.0) is not None
    assert policy.select([det(H.PERSON, cx=0.2, dist=2.0)], now=0.5) is None
    vehicle = policy.select([det(H.VEHICLE, cx=0.8, dist=5.0)], now=0.6)
    assert vehicle is not None and vehicle.priority == 0
    assert vehicle.text == "Vehículo a la derecha, 5 metros"


def test_far_objects_ignored_except_vehicles():
    policy = AlertPolicy(max_distance_m=8.0, vehicle_max_distance_m=15.0)
    assert policy.select([det(H.PERSON, dist=12.0)], now=0.0) is None
    assert policy.select([det(H.VEHICLE, dist=12.0)], now=0.0) is not None


def test_same_hazard_different_zones_are_independent():
    policy = AlertPolicy(cooldown_s=3.0, min_interval_s=0.0)
    assert policy.select([det(H.POLE, cx=0.2, dist=3.0)], now=0.0) is not None
    right = policy.select([det(H.POLE, cx=0.8, dist=3.0)], now=0.5)
    assert right is not None and right.zone == "right"


def test_nothing_when_empty_or_reset():
    policy = AlertPolicy()
    assert policy.select([], now=0.0) is None
    policy.select([det(H.STAIRS_DOWN, dist=4.0)], now=0.0)
    policy.reset()
    assert policy.select([det(H.STAIRS_DOWN, dist=4.0)], now=0.1) is not None

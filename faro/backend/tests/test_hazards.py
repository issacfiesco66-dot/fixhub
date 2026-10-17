from app.vision.hazards import (
    BBox,
    Detection,
    HazardClass,
    alert_text_es,
    estimate_distance_m,
    focal_length_px,
    horizontal_zone,
    vertical_zone,
)


def test_alert_text_stairs_metric():
    det = Detection(HazardClass.STAIRS_DOWN, 0.9, BBox(0.4, 0.6, 0.6, 0.95), distance_m=2.0)
    assert alert_text_es(det) == "Escalera bajando al frente, 2 metros"


def test_alert_text_cable_top_without_distance():
    det = Detection(HazardClass.HANGING_CABLE, 0.8, BBox(0.45, 0.05, 0.55, 0.15))
    assert alert_text_es(det) == "Cable al frente, arriba"


def test_alert_text_vehicle_right_very_close():
    det = Detection(HazardClass.VEHICLE, 0.9, BBox(0.7, 0.3, 1.0, 0.9), distance_m=1.2)
    assert alert_text_es(det) == "Vehículo a la derecha, muy cerca"


def test_alert_text_qualitative_close():
    det = Detection(HazardClass.OBSTACLE, 0.7, BBox(0.0, 0.3, 0.3, 0.9))  # área 0.18
    assert alert_text_es(det) == "Obstáculo a la izquierda, cerca"


def test_alert_text_single_meter():
    det = Detection(HazardClass.POTHOLE, 0.7, BBox(0.4, 0.7, 0.6, 0.9), distance_m=1.6)
    assert alert_text_es(det) == "Bache al frente, 2 metros"
    det.distance_m = 1.5
    assert alert_text_es(det) == "Bache al frente, 2 metros"


def test_distance_estimate_pinhole():
    focal = focal_length_px(640, 90)
    assert round(focal) == 320
    assert estimate_distance_m("person", 170 / 480, 480, focal) == 3.2
    assert estimate_distance_m("pole", 0.5, 480, focal) is None  # sin altura de referencia
    assert estimate_distance_m("person", 0.0, 480, focal) is None


def test_zones():
    assert horizontal_zone(0.1) == "left"
    assert horizontal_zone(0.5) == "center"
    assert horizontal_zone(0.9) == "right"
    assert vertical_zone(0.1) == "top"
    assert vertical_zone(0.5) == "middle"
    assert vertical_zone(0.9) == "bottom"

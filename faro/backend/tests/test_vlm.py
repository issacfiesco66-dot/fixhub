import io

from PIL import Image

from app.vision.hazards import HazardClass
from app.vision.vlm import (
    HAZARD_SCHEMA,
    encode_jpeg_b64,
    parse_vlm_json,
    vlm_hazard_to_detection,
)


def test_parse_valid_json_and_convert():
    result = parse_vlm_json(
        '{"hazards": [{"kind": "stairs_down", "horizontal": "center", "vertical": "bottom",'
        ' "distance_m": 2.5, "confidence": 0.8}], "scene": "acera con escaleras"}'
    )
    assert len(result.hazards) == 1 and result.scene == "acera con escaleras"
    det = vlm_hazard_to_detection(result.hazards[0])
    assert det.hazard is HazardClass.STAIRS_DOWN
    assert det.zone == "center" and det.vertical == "bottom"
    assert det.distance_m == 2.5 and det.source == "vlm"


def test_parse_invalid_json_returns_empty():
    assert parse_vlm_json("no es json").hazards == []
    assert parse_vlm_json('{"hazards": [{"kind": "dragon"}], "scene": ""}').hazards == []


def test_schema_lists_all_hazard_kinds():
    kinds = HAZARD_SCHEMA["properties"]["hazards"]["items"]["properties"]["kind"]["enum"]
    assert set(kinds) == {h.value for h in HazardClass}


def test_encode_jpeg_downscales():
    img = Image.new("RGB", (1600, 1200), (10, 20, 30))
    import base64

    data = base64.b64decode(encode_jpeg_b64(img, max_edge_px=800))
    out = Image.open(io.BytesIO(data))
    assert max(out.size) <= 800 and out.format == "JPEG"

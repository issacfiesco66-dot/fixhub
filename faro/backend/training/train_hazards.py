"""Fine-tuning de YOLOv8 para peligros de acera y exportación para el teléfono.

Uso:
  python train_hazards.py --data hazards.yaml --epochs 80
  python train_hazards.py --export runs/hazards/weights/best.pt      # TFLite + CoreML + ONNX

Después: YOLO_HAZARD_MODEL_PATH=training/runs/hazards/weights/best.pt en el backend.
Los nombres de clase de hazards.yaml coinciden con HazardClass (app/vision/hazards.py).
"""

from __future__ import annotations

import argparse
from pathlib import Path


def train(data: str, epochs: int, imgsz: int, batch: int, base: str, project: str) -> Path:
    from ultralytics import YOLO

    model = YOLO(base)
    results = model.train(
        data=data,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        project=project,
        name="hazards",
        exist_ok=True,
        # Aumentos útiles para cámara en movimiento a la altura de los ojos.
        degrees=5.0,
        translate=0.1,
        scale=0.4,
        fliplr=0.5,
        mosaic=1.0,
        close_mosaic=10,
        patience=20,
    )
    best = Path(results.save_dir) / "weights" / "best.pt"
    print(f"Mejor modelo: {best}")
    return best


def export(weights: str, imgsz: int) -> None:
    from ultralytics import YOLO

    model = YOLO(weights)
    for fmt in ("onnx", "tflite", "coreml"):
        try:
            out = model.export(format=fmt, imgsz=imgsz, half=False, int8=False)
            print(f"{fmt}: {out}")
        except Exception as exc:  # noqa: BLE001 - cada formato depende del SO/toolchain
            print(f"{fmt}: no exportado ({exc})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", default="hazards.yaml")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--base", default="yolov8n.pt", help="pesos de partida (n/s/m)")
    parser.add_argument("--project", default="runs")
    parser.add_argument("--export", metavar="WEIGHTS", help="solo exportar estos pesos")
    args = parser.parse_args()
    if args.export:
        export(args.export, args.imgsz)
        return
    best = train(args.data, args.epochs, args.imgsz, args.batch, args.base, args.project)
    export(str(best), args.imgsz)


if __name__ == "__main__":
    main()

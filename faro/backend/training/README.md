# Entrenamiento del detector de peligros de acera

El modelo COCO de YOLOv8 reconoce vehículos, personas, bicis y animales, pero **no** escaleras, cables colgando, postes ni baches. Hasta tener este modelo, esos peligros los detecta el VLM (Claude) cada pocos segundos; con el modelo fine-tuned pasan al bucle rápido (decenas de ms).

## 1. Datos
* **Graba tú mismo** con las gafas (o un teléfono a la altura de los ojos) en los barrios donde operarás: distintas horas, lluvia, sombras. 1-2 h de vídeo a 1 fps ≈ 5.000 imágenes.
* Complementa con conjuntos públicos con licencia compatible: busca en Roboflow Universe ("sidewalk obstacles", "stairs detection", "pothole"); Mapillary Vistas y Cityscapes incluyen `pole`, `curb` y `manhole` (requieren conversión de segmentación a cajas).
* Etiqueta en Roboflow, CVAT o Label Studio con las 6 clases de `hazards.yaml`. Regla de oro: **etiqueta el borde de la escalera que baja**, no toda la escalera; para cables, solo los que están por debajo de 2,2 m.
* División 80/20 por sesión de grabación (no por fotograma) para no inflar la métrica.

## 2. Entrenar
```bash
pip install -e "..[vision]"
python train_hazards.py --data hazards.yaml --epochs 80 --base yolov8n.pt
```
Objetivos mínimos antes de usarlo con personas: recall ≥ 0,90 en `stairs_down` y `pothole` a IoU 0,5, precisión ≥ 0,80 en todas las clases. En el teléfono, yolov8n a 640 px corre a >15 fps en gama media.

## 3. Usar
* Backend: `YOLO_HAZARD_MODEL_PATH=training/runs/hazards/weights/best.pt`.
* Teléfono (futuro): `python train_hazards.py --export runs/hazards/weights/best.pt` genera TFLite/CoreML/ONNX.

## 4. Evaluación continua
Guarda (con consentimiento) los fotogramas de las alertas que los usuarios marquen como falsas ("eso no era una escalera") y reentrena mensualmente.

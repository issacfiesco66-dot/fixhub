import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;

import '../core/config.dart';

/// Fuente de fotogramas JPEG. Dos implementaciones:
///  * [GlassesFrameSource]: gafas Meta a través del puente nativo (Meta Wearables Device Access
///    Toolkit). `isAvailable` es true cuando la app ya está registrada en Meta AI y hay gafas
///    vinculadas; `connect()` inicia el registro y pide el permiso de cámara.
///  * [PhoneCameraFrameSource]: cámara trasera del teléfono (desarrollo y respaldo).
abstract class FrameSource {
  String get name;
  Stream<Uint8List> get frames;
  Future<bool> isAvailable();
  Future<void> start();
  Future<void> stop();
}

/// Elige las gafas si están emparejadas; si no, la cámara del teléfono.
class FrameSourceSelector {
  static Future<FrameSource> pick() async {
    final glasses = GlassesFrameSource();
    if (await glasses.isAvailable()) return glasses;
    return PhoneCameraFrameSource();
  }
}

class GlassesFrameSource implements FrameSource {
  static const MethodChannel _method = MethodChannel('faro/glasses');
  static const EventChannel _events = EventChannel('faro/glasses/frames');

  final StreamController<Uint8List> _controller = StreamController.broadcast();
  StreamSubscription<dynamic>? _sub;

  @override
  String get name => 'glasses';

  @override
  Stream<Uint8List> get frames => _controller.stream;

  @override
  Future<bool> isAvailable() async {
    try {
      return await _method.invokeMethod<bool>('isAvailable') ?? false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }

  /// Registro con Meta AI y permiso de cámara en las gafas (abre la app Meta AI).
  /// Lanza [PlatformException] con código `sdk_missing`, `permission_denied`,
  /// `registration_unavailable` o `connect_failed`.
  Future<void> connect() async {
    await _method.invokeMethod<void>('connect');
  }

  @override
  Future<void> start() async {
    _sub = _events.receiveBroadcastStream().listen((dynamic data) {
      if (data is Uint8List) _controller.add(data);
    });
    await _method.invokeMethod<void>('startStream', {'maxWidth': AppConfig.frameMaxWidth});
  }

  @override
  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
    try {
      await _method.invokeMethod<void>('stopStream');
    } on PlatformException {
      // ya detenido
    }
  }
}

class PhoneCameraFrameSource implements FrameSource {
  PhoneCameraFrameSource({Duration? interval})
      : interval = interval ?? const Duration(milliseconds: AppConfig.frameIntervalMs);

  final Duration interval;
  CameraController? _camera;
  final StreamController<Uint8List> _controller = StreamController.broadcast();
  DateTime _last = DateTime.fromMillisecondsSinceEpoch(0);
  bool _busy = false;

  @override
  String get name => 'phone_camera';

  @override
  Stream<Uint8List> get frames => _controller.stream;

  @override
  Future<bool> isAvailable() async => (await availableCameras()).isNotEmpty;

  @override
  Future<void> start() async {
    final cameras = await availableCameras();
    final back = cameras.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.back,
      orElse: () => cameras.first,
    );
    final camera = CameraController(
      back,
      ResolutionPreset.medium,
      enableAudio: false,
      imageFormatGroup: Platform.isIOS ? ImageFormatGroup.bgra8888 : ImageFormatGroup.yuv420,
    );
    await camera.initialize();
    await camera.startImageStream(_onImage);
    _camera = camera;
  }

  Future<void> _onImage(CameraImage image) async {
    final now = DateTime.now();
    if (_busy || now.difference(_last) < interval) return;
    _busy = true;
    _last = now;
    try {
      final frame = RawFrame.fromCameraImage(image);
      final jpeg = await compute(encodeFrameToJpeg, frame);
      _controller.add(jpeg);
    } finally {
      _busy = false;
    }
  }

  @override
  Future<void> stop() async {
    final camera = _camera;
    _camera = null;
    if (camera == null) return;
    if (camera.value.isStreamingImages) await camera.stopImageStream();
    await camera.dispose();
  }
}

/// Copia serializable de un [CameraImage] para procesarla en un isolate.
class RawFrame {
  RawFrame({
    required this.width,
    required this.height,
    required this.format,
    required this.planes,
    required this.bytesPerRow,
    required this.bytesPerPixel,
  });

  factory RawFrame.fromCameraImage(CameraImage image) => RawFrame(
        width: image.width,
        height: image.height,
        format: image.format.group,
        planes: image.planes.map((p) => p.bytes).toList(),
        bytesPerRow: image.planes.map((p) => p.bytesPerRow).toList(),
        bytesPerPixel: image.planes.map((p) => p.bytesPerPixel ?? 1).toList(),
      );

  final int width;
  final int height;
  final ImageFormatGroup format;
  final List<Uint8List> planes;
  final List<int> bytesPerRow;
  final List<int> bytesPerPixel;
}

/// Convierte YUV420 (Android) o BGRA8888 (iOS) a JPEG reescalado. Se ejecuta en un isolate.
Uint8List encodeFrameToJpeg(RawFrame frame) {
  img.Image image;
  if (frame.format == ImageFormatGroup.bgra8888) {
    image = img.Image.fromBytes(
      width: frame.width,
      height: frame.height,
      bytes: frame.planes[0].buffer,
      rowStride: frame.bytesPerRow[0],
      order: img.ChannelOrder.bgra,
    );
  } else {
    image = _yuv420ToImage(frame);
  }
  if (image.width > AppConfig.frameMaxWidth) {
    image = img.copyResize(image, width: AppConfig.frameMaxWidth);
  }
  return Uint8List.fromList(img.encodeJpg(image, quality: 60));
}

img.Image _yuv420ToImage(RawFrame frame) {
  final w = frame.width;
  final h = frame.height;
  final out = img.Image(width: w, height: h);
  final yPlane = frame.planes[0];
  final uPlane = frame.planes[1];
  final vPlane = frame.planes[2];
  final yRow = frame.bytesPerRow[0];
  final uvRow = frame.bytesPerRow[1];
  final uvPix = frame.bytesPerPixel[1];
  for (var y = 0; y < h; y++) {
    final uvY = (y >> 1) * uvRow;
    for (var x = 0; x < w; x++) {
      final uvIndex = uvY + (x >> 1) * uvPix;
      final yp = yPlane[y * yRow + x];
      final up = uPlane[uvIndex] - 128;
      final vp = vPlane[uvIndex] - 128;
      final r = (yp + 1.402 * vp).round().clamp(0, 255);
      final g = (yp - 0.344136 * up - 0.714136 * vp).round().clamp(0, 255);
      final b = (yp + 1.772 * up).round().clamp(0, 255);
      out.setPixelRgb(x, y, r, g, b);
    }
  }
  return out;
}

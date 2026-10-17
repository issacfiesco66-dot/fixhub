import 'dart:async';

import 'package:flutter_compass/flutter_compass.dart';
import 'package:geolocator/geolocator.dart';

class LocationFix {
  const LocationFix({
    required this.lat,
    required this.lng,
    this.heading,
    this.speed,
    this.accuracy,
  });
  final double lat;
  final double lng;
  final double? heading; // brújula (grados)
  final double? speed; // m/s
  final double? accuracy; // m
}

/// GPS + brújula. Emite como máximo una posición por segundo y usa la brújula del
/// teléfono para el rumbo (más fiable que el rumbo GPS a velocidad de peatón).
class LocationService {
  final StreamController<LocationFix> _controller = StreamController.broadcast();
  StreamSubscription<Position>? _posSub;
  StreamSubscription<CompassEvent>? _compassSub;
  double? _heading;
  Position? _last;
  DateTime _lastEmit = DateTime.fromMillisecondsSinceEpoch(0);

  Stream<LocationFix> get fixes => _controller.stream;
  double? get heading => _heading;

  Future<bool> ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  Future<void> start() async {
    _compassSub = FlutterCompass.events?.listen((event) {
      _heading = event.heading;
      // El rumbo cambia sin moverse: reemitir la última posición con el nuevo rumbo.
      final last = _last;
      if (last != null) _emit(last, force: false);
    });
    const settings = LocationSettings(accuracy: LocationAccuracy.best, distanceFilter: 2);
    _posSub = Geolocator.getPositionStream(locationSettings: settings).listen((pos) {
      _last = pos;
      _emit(pos, force: true);
    });
  }

  void _emit(Position pos, {required bool force}) {
    final now = DateTime.now();
    if (!force && now.difference(_lastEmit) < const Duration(seconds: 1)) return;
    _lastEmit = now;
    final heading = _heading ?? (pos.speed > 0.7 && pos.heading >= 0 ? pos.heading : null);
    _controller.add(LocationFix(
      lat: pos.latitude,
      lng: pos.longitude,
      heading: heading,
      speed: pos.speed,
      accuracy: pos.accuracy,
    ));
  }

  Future<void> stop() async {
    await _posSub?.cancel();
    await _compassSub?.cancel();
  }
}

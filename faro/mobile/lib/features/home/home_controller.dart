import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/config.dart';
import '../../core/protocol.dart';
import '../../services/backend_session.dart';
import '../../services/frame_source.dart';
import '../../services/haptics.dart';
import '../../services/location_service.dart';
import '../../services/speech_output.dart';
import '../../services/voice_input.dart';

/// Acciones que expone la pantalla (gestos y acciones de accesibilidad).
abstract class HomeActions {
  Future<void> startListening();
  Future<void> stopListeningAndSend();
  Future<void> toggleListening();
  Future<void> cancel();
  Future<void> repeatLast();
  Future<void> whereAmI();
  Future<void> describeScene();
  Future<void> toggleAlerts();
}

enum FaroStatus { starting, ready, listening, thinking, offline }

class HomeController extends ChangeNotifier implements HomeActions {
  HomeController({
    required SpeechOutput speech,
    required BackendSession backend,
    required LocationService location,
    required VoiceRecorder recorder,
    Future<FrameSource> Function()? pickFrameSource,
    Future<bool> Function(String url)? openUrl,
  })  : _speech = speech,
        _backend = backend,
        _location = location,
        _recorder = recorder,
        _pickFrameSource = pickFrameSource ?? FrameSourceSelector.pick,
        _openUrl = openUrl ?? _launch;

  factory HomeController.production() => HomeController(
        speech: SpeechOutput(FlutterTtsEngine()),
        backend: BackendSession(),
        location: LocationService(),
        recorder: VoiceRecorder(),
      );

  final SpeechOutput _speech;
  final BackendSession _backend;
  final LocationService _location;
  final VoiceRecorder _recorder;
  final Future<FrameSource> Function() _pickFrameSource;
  final Future<bool> Function(String url) _openUrl;

  FrameSource? _frames;
  final List<StreamSubscription<dynamic>> _subs = [];
  Timer? _maxRecordingTimer;

  FaroStatus status = FaroStatus.starting;
  bool alertsEnabled = true;
  bool navigating = false;
  String? pending;
  String statusText = 'Iniciando Faro';
  String frameSourceName = '';

  static Future<bool> _launch(String url) =>
      launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

  Future<void> init() async {
    await _speech.init();
    await WakelockPlus.enable();
    await _speech.say('Faro iniciando.', priority: 2);

    final granted = await _requestPermissions();
    if (!granted) {
      _setStatus(FaroStatus.offline, 'Faltan permisos');
      await _speech.say(
        'Faro necesita permiso de cámara, micrófono y ubicación. Actívalos en Ajustes.',
        priority: 1,
      );
      return;
    }

    try {
      await _backend.connect();
    } catch (_) {
      _setStatus(FaroStatus.offline, 'Sin conexión con el servidor');
      await _speech.say('No puedo conectar con el servidor. Reintentando.', priority: 1);
    }
    _subs.add(_backend.messages.listen(_onServerMessage));
    _subs.add(_backend.connectionChanges.listen((up) {
      if (up && status == FaroStatus.offline) _setStatus(FaroStatus.ready, 'Faro listo');
      if (!up) _setStatus(FaroStatus.offline, 'Reconectando');
    }));

    await _location.start();
    _subs.add(_location.fixes.listen((fix) => _backend.sendLocation(
          lat: fix.lat,
          lng: fix.lng,
          heading: fix.heading,
          speed: fix.speed,
          accuracy: fix.accuracy,
        )));

    try {
      final source = await _pickFrameSource();
      await source.start();
      _frames = source;
      frameSourceName = source.name;
      _subs.add(source.frames.listen(_backend.sendFrame));
    } catch (e) {
      debugPrint('Sin fuente de vídeo: $e');
      await _speech.say('No pude iniciar la cámara. Las alertas de obstáculos no estarán activas.',
          priority: 1);
    }

    if (status != FaroStatus.offline) _setStatus(FaroStatus.ready, 'Faro listo');
    await _speech.say(
      'Faro listo. Mantén presionada la pantalla para hablar. '
      '${frameSourceName == 'glasses' ? 'Gafas conectadas.' : 'Usando la cámara del teléfono.'}',
      priority: 2,
    );
  }

  Future<bool> _requestPermissions() async {
    final statuses = await [
      Permission.camera,
      Permission.microphone,
      Permission.locationWhenInUse,
    ].request();
    final okLocation = await _location.ensurePermission();
    return statuses.values.every((s) => s.isGranted || s.isLimited) && okLocation;
  }

  // ------------------------------------------------------------------ mensajes del servidor
  Future<void> _onServerMessage(ServerMessage msg) async {
    switch (msg) {
      case AlertMessage m:
        if (!alertsEnabled) return;
        unawaited(Haptics.play(m.priority <= 1 ? 'danger' : 'warning'));
        await _speech.say(m.text, priority: m.priority, interrupt: m.interrupt);
      case SpeakMessage m:
        await _speech.say(m.text, priority: m.priority, interrupt: m.interrupt);
      case NavMessage m:
        if (m.event == 'arrived') unawaited(Haptics.play('success'));
        await _speech.say(m.text, priority: m.priority, interrupt: m.priority <= 1);
      case HapticMessage m:
        unawaited(Haptics.play(m.pattern));
      case OpenUrlMessage m:
        final ok = await _openUrl(m.url);
        if (!ok) await _speech.say('No pude abrir la app de Uber.', priority: 1);
      case StateMessage m:
        alertsEnabled = m.alertsEnabled;
        navigating = m.navigating;
        pending = m.pending;
        notifyListeners();
      case ErrorMessage m:
        debugPrint('Backend error: ${m.message}');
      case UnknownMessage _:
        break;
    }
  }

  // ------------------------------------------------------------------ acciones
  @override
  Future<void> startListening() async {
    if (status == FaroStatus.listening) return;
    if (!await _recorder.hasPermission()) {
      await _speech.say('Necesito permiso de micrófono.', priority: 1);
      return;
    }
    await _speech.stopAll(); // no grabar la propia voz del asistente
    unawaited(SystemSound.play(SystemSoundType.click));
    unawaited(HapticFeedback.selectionClick());
    await _recorder.start();
    _setStatus(FaroStatus.listening, 'Escuchando');
    _maxRecordingTimer?.cancel();
    _maxRecordingTimer = Timer(AppConfig.maxRecording, () => stopListeningAndSend());
  }

  @override
  Future<void> stopListeningAndSend() async {
    _maxRecordingTimer?.cancel();
    if (status != FaroStatus.listening) return;
    _setStatus(FaroStatus.thinking, 'Procesando');
    unawaited(HapticFeedback.lightImpact());
    final Uint8List? audio = await _recorder.stop();
    if (audio == null) {
      _setStatus(FaroStatus.ready, 'Faro listo');
      await _speech.say('No te escuché. Mantén presionado mientras hablas.', priority: 2);
      return;
    }
    try {
      final replies = await _backend.sendVoice(audio);
      for (final reply in replies) {
        await _onServerMessage(reply);
      }
    } catch (e) {
      debugPrint('voice error: $e');
      await _speech.say('No pude procesar el comando. Revisa la conexión.', priority: 1);
    } finally {
      _setStatus(FaroStatus.ready, 'Faro listo');
    }
  }

  /// Modo lector de pantalla: una activación inicia, otra (o el tiempo máximo) envía.
  @override
  Future<void> toggleListening() =>
      status == FaroStatus.listening ? stopListeningAndSend() : startListening();

  @override
  Future<void> cancel() async {
    _maxRecordingTimer?.cancel();
    if (status == FaroStatus.listening) {
      await _recorder.cancel();
      _setStatus(FaroStatus.ready, 'Faro listo');
      await _speech.say('Cancelado.', priority: 1, interrupt: true);
      return;
    }
    await _speech.stopAll();
    _backend.sendUtterance('cancelar');
  }

  @override
  Future<void> repeatLast() => _speech.repeatLast();

  @override
  Future<void> whereAmI() async => _backend.sendUtterance('dónde estoy');

  @override
  Future<void> describeScene() async => _backend.sendUtterance('qué hay delante');

  @override
  Future<void> toggleAlerts() async =>
      _backend.sendUtterance(alertsEnabled ? 'silenciar alertas' : 'activar alertas');

  void _setStatus(FaroStatus s, String text) {
    status = s;
    statusText = text;
    notifyListeners();
  }

  @override
  void dispose() {
    _maxRecordingTimer?.cancel();
    for (final s in _subs) {
      unawaited(s.cancel());
    }
    unawaited(_frames?.stop());
    unawaited(_location.stop());
    unawaited(_recorder.dispose());
    unawaited(_backend.dispose());
    unawaited(WakelockPlus.disable());
    super.dispose();
  }
}

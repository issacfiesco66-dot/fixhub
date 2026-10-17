import 'dart:async';
import 'dart:collection';

import 'package:flutter_tts/flutter_tts.dart';

import '../core/config.dart';

/// Motor TTS abstracto (permite inyectar un falso en tests).
abstract class TtsEngine {
  Future<void> init();
  Future<void> speak(String text); // debe completarse cuando termina de hablar
  Future<void> stop();
}

class FlutterTtsEngine implements TtsEngine {
  final FlutterTts _tts = FlutterTts();

  @override
  Future<void> init() async {
    await _tts.setLanguage(AppConfig.ttsLocale);
    // Las personas ciegas suelen preferir una voz algo más rápida que la normal.
    await _tts.setSpeechRate(0.55);
    await _tts.setPitch(1.0);
    await _tts.awaitSpeakCompletion(true);
  }

  @override
  Future<void> speak(String text) async {
    await _tts.speak(text);
  }

  @override
  Future<void> stop() async {
    await _tts.stop();
  }
}

class _Utterance {
  _Utterance(this.text, this.priority, this.seq);
  final String text;
  final int priority; // 0 = más urgente
  final int seq;
}

/// Cola de voz con prioridades.
///
/// * `priority <= 1` o `interrupt == true` cortan lo que se esté diciendo (alertas de peligro).
/// * El resto se encola y se reproduce en orden de prioridad y llegada.
/// * Se recuerda la última frase para el comando "repite".
class SpeechOutput {
  SpeechOutput(this._engine);

  final TtsEngine _engine;
  final SplayTreeSet<_Utterance> _queue = SplayTreeSet<_Utterance>(
    (a, b) => a.priority != b.priority ? a.priority.compareTo(b.priority) : a.seq.compareTo(b.seq),
  );
  int _seq = 0;
  bool _speaking = false;
  bool _muted = false;
  String? lastSpoken;

  bool get isSpeaking => _speaking;
  int get pendingCount => _queue.length;

  Future<void> init() => _engine.init();

  void setMuted(bool muted) => _muted = muted;

  Future<void> say(String text, {int priority = 2, bool interrupt = false}) async {
    if (text.trim().isEmpty || _muted) return;
    final urgent = interrupt || priority <= 1;
    if (urgent) {
      // Descarta lo menos importante que estuviera esperando.
      _queue.removeWhere((u) => u.priority > priority);
    }
    _queue.add(_Utterance(text, priority, _seq++));
    if (urgent && _speaking) {
      // Corta la voz actual; el bucle de reproducción en curso continúa con la cola,
      // que ya contiene el mensaje urgente al frente.
      await _engine.stop();
    } else {
      unawaited(_drain());
    }
  }

  Future<void> stopAll() async {
    _queue.clear();
    await _engine.stop();
    _speaking = false;
  }

  Future<void> repeatLast() async {
    final last = lastSpoken;
    if (last != null) await say(last, priority: 2, interrupt: true);
  }

  Future<void> _drain() async {
    if (_speaking) return;
    _speaking = true;
    try {
      while (_queue.isNotEmpty) {
        final next = _queue.first;
        _queue.remove(next);
        lastSpoken = next.text;
        // Timeout de seguridad: un motor TTS colgado no debe bloquear las alertas.
        await _engine.speak(next.text).timeout(const Duration(seconds: 20), onTimeout: () {});
      }
    } finally {
      _speaking = false;
    }
  }
}

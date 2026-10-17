import 'dart:async';

import 'package:faro_app/services/speech_output.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeEngine implements TtsEngine {
  final List<String> spoken = [];
  int stops = 0;
  Completer<void>? current;

  @override
  Future<void> init() async {}

  @override
  Future<void> speak(String text) {
    spoken.add(text);
    current = Completer<void>();
    return current!.future;
  }

  @override
  Future<void> stop() async {
    stops++;
    current?.complete();
    current = null;
  }

  void finishCurrent() {
    current?.complete();
    current = null;
  }
}

void main() {
  test('una alerta urgente interrumpe la frase en curso y descarta las menos importantes',
      () async {
    final engine = FakeEngine();
    final out = SpeechOutput(engine);
    await out.say('Ruta a farmacia, 300 metros', priority: 2);
    await out.say('Sigue recto', priority: 3);
    expect(engine.spoken, ['Ruta a farmacia, 300 metros']);
    await out.say('Escalera bajando al frente, 2 metros', priority: 1, interrupt: true);
    await Future<void>.delayed(Duration.zero);
    expect(engine.stops, 1);
    expect(engine.spoken.last, 'Escalera bajando al frente, 2 metros');
    expect(out.pendingCount, 0); // "Sigue recto" fue descartado
  });

  test('las frases normales se encolan en orden de prioridad', () async {
    final engine = FakeEngine();
    final out = SpeechOutput(engine);
    await out.say('primera', priority: 2);
    await out.say('tercera', priority: 3);
    await out.say('segunda', priority: 2);
    engine.finishCurrent();
    await Future<void>.delayed(Duration.zero);
    engine.finishCurrent();
    await Future<void>.delayed(Duration.zero);
    engine.finishCurrent();
    await Future<void>.delayed(Duration.zero);
    expect(engine.spoken, ['primera', 'segunda', 'tercera']);
    expect(out.lastSpoken, 'tercera');
  });

  test('silenciado no habla', () async {
    final engine = FakeEngine();
    final out = SpeechOutput(engine)..setMuted(true);
    await out.say('hola');
    expect(engine.spoken, isEmpty);
  });
}

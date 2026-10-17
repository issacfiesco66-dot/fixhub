import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

/// Grabación push-to-talk. El audio (AAC mono 16 kHz) se envía al backend, que lo
/// transcribe con la API de OpenAI (gpt-4o-mini-transcribe / whisper-1).
class VoiceRecorder {
  final AudioRecorder _recorder = AudioRecorder();
  String? _path;

  bool get isRecording => _path != null;

  Future<bool> hasPermission() => _recorder.hasPermission();

  Future<void> start() async {
    if (_path != null) return;
    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/faro_cmd_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _recorder.start(
      RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 64000,
        sampleRate: 16000,
        numChannels: 1,
      ),
      path: path,
    );
    _path = path;
  }

  /// Detiene la grabación y devuelve los bytes (null si no había grabación o quedó vacía).
  Future<Uint8List?> stop() async {
    final path = _path;
    _path = null;
    if (path == null) return null;
    await _recorder.stop();
    final file = File(path);
    if (!await file.exists()) return null;
    final bytes = await file.readAsBytes();
    unawaitedDelete(file);
    return bytes.length > 1024 ? bytes : null;
  }

  Future<void> cancel() async {
    final path = _path;
    _path = null;
    if (path == null) return;
    await _recorder.stop();
    unawaitedDelete(File(path));
  }

  void unawaitedDelete(File file) {
    file.delete().catchError((_) => file);
  }

  Future<void> dispose() => _recorder.dispose();
}

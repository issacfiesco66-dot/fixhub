import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';

import '../core/config.dart';
import '../core/protocol.dart';

/// Sesión con el backend: REST para crear la sesión y subir audio, WebSocket para
/// fotogramas (binario), ubicación y comandos (JSON) con reconexión automática.
class BackendSession {
  BackendSession({
    String? baseUrl,
    String? apiKey,
    http.Client? httpClient,
  })  : baseUrl = baseUrl ?? AppConfig.backendBaseUrl,
        apiKey = apiKey ?? AppConfig.apiKey,
        _http = httpClient ?? http.Client();

  final String baseUrl;
  final String apiKey;
  final http.Client _http;

  String? sessionId;
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _sub;
  final StreamController<ServerMessage> _messages = StreamController.broadcast();
  final StreamController<bool> _connected = StreamController.broadcast();
  bool _closed = false;
  int _reconnectAttempt = 0;
  Timer? _pingTimer;

  Stream<ServerMessage> get messages => _messages.stream;
  Stream<bool> get connectionChanges => _connected.stream;
  bool get isConnected => _channel != null;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (apiKey.isNotEmpty) 'X-API-Key': apiKey,
      };

  Future<void> connect({String language = AppConfig.language}) async {
    _closed = false;
    sessionId ??= await _createSession(language);
    await _openSocket();
  }

  Future<String> _createSession(String language) async {
    final resp = await _http.post(
      Uri.parse('$baseUrl/v1/sessions'),
      headers: _headers,
      body: jsonEncode({'user_id': 'device', 'language': language}),
    );
    if (resp.statusCode != 200) {
      throw Exception('No se pudo crear la sesión (${resp.statusCode})');
    }
    return (jsonDecode(resp.body) as Map<String, dynamic>)['session_id'] as String;
  }

  Future<void> _openSocket() async {
    final key = apiKey.isNotEmpty ? '?key=${Uri.encodeQueryComponent(apiKey)}' : '';
    final uri = Uri.parse('${AppConfig.wsBaseUrl}/ws/$sessionId$key');
    final channel = WebSocketChannel.connect(uri);
    await channel.ready;
    _channel = channel;
    _reconnectAttempt = 0;
    _connected.add(true);
    _sub = channel.stream.listen(
      (dynamic data) {
        if (data is String) {
          try {
            _messages.add(ServerMessage.parse(data));
          } catch (_) {
            // mensaje malformado: se ignora
          }
        }
      },
      onDone: _onSocketClosed,
      onError: (Object _) => _onSocketClosed(),
      cancelOnError: true,
    );
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      _channel?.sink.add(ClientMessages.ping());
    });
  }

  void _onSocketClosed() {
    _pingTimer?.cancel();
    _sub = null;
    _channel = null;
    _connected.add(false);
    if (_closed) return;
    final delay = Duration(milliseconds: min(30000, 500 * pow(2, _reconnectAttempt).toInt()));
    _reconnectAttempt++;
    Timer(delay, () async {
      if (_closed) return;
      try {
        await _openSocket();
      } catch (_) {
        _onSocketClosed();
      }
    });
  }

  /// Fotograma JPEG. Si el socket no está listo se descarta (nunca se encola vídeo viejo).
  void sendFrame(Uint8List jpeg) {
    _channel?.sink.add(jpeg);
  }

  void sendLocation({
    required double lat,
    required double lng,
    double? heading,
    double? speed,
    double? accuracy,
  }) {
    _channel?.sink.add(ClientMessages.location(
      lat: lat,
      lng: lng,
      heading: heading,
      speed: speed,
      accuracy: accuracy,
    ));
  }

  void sendUtterance(String text) {
    _channel?.sink.add(ClientMessages.utterance(text));
  }

  /// Sube el audio del comando; el backend lo transcribe y responde con mensajes.
  Future<List<ServerMessage>> sendVoice(Uint8List audio, {String filename = 'command.m4a'}) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/v1/sessions/$sessionId/voice'))
      ..headers.addAll({if (apiKey.isNotEmpty) 'X-API-Key': apiKey})
      ..fields['language'] = AppConfig.language
      ..files.add(http.MultipartFile.fromBytes('file', audio, filename: filename));
    final streamed = await _http.send(request).timeout(const Duration(seconds: 20));
    final body = await streamed.stream.bytesToString();
    if (streamed.statusCode != 200) {
      throw Exception('Error de voz (${streamed.statusCode})');
    }
    final json = jsonDecode(body) as Map<String, dynamic>;
    return (json['messages'] as List<dynamic>)
        .map((m) => ServerMessage.fromJson(m as Map<String, dynamic>))
        .toList();
  }

  Future<void> dispose() async {
    _closed = true;
    _pingTimer?.cancel();
    await _sub?.cancel();
    await _channel?.sink.close();
    await _messages.close();
    await _connected.close();
  }
}

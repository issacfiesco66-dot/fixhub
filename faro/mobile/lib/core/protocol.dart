import 'dart:convert';

/// Mensajes que envía el backend por WebSocket/REST (ver backend/app/main.py).
sealed class ServerMessage {
  const ServerMessage();

  static ServerMessage fromJson(Map<String, dynamic> json) {
    switch (json['type']) {
      case 'speak':
        return SpeakMessage(
          text: json['text'] as String? ?? '',
          priority: (json['priority'] as num?)?.toInt() ?? 2,
          interrupt: json['interrupt'] as bool? ?? false,
        );
      case 'alert':
        return AlertMessage(
          text: json['text'] as String? ?? '',
          priority: (json['priority'] as num?)?.toInt() ?? 1,
          hazard: json['hazard'] as String? ?? '',
          zone: json['zone'] as String? ?? 'center',
          distanceM: (json['distance_m'] as num?)?.toDouble(),
          interrupt: json['interrupt'] as bool? ?? true,
        );
      case 'nav':
        return NavMessage(
          event: json['event'] as String? ?? '',
          text: json['text'] as String? ?? '',
          priority: (json['priority'] as num?)?.toInt() ?? 2,
        );
      case 'haptic':
        return HapticMessage(pattern: json['pattern'] as String? ?? 'tick');
      case 'open_url':
        return OpenUrlMessage(url: json['url'] as String? ?? '');
      case 'state':
        return StateMessage(
          navigating: json['navigating'] as bool? ?? false,
          pending: json['pending'] as String?,
          alertsEnabled: json['alerts_enabled'] as bool? ?? true,
          rideActive: json['ride_active'] as bool? ?? false,
        );
      case 'error':
        return ErrorMessage(message: json['message'] as String? ?? 'error');
      default:
        return UnknownMessage(json);
    }
  }

  static ServerMessage parse(String raw) =>
      fromJson(jsonDecode(raw) as Map<String, dynamic>);
}

class SpeakMessage extends ServerMessage {
  const SpeakMessage({required this.text, this.priority = 2, this.interrupt = false});
  final String text;
  final int priority;
  final bool interrupt;
}

class AlertMessage extends ServerMessage {
  const AlertMessage({
    required this.text,
    required this.priority,
    required this.hazard,
    required this.zone,
    this.distanceM,
    this.interrupt = true,
  });
  final String text;
  final int priority;
  final String hazard;
  final String zone;
  final double? distanceM;
  final bool interrupt;
}

class NavMessage extends ServerMessage {
  const NavMessage({required this.event, required this.text, this.priority = 2});
  final String event;
  final String text;
  final int priority;
}

class HapticMessage extends ServerMessage {
  const HapticMessage({required this.pattern});
  final String pattern;
}

class OpenUrlMessage extends ServerMessage {
  const OpenUrlMessage({required this.url});
  final String url;
}

class StateMessage extends ServerMessage {
  const StateMessage({
    required this.navigating,
    required this.pending,
    required this.alertsEnabled,
    required this.rideActive,
  });
  final bool navigating;
  final String? pending;
  final bool alertsEnabled;
  final bool rideActive;
}

class ErrorMessage extends ServerMessage {
  const ErrorMessage({required this.message});
  final String message;
}

class UnknownMessage extends ServerMessage {
  const UnknownMessage(this.json);
  final Map<String, dynamic> json;
}

/// Mensajes que envía la app al backend.
class ClientMessages {
  ClientMessages._();

  static String location({
    required double lat,
    required double lng,
    double? heading,
    double? speed,
    double? accuracy,
  }) =>
      jsonEncode({
        'type': 'location',
        'lat': lat,
        'lng': lng,
        if (heading != null) 'heading': heading,
        if (speed != null) 'speed': speed,
        if (accuracy != null) 'accuracy': accuracy,
      });

  static String utterance(String text) => jsonEncode({'type': 'utterance', 'text': text});

  static String ping() => jsonEncode({'type': 'ping'});
}

import 'package:flutter/services.dart';

/// Patrones hápticos: refuerzan la alerta de voz (útil en entornos ruidosos).
class Haptics {
  Haptics._();

  static Future<void> play(String pattern) async {
    switch (pattern) {
      case 'danger':
        for (var i = 0; i < 3; i++) {
          await HapticFeedback.heavyImpact();
          await Future<void>.delayed(const Duration(milliseconds: 120));
        }
      case 'warning':
        await HapticFeedback.mediumImpact();
        await Future<void>.delayed(const Duration(milliseconds: 150));
        await HapticFeedback.mediumImpact();
      case 'success':
        await HapticFeedback.lightImpact();
        await Future<void>.delayed(const Duration(milliseconds: 80));
        await HapticFeedback.heavyImpact();
      default:
        await HapticFeedback.selectionClick();
    }
  }
}

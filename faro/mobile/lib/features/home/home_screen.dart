import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import 'home_controller.dart';

/// Pantalla única, negra, controlada al 100 % por gestos o por voz.
///
/// Gestos (toque directo, sin lector de pantalla):
///   * mantener presionado  -> hablar (se envía al soltar)
///   * deslizar izquierda/derecha -> cancelar
///   * doble toque -> repetir lo último
///   * deslizar arriba -> "¿dónde estoy?"   · deslizar abajo -> "¿qué hay delante?"
///   * toque con dos dedos -> silenciar/activar alertas de obstáculos
///
/// Con TalkBack/VoiceOver la pantalla es un único botón: "doble toque y mantener"
/// (o doble toque) alterna la escucha, y el resto de acciones están en el menú de
/// acciones personalizadas del lector (Cancelar, Repetir, ¿Dónde estoy?, Describir...).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.controller, this.autoInit = true});

  final HomeController controller;
  final bool autoInit;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  HomeController get c => widget.controller;
  String _lastAnnounced = '';

  @override
  void initState() {
    super.initState();
    c.addListener(_onChanged);
    if (widget.autoInit) {
      WidgetsBinding.instance.addPostFrameCallback((_) => c.init());
    }
  }

  @override
  void dispose() {
    c.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    if (!mounted) return;
    setState(() {});
    // Anuncia cambios de estado a TalkBack/VoiceOver sin interferir con el TTS de alertas.
    if (c.statusText != _lastAnnounced && c.status != FaroStatus.listening) {
      _lastAnnounced = c.statusText;
      SemanticsService.announce(c.statusText, TextDirection.ltr);
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenReader = MediaQuery.of(context).accessibleNavigation;
    final hint = screenReader
        ? 'Doble toque para empezar a hablar y otro doble toque para enviar. '
            'Más acciones en el menú de acciones.'
        : 'Mantén presionado para hablar. Desliza para cancelar. Doble toque para repetir.';

    return Scaffold(
      backgroundColor: Colors.black,
      body: Semantics(
        container: true,
        button: true,
        label: 'Faro. ${c.statusText}.',
        hint: hint,
        onTap: screenReader ? c.toggleListening : null,
        onLongPress: c.toggleListening,
        customSemanticsActions: {
          const CustomSemanticsAction(label: 'Cancelar'): c.cancel,
          const CustomSemanticsAction(label: 'Repetir'): c.repeatLast,
          const CustomSemanticsAction(label: '¿Dónde estoy?'): c.whereAmI,
          const CustomSemanticsAction(label: 'Describir lo que hay delante'): c.describeScene,
          const CustomSemanticsAction(label: 'Conectar gafas Meta'): c.connectGlasses,
          CustomSemanticsAction(
            label: c.alertsEnabled ? 'Silenciar alertas de obstáculos' : 'Activar alertas',
          ): c.toggleAlerts,
        },
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onLongPressStart: (_) => c.startListening(),
          onLongPressEnd: (_) => c.stopListeningAndSend(),
          onDoubleTap: c.repeatLast,
          onHorizontalDragEnd: (_) => c.cancel(),
          onVerticalDragEnd: (details) {
            final v = details.primaryVelocity ?? 0;
            if (v < 0) {
              c.whereAmI();
            } else {
              c.describeScene();
            }
          },
          child: _TwoFingerTap(
            onTwoFingerTap: c.toggleAlerts,
            child: SizedBox.expand(
              child: ExcludeSemantics(
                child: _StatusView(status: c.status, text: c.statusText, alerts: c.alertsEnabled),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Indicador visual mínimo (para personas con baja visión o acompañantes).
class _StatusView extends StatelessWidget {
  const _StatusView({required this.status, required this.text, required this.alerts});

  final FaroStatus status;
  final String text;
  final bool alerts;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      FaroStatus.listening => Colors.greenAccent,
      FaroStatus.thinking => Colors.amberAccent,
      FaroStatus.offline => Colors.redAccent,
      _ => Colors.white,
    };
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            status == FaroStatus.listening ? Icons.mic : Icons.visibility,
            size: 120,
            color: color,
          ),
          const SizedBox(height: 24),
          Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 34, fontWeight: FontWeight.bold, color: color),
          ),
          const SizedBox(height: 12),
          Text(
            alerts ? 'Alertas activas' : 'Alertas silenciadas',
            style: const TextStyle(fontSize: 22, color: Colors.white70),
          ),
        ],
      ),
    );
  }
}

/// Detecta un toque simultáneo con dos dedos (silenciar/activar alertas).
class _TwoFingerTap extends StatefulWidget {
  const _TwoFingerTap({required this.onTwoFingerTap, required this.child});

  final VoidCallback onTwoFingerTap;
  final Widget child;

  @override
  State<_TwoFingerTap> createState() => _TwoFingerTapState();
}

class _TwoFingerTapState extends State<_TwoFingerTap> {
  int _pointers = 0;
  int _maxPointers = 0;
  DateTime? _downAt;

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) {
        _pointers++;
        _maxPointers = _pointers > _maxPointers ? _pointers : _maxPointers;
        _downAt ??= DateTime.now();
      },
      onPointerUp: (_) {
        _pointers--;
        if (_pointers == 0) {
          final short = DateTime.now().difference(_downAt ?? DateTime.now()) <
              const Duration(milliseconds: 400);
          if (_maxPointers == 2 && short) widget.onTwoFingerTap();
          _maxPointers = 0;
          _downAt = null;
        }
      },
      onPointerCancel: (_) {
        _pointers = 0;
        _maxPointers = 0;
        _downAt = null;
      },
      child: widget.child,
    );
  }
}

import 'package:flutter/material.dart';

import 'features/home/home_controller.dart';
import 'features/home/home_screen.dart';

class FaroApp extends StatefulWidget {
  const FaroApp({super.key});

  @override
  State<FaroApp> createState() => _FaroAppState();
}

class _FaroAppState extends State<FaroApp> {
  late final HomeController _controller = HomeController.production();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Faro',
      debugShowCheckedModeBanner: false,
      // Tema oscuro de alto contraste: pantalla negra, texto grande para baja visión.
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: Colors.black,
        textTheme: ThemeData.dark().textTheme.apply(
              bodyColor: Colors.white,
              displayColor: Colors.white,
            ),
      ),
      home: HomeScreen(controller: _controller),
    );
  }
}

import 'package:faro_app/core/protocol.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parsea alerta del backend', () {
    final msg = ServerMessage.parse(
      '{"type":"alert","text":"Escalera bajando al frente, 2 metros","priority":1,'
      '"hazard":"stairs_down","zone":"center","distance_m":2.0,"interrupt":true}',
    );
    expect(msg, isA<AlertMessage>());
    final alert = msg as AlertMessage;
    expect(alert.text, 'Escalera bajando al frente, 2 metros');
    expect(alert.priority, 1);
    expect(alert.interrupt, isTrue);
    expect(alert.distanceM, 2.0);
  });

  test('parsea speak, nav, open_url, state y desconocidos', () {
    expect(ServerMessage.parse('{"type":"speak","text":"hola"}'), isA<SpeakMessage>());
    expect(ServerMessage.parse('{"type":"nav","event":"start","text":"Ruta"}'), isA<NavMessage>());
    expect(ServerMessage.parse('{"type":"open_url","url":"https://m.uber.com/ul/"}'),
        isA<OpenUrlMessage>());
    final state = ServerMessage.parse(
        '{"type":"state","navigating":true,"pending":"ride","alerts_enabled":false}');
    expect((state as StateMessage).pending, 'ride');
    expect(state.alertsEnabled, isFalse);
    final action = ServerMessage.parse('{"type":"client_action","action":"connect_glasses"}');
    expect((action as ClientActionMessage).action, 'connect_glasses');
    expect(ServerMessage.parse('{"type":"wat"}'), isA<UnknownMessage>());
  });

  test('serializa mensajes de cliente', () {
    expect(ClientMessages.utterance('hola'), '{"type":"utterance","text":"hola"}');
    expect(ClientMessages.location(lat: 1, lng: 2, heading: 90),
        '{"type":"location","lat":1.0,"lng":2.0,"heading":90.0}');
  });
}

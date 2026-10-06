import 'dart:async';
import 'package:capstone_project/screens/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Future<void> openLogin(WidgetTester tester, LoginHandler handler) async {
    tester.view.physicalSize = const Size(412, 892);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(
      home: LogInScreen(loginHandler: handler),
      routes: {
        '/forgot': (_) => const Scaffold(body: Text('Reset password')),
        '/register': (_) => const Scaffold(body: Text('Registration')),
      },
    ));
    await tester.pumpAndSettle();
  }

  Future<void> fillCredentials(WidgetTester tester) async {
    await tester.enterText(find.byKey(const Key('login_email_field')), ' User@Example.com ');
    await tester.enterText(find.byKey(const Key('login_password_field')), 'secret');
  }

  testWidgets('validates fields and toggles password visibility', (tester) async {
    var calls = 0;
    await openLogin(tester, (_, __) async {
      calls++;
      return false;
    });
    await tester.tap(find.byKey(const Key('login_button')));
    await tester.pumpAndSettle();
    expect(find.text('Enter your email address'), findsOneWidget);
    expect(find.text('Enter your password'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('login_email_field')), 'invalid');
    await tester.tap(find.byKey(const Key('login_button')));
    await tester.pumpAndSettle();
    expect(find.text('Enter a valid email address'), findsOneWidget);
    expect(calls, 0);
    final password = find.descendant(
      of: find.byKey(const Key('login_password_field')),
      matching: find.byType(EditableText),
    );
    expect(tester.widget<EditableText>(password).obscureText, isTrue);
    await tester.tap(find.byTooltip('Show password'));
    await tester.pump();
    expect(tester.widget<EditableText>(password).obscureText, isFalse);
    await tester.tap(find.byTooltip('Hide password'));
    await tester.pump();
    expect(tester.widget<EditableText>(password).obscureText, isTrue);
  });

  testWidgets('normalizes email, blocks repeat submissions and shows failures', (tester) async {
    final result = Completer<bool>();
    var calls = 0;
    await openLogin(tester, (email, password) {
      calls++;
      expect(email, 'user@example.com');
      expect(password, 'secret');
      return result.future;
    });
    await fillCredentials(tester);
    await tester.tap(find.byKey(const Key('login_button')));
    await tester.pump();
    for (final key in ['login_button', 'forgot_password_link', 'create_account_link']) {
      expect(tester.widget<ButtonStyleButton>(find.byKey(Key(key))).onPressed, isNull);
    }
    await tester.tap(find.byKey(const Key('login_button')));
    expect(calls, 1);
    result.complete(false);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Unable to log in'), findsOneWidget);
    expect(find.text('The email or password is incorrect. Check your details and try again.'),
        findsOneWidget);
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    expect(
        tester.widget<ElevatedButton>(find.byKey(const Key('login_button'))).onPressed, isNotNull);
  });

  testWidgets('shows service errors and restores login', (tester) async {
    await openLogin(tester, (_, __) async => throw Exception('Server unavailable'));
    await fillCredentials(tester);
    await tester.tap(find.byKey(const Key('login_button')));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Server unavailable'), findsOneWidget);
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    expect(find.text('Login'), findsOneWidget);
  });

  testWidgets('opens password reset and registration', (tester) async {
    await openLogin(tester, (_, __) async => false);
    await tester.tap(find.byKey(const Key('forgot_password_link')));
    await tester.pumpAndSettle();
    expect(find.text('Reset password'), findsOneWidget);
    tester.state<NavigatorState>(find.byType(Navigator)).pop();
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('create_account_link')));
    await tester.pumpAndSettle();
    expect(find.text('Registration'), findsOneWidget);
  });
}

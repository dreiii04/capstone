import 'package:capstone_project/models/password_rules.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('accepts complete passwords at the length boundaries', () {
    expect(PasswordRules.isStrong('Abcdef1!'), isTrue);
    expect(PasswordRules.isStrong('Aa1!${'x' * 1020}'), isTrue);
    expect(PasswordRules.isStrong('Aa1!${'x' * 1021}'), isFalse);
  });

  test('rejects passwords missing a requirement', () {
    for (final password in [
      '',
      'Abcde1!',
      'abcdef1!',
      'ABCDEF1!',
      'Abcdefg!',
      'Abcdef12',
      'Abcdef1! ',
      'Abcdef1!\t',
      'Abcdef1!\n',
    ]) {
      expect(PasswordRules.isStrong(password), isFalse, reason: password);
    }
  });

  test('preserves the supported special characters', () {
    for (final character in '!@#\$%^&*(),.?":{}|<>'.split('')) {
      expect(PasswordRules.isStrong('Abcdef1$character'), isTrue, reason: character);
    }
    expect(PasswordRules.isStrong('Abcdef1_'), isFalse);
  });
}

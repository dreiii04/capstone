/// The password requirements shared by registration and password updates.
class PasswordRules {
  static bool validLength(String value) => value.length >= 8 && value.length <= 1024;
  static bool hasLetterCases(String value) =>
      RegExp(r'[A-Z]').hasMatch(value) && RegExp(r'[a-z]').hasMatch(value);
  static bool hasNumber(String value) => RegExp(r'[0-9]').hasMatch(value);
  static bool hasSpecial(String value) => RegExp(r'[!@#\$%^&*(),.?":{}|<>]').hasMatch(value);
  static bool hasNoSpaces(String value) => !RegExp(r'\s').hasMatch(value);
  static bool isStrong(String value) =>
      validLength(value) &&
      hasLetterCases(value) &&
      hasNumber(value) &&
      hasSpecial(value) &&
      hasNoSpaces(value);
}

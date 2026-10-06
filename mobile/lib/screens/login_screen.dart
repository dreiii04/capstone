import '../widgets/form_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../screens/home_screen.dart';
import '../services/mongo_data_api_service.dart';
import '../widgets/simple_message_dialog.dart';

typedef LoginHandler = Future<bool> Function(String email, String password);

class LogInScreen extends StatefulWidget {
  const LogInScreen({super.key, this.loginHandler});

  final LoginHandler? loginHandler;

  @override
  State<LogInScreen> createState() => _LogInScreenState();
}

class _LogInScreenState extends State<LogInScreen> {
  static const _primaryBlue = Color(0xFF547792);
  static const _darkNavy = Color(0xFF213448);

  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _emailRegex = RegExp(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

  bool _isPasswordVisible = false;
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return 'Enter your email address';
    if (!_emailRegex.hasMatch(email)) return 'Enter a valid email address';
    return null;
  }

  String? _validatePassword(String? value) =>
      value == null || value.isEmpty ? 'Enter your password' : null;

  Future<void> _showLoginError(String message) => showSimpleMessageDialog(
        context,
        message,
        title: 'Unable to log in',
      );

  Future<void> _handleLogin() async {
    if (_isLoading) return;
    FocusManager.instance.primaryFocus?.unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _isLoading = true);

    try {
      final email = _emailController.text.trim().toLowerCase();
      final password = _passwordController.text;
      final handler = widget.loginHandler;
      final isValid = handler != null
          ? await handler(email, password)
          : await MongoDataApiService.instance.login(
              email: email,
              password: password,
            );

      if (!mounted) return;
      if (isValid) {
        TextInput.finishAutofillContext();
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      } else {
        await _showLoginError(
          'The email or password is incorrect. Check your details and try again.',
        );
      }
    } catch (error) {
      if (!mounted) return;
      await _showLoginError(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: Column(
          children: [
            Expanded(
              flex: 2,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: Image.asset(
                    'assets/logo/logo.png',
                    height: 80,
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.image_outlined,
                      color: _primaryBlue,
                      size: 50,
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              flex: 3,
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: _primaryBlue,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                ),
                child: AutofillGroup(
                  child: SingleChildScrollView(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: EdgeInsets.symmetric(
                      horizontal: MediaQuery.sizeOf(context).shortestSide >= 600 ? 36.0 : 30.0,
                      vertical: 30,
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 520),
                        child: _buildLoginForm(),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );

  Widget _buildLoginForm() => Form(
        key: _formKey,
        child: Column(
          children: [
            const Text(
              'Login to your Account',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 30),
            TextFormField(
              key: const Key('login_email_field'),
              controller: _emailController,
              validator: _validateEmail,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.username, AutofillHints.email],
              decoration: _inputDecoration(hint: 'Email'),
            ),
            const SizedBox(height: 20),
            TextFormField(
              key: const Key('login_password_field'),
              controller: _passwordController,
              validator: _validatePassword,
              obscureText: !_isPasswordVisible,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.password],
              onFieldSubmitted: (_) => _handleLogin(),
              decoration: _inputDecoration(
                hint: 'Password',
                suffixIcon: IconButton(
                  tooltip: _isPasswordVisible ? 'Hide password' : 'Show password',
                  onPressed: () => setState(
                    () => _isPasswordVisible = !_isPasswordVisible,
                  ),
                  icon: Icon(
                    _isPasswordVisible ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                  ),
                ),
              ),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: _routeLink(
                'forgot_password_link',
                'Forgot Password?',
                '/forgot',
                buttonStyle: TextButton.styleFrom(padding: EdgeInsets.zero),
                textStyle: const TextStyle(
                  color: Color(0xFFF2F2F2),
                  fontSize: 12,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
            const SizedBox(height: 15),
            SizedBox(
              height: 55,
              width: double.infinity,
              child: ElevatedButton.icon(
                key: const Key('login_button'),
                onPressed: _isLoading ? null : _handleLogin,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _darkNavy,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFF9EABB3),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                icon:
                    _isLoading ? const ButtonProgressIndicator() : const Icon(Icons.login_rounded),
                label: Text(
                  _isLoading ? 'Logging in...' : 'Login',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 25),
            _buildCreateAccountLink(),
          ],
        ),
      );

  Widget _buildCreateAccountLink() => Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Flexible(
            child: Text(
              "Don't have an account?",
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ),
          _routeLink('create_account_link', 'Create an account', '/register'),
        ],
      );

  Widget _routeLink(
    String key,
    String label,
    String route, {
    ButtonStyle? buttonStyle,
    TextStyle textStyle = const TextStyle(
      color: Color(0xFFF2F2F2),
      fontWeight: FontWeight.bold,
    ),
  }) =>
      TextButton(
        key: Key(key),
        onPressed: _isLoading ? null : () => Navigator.pushNamed(context, route),
        style: buttonStyle,
        child: Text(label, style: textStyle),
      );

  InputDecoration _inputDecoration({
    required String hint,
    Widget? suffixIcon,
  }) {
    final border = roundedInputBorder(10, side: BorderSide(color: Colors.grey.shade300));
    return InputDecoration(
      hintText: hint,
      helperText: hint == 'Password' ? 'Password required. Minimum 8 characters.' : null,
      helperStyle: const TextStyle(color: Colors.white70, fontSize: 12),
      helperMaxLines: 2,
      suffixIcon: suffixIcon,
      filled: true,
      fillColor: Colors.white,
      hintStyle: const TextStyle(color: _darkNavy, fontSize: 14),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
        borderSide: const BorderSide(color: Colors.blue, width: 1.5),
      ),
      errorBorder: border.copyWith(
        borderSide: const BorderSide(color: Color(0xFFB3261E)),
      ),
    );
  }
}

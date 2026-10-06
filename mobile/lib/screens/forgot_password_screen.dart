import '../widgets/form_ui.dart';
import '../models/password_rules.dart';
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/mongo_data_api_service.dart';
import '../widgets/simple_message_dialog.dart';

typedef PasswordResetOtpRequester = Future<OtpChallenge> Function(String email);
typedef PasswordResetOtpVerifier = Future<String> Function(
  String email,
  String otp,
  String challengeToken,
);
typedef PasswordResetHandler = Future<void> Function(
  String resetToken,
  String newPassword,
);

class PasswordScreen extends StatefulWidget {
  const PasswordScreen({
    super.key,
    this.otpRequester,
    this.otpVerifier,
    this.passwordResetHandler,
  });

  final PasswordResetOtpRequester? otpRequester;
  final PasswordResetOtpVerifier? otpVerifier;
  final PasswordResetHandler? passwordResetHandler;

  @override
  State<PasswordScreen> createState() => _PasswordScreenState();
}

class _PasswordScreenState extends State<PasswordScreen> {
  static const _primaryBlue = Color(0xFF547792);
  static const _darkNavy = Color(0xFF213448);

  final _emailFormKey = GlobalKey<FormState>();
  final _otpFormKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _otpFocusNode = FocusNode();
  final _emailRegex = RegExp(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

  static const _pinCount = 6;
  final List<String> _digits = List.filled(_pinCount, '');

  bool _codeSent = false;
  bool _isBusy = false;
  String _sentEmail = '';
  String? _challengeToken;
  String? _devOtp;
  String? _verificationError;
  int _resendSeconds = 0;
  Timer? _resendTimer;

  bool get _isOtpFilled => _digits.every((d) => d.isNotEmpty);

  @override
  void initState() {
    super.initState();
    _otpController.addListener(_onOtpChanged);
  }

  void _onOtpChanged() {
    final raw = _otpController.text.replaceAll(RegExp(r'\D'), '');
    final clamped = raw.length > _pinCount ? raw.substring(0, _pinCount) : raw;
    if (_otpController.text != clamped) {
      _otpController.value = _otpController.value.copyWith(
        text: clamped,
        selection: TextSelection.collapsed(offset: clamped.length),
      );
      return;
    }
    setState(() {
      _verificationError = null;
      for (int i = 0; i < _pinCount; i++) {
        _digits[i] = i < clamped.length ? clamped[i] : '';
      }
    });
  }

  @override
  void dispose() {
    _otpController.removeListener(_onOtpChanged);
    _resendTimer?.cancel();
    _emailController.dispose();
    _otpController.dispose();
    _otpFocusNode.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return 'Enter your registered email';
    if (!_emailRegex.hasMatch(email)) return 'Enter a valid email address';
    return null;
  }

  void _startResendCooldown() {
    _resendTimer?.cancel();
    setState(() => _resendSeconds = 30);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_resendSeconds <= 1) {
        timer.cancel();
        setState(() => _resendSeconds = 0);
      } else {
        setState(() => _resendSeconds--);
      }
    });
  }

  Future<void> _requestOtp({bool isResend = false}) async {
    if (_isBusy) return;
    FocusManager.instance.primaryFocus?.unfocus();

    if (!isResend && !(_emailFormKey.currentState?.validate() ?? false)) {
      return;
    }

    final email = isResend ? _sentEmail : _emailController.text.trim().toLowerCase();
    if (email.isEmpty) return;

    setState(() => _isBusy = true);
    try {
      final requester = widget.otpRequester;
      final challenge = requester != null
          ? await requester(email)
          : await MongoDataApiService.instance.requestPasswordResetOtp(email: email);
      if (!mounted) return;

      _otpController.clear();
      setState(() {
        _sentEmail = email;
        _challengeToken = challenge.challengeToken;
        _codeSent = true;
        _devOtp = kDebugMode ? challenge.developmentOtp : null;
        _isBusy = false;
        _verificationError = null;
        for (int i = 0; i < _pinCount; i++) {
          _digits[i] = '';
        }
      });
      if (challenge.developmentOtp?.length == _pinCount) {
        _otpController.text = challenge.developmentOtp!;
      }
      _startResendCooldown();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _otpFocusNode.requestFocus();
      });
    } catch (error) {
      if (!mounted) return;
      await showSimpleMessageDialog(
        context,
        error.toString().replaceFirst('Exception: ', ''),
        title: 'Could not send code',
      );
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _verifyOtp() async {
    if (_isBusy || !_codeSent) return;
    FocusManager.instance.primaryFocus?.unfocus();
    if (!_isOtpFilled) {
      setState(() => _verificationError = 'Enter all 6 digits');
      return;
    }

    final challengeToken = _challengeToken?.trim() ?? '';
    if (challengeToken.isEmpty) {
      await showSimpleMessageDialog(
        context,
        'Request a new verification code before continuing.',
        title: 'Code not verified',
      );
      return;
    }

    setState(() {
      _isBusy = true;
      _verificationError = null;
    });
    try {
      final verifier = widget.otpVerifier;
      final resetToken = verifier != null
          ? await verifier(
              _sentEmail,
              _otpController.text,
              challengeToken,
            )
          : await MongoDataApiService.instance.verifyPasswordResetOtp(
              email: _sentEmail,
              otp: _otpController.text,
              challengeToken: challengeToken,
            );
      if (!mounted) return;

      _resendTimer?.cancel();
      _challengeToken = null;
      await Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ResetPasswordScreen(
            resetToken: resetToken,
            passwordResetHandler: widget.passwordResetHandler,
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _isBusy = false;
        _verificationError = error
            .toString()
            .replaceFirst('Exception: ', '')
            .replaceFirst('Invalid argument(s): ', '');
      });
    }
  }

  void _changeEmail() {
    _resendTimer?.cancel();
    _otpController.clear();
    setState(() {
      _codeSent = false;
      _sentEmail = '';
      _challengeToken = null;
      _devOtp = null;
      _resendSeconds = 0;
      _verificationError = null;
      for (int i = 0; i < _pinCount; i++) {
        _digits[i] = '';
      }
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: Column(
          children: [
            Expanded(
              flex: 2,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Center(
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
                  SafeArea(
                    bottom: false,
                    child: Align(
                      alignment: Alignment.topLeft,
                      child: IconButton(
                        tooltip: _codeSent ? 'Change email' : 'Back to login',
                        onPressed: () {
                          if (_codeSent) {
                            _changeEmail();
                          } else {
                            Navigator.maybePop(context);
                          }
                        },
                        icon: const Icon(Icons.arrow_back_rounded),
                        color: _darkNavy,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              flex: 4,
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: _primaryBlue,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                ),
                child: SingleChildScrollView(
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: EdgeInsets.symmetric(
                    horizontal: MediaQuery.sizeOf(context).shortestSide >= 600 ? 36.0 : 25.0,
                    vertical: 30,
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 560),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _buildHeader(),
                          const SizedBox(height: 22),
                          AnimatedSwitcher(
                            duration: const Duration(milliseconds: 220),
                            child: _codeSent ? _buildOtpStep() : _buildEmailStep(),
                          ),
                          const SizedBox(height: 12),
                          TextButton(
                            onPressed: _isBusy
                                ? null
                                : () => Navigator.pushNamedAndRemoveUntil(
                                      context,
                                      '/login',
                                      (route) => false,
                                    ),
                            child: const Text(
                              'Back to Login',
                              style: TextStyle(
                                color: Color(0xFFF2F2F2),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );

  Widget _buildHeader() => Column(
        children: [
          Text(
            _codeSent ? 'Reset Password' : 'Forgot Password',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            _codeSent
                ? 'Enter the six-digit code sent to\n$_sentEmail'
                : 'Enter your registered email to receive a One-Time Password (OTP).',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 13,
              height: 1.4,
            ),
          ),
        ],
      );

  Widget _buildEmailStep() => _card(
        key: const ValueKey('email_step'),
        child: Form(
          key: _emailFormKey,
          autovalidateMode: AutovalidateMode.onUserInteraction,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Find your account',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                key: const Key('password_reset_email_field'),
                controller: _emailController,
                validator: _validateEmail,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.email],
                onFieldSubmitted: (_) => _requestOtp(),
                decoration: _inputDecoration(
                  label: 'Registered email',
                  icon: Icons.mail_outline_rounded,
                  hint: 'name@example.com',
                ),
              ),
              const SizedBox(height: 18),
              _primaryButton(
                key: const Key('send_reset_code_button'),
                onPressed: _isBusy ? null : () => _requestOtp(),
                loading: _isBusy,
                loadingLabel: 'Sending code...',
                label: 'Send verification code',
                icon: Icons.send_rounded,
              ),
            ],
          ),
        ),
      );

  Widget _buildOtpStep() => _card(
        key: const ValueKey('otp_step'),
        child: Form(
          key: _otpFormKey,
          autovalidateMode: AutovalidateMode.onUserInteraction,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_devOtp != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF8E7),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFFE09A)),
                  ),
                  child: Text(
                    'Development code: $_devOtp',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFF694A00),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 18),
              // 6 PIN boxes with transparent text field overlay
              SizedBox(
                height: 56,
                child: Stack(
                  children: [
                    // Visual PIN boxes
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: List.generate(_pinCount, (i) {
                        final isFocused = _otpFocusNode.hasFocus &&
                            _digits[i].isEmpty &&
                            (i == 0 || _digits[i - 1].isNotEmpty);
                        return _ResetPinBox(
                          digit: _digits[i],
                          isFocused: isFocused,
                          hasError: _verificationError != null,
                        );
                      }),
                    ),
                    // Transparent text field on top to capture taps & keyboard
                    Positioned.fill(
                      child: TextField(
                        key: const Key('reset_otp_field'),
                        controller: _otpController,
                        focusNode: _otpFocusNode,
                        autofocus: true,
                        enabled: !_isBusy,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.oneTimeCode],
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(_pinCount),
                        ],
                        onSubmitted: (_) => _verifyOtp(),
                        style: const TextStyle(color: Colors.transparent),
                        cursorColor: Colors.transparent,
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          counterText: '',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (_verificationError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    _verificationError!,
                    key: const Key('reset_otp_error'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFFFFDAD6),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              const SizedBox(height: 14),
              Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  const Text(
                    "Didn't receive the code?",
                    style: TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                  TextButton(
                    key: const Key('resend_reset_code_button'),
                    onPressed:
                        _isBusy || _resendSeconds > 0 ? null : () => _requestOtp(isResend: true),
                    child: Text(
                      _resendSeconds > 0
                          ? 'Resend in 00:${_resendSeconds.toString().padLeft(2, '0')}'
                          : 'Resend code',
                      style: const TextStyle(color: Color(0xFFF2F2F2)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _primaryButton(
                key: const Key('verify_reset_code_button'),
                onPressed: (_isBusy || !_isOtpFilled) ? null : _verifyOtp,
                loading: _isBusy,
                loadingLabel: 'Verifying code...',
                label: 'Verify code',
                icon: Icons.verified_outlined,
              ),
            ],
          ),
        ),
      );

  Widget _card({required Key key, required Widget child}) => Container(
        key: key,
        padding: EdgeInsets.zero,
        child: child,
      );

  Widget _primaryButton({
    required Key key,
    required VoidCallback? onPressed,
    required bool loading,
    required String loadingLabel,
    required String label,
    required IconData icon,
  }) =>
      SizedBox(
        height: 52,
        child: ElevatedButton.icon(
          key: key,
          onPressed: onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: _darkNavy,
            foregroundColor: Colors.white,
            disabledBackgroundColor: const Color(0xFF9EABB3),
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          icon: loading ? const ButtonProgressIndicator() : Icon(icon),
          label: Text(
            loading ? loadingLabel : label,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
        ),
      );

  InputDecoration _inputDecoration({
    required String label,
    required IconData icon,
    String? hint,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixIcon: Icon(icon, size: 21),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      border: roundedInputBorder(12, side: const BorderSide(color: Color(0xFFD8E0E5))),
      enabledBorder: roundedInputBorder(12, side: const BorderSide(color: Color(0xFFD8E0E5))),
      focusedBorder: roundedInputBorder(12, side: const BorderSide(color: Colors.blue, width: 1.5)),
      errorBorder: roundedInputBorder(12, side: const BorderSide(color: Color(0xFFB3261E))),
    );
  }
}

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({
    super.key,
    required this.resetToken,
    this.passwordResetHandler,
  });

  final String resetToken;
  final PasswordResetHandler? passwordResetHandler;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  static const _primaryBlue = Color(0xFF547792);
  static const _darkNavy = Color(0xFF213448);

  final _formKey = GlobalKey<FormState>();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isNewPasswordVisible = false;
  bool _isConfirmPasswordVisible = false;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _newPasswordController.addListener(_refreshRequirements);
  }

  @override
  void dispose() {
    _newPasswordController.removeListener(_refreshRequirements);
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _refreshRequirements() {
    if (mounted) setState(() {});
  }

  String? _validateNewPassword(String? value) {
    final password = value ?? '';
    if (password.isEmpty) return 'Enter a new password';
    if (!PasswordRules.isStrong(password)) {
      return 'Complete all password requirements below';
    }
    return null;
  }

  String? _validateConfirmation(String? value) {
    if (value == null || value.isEmpty) return 'Confirm your new password';
    if (value != _newPasswordController.text) return 'Passwords do not match';
    return null;
  }

  Future<void> _resetPassword() async {
    if (_isSubmitting) return;
    FocusManager.instance.primaryFocus?.unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _isSubmitting = true);
    try {
      final handler = widget.passwordResetHandler;
      if (handler != null) {
        await handler(widget.resetToken, _newPasswordController.text);
      } else {
        await MongoDataApiService.instance.resetPassword(
          resetToken: widget.resetToken,
          newPassword: _newPasswordController.text,
        );
      }
      if (!mounted) return;

      TextInput.finishAutofillContext();
      await showSimpleMessageDialog(
        context,
        'Your password was updated. You can now log in with your new password.',
        title: 'Password reset complete',
      );
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
    } catch (error) {
      if (!mounted) return;
      await showSimpleMessageDialog(
        context,
        error.toString().replaceFirst('Exception: ', ''),
        title: 'Could not reset password',
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final password = _newPasswordController.text;
    return Scaffold(
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
                  height: 120,
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
                    horizontal: MediaQuery.sizeOf(context).shortestSide >= 600 ? 36.0 : 25.0,
                    vertical: 30,
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 560),
                      child: _buildResetForm(password),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResetForm(String password) => Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Reset Password',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 25),
            TextFormField(
              key: const Key('new_password_field'),
              controller: _newPasswordController,
              validator: _validateNewPassword,
              obscureText: !_isNewPasswordVisible,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.newPassword],
              decoration: _passwordDecoration(
                label: 'New Password',
                visible: _isNewPasswordVisible,
                onToggle: () => setState(
                  () => _isNewPasswordVisible = !_isNewPasswordVisible,
                ),
              ),
            ),
            const SizedBox(height: 12),
            _requirement('8-1024 characters', PasswordRules.validLength(password)),
            _requirement(
              'Uppercase and lowercase letters',
              PasswordRules.hasLetterCases(password),
            ),
            _requirement('At least one number', PasswordRules.hasNumber(password)),
            _requirement(
              'At least one special character',
              PasswordRules.hasSpecial(password),
            ),
            _requirement('No spaces', PasswordRules.hasNoSpaces(password)),
            const SizedBox(height: 14),
            TextFormField(
              key: const Key('confirm_new_password_field'),
              controller: _confirmPasswordController,
              validator: _validateConfirmation,
              obscureText: !_isConfirmPasswordVisible,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.newPassword],
              onFieldSubmitted: (_) => _resetPassword(),
              decoration: _passwordDecoration(
                label: 'Confirm Password',
                visible: _isConfirmPasswordVisible,
                onToggle: () => setState(
                  () => _isConfirmPasswordVisible = !_isConfirmPasswordVisible,
                ),
              ),
            ),
            const SizedBox(height: 25),
            SizedBox(
              height: 55,
              child: ElevatedButton.icon(
                key: const Key('reset_password_button'),
                onPressed: _isSubmitting ? null : _resetPassword,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _darkNavy,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFF9EABB3),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                icon: _isSubmitting
                    ? const ButtonProgressIndicator()
                    : const Icon(Icons.lock_reset_rounded),
                label: Text(
                  _isSubmitting ? 'Resetting...' : 'Reset Password',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: _isSubmitting
                  ? null
                  : () => Navigator.pushNamedAndRemoveUntil(
                        context,
                        '/login',
                        (route) => false,
                      ),
              child: const Text(
                'Back to Login',
                style: TextStyle(
                  color: Color(0xFFF2F2F2),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      );

  InputDecoration _passwordDecoration({
    required String label,
    required bool visible,
    required VoidCallback onToggle,
  }) {
    return InputDecoration(
      hintText: label,
      helperText: label == 'New Password'
          ? 'Password required. Minimum 8 characters.'
          : 'Password confirmation required.',
      helperStyle: const TextStyle(color: Colors.white70, fontSize: 12),
      helperMaxLines: 2,
      suffixIcon: IconButton(
        tooltip: visible ? 'Hide password' : 'Show password',
        onPressed: onToggle,
        icon: Icon(
          visible ? Icons.visibility_outlined : Icons.visibility_off_outlined,
        ),
      ),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      border: roundedInputBorder(12, side: const BorderSide(color: Color(0xFFD8E0E5))),
      enabledBorder: roundedInputBorder(12, side: const BorderSide(color: Color(0xFFD8E0E5))),
      focusedBorder: roundedInputBorder(12, side: const BorderSide(color: Colors.blue, width: 1.5)),
      errorBorder: roundedInputBorder(12, side: const BorderSide(color: Color(0xFFB3261E))),
    );
  }

  Widget _requirement(String label, bool met) => Padding(
        padding: const EdgeInsets.only(bottom: 5),
        child: Row(
          children: [
            Icon(
              met ? Icons.check_circle_rounded : Icons.circle_outlined,
              color: met ? const Color(0xFFB9F6CA) : Colors.white70,
              size: 16,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: met ? const Color(0xFFB9F6CA) : Colors.white70,
                  fontSize: 12,
                  fontWeight: met ? FontWeight.w600 : FontWeight.w400,
                ),
              ),
            ),
          ],
        ),
      );
}

/// A single PIN digit box styled for the dark blue theme.
class _ResetPinBox extends StatelessWidget {
  const _ResetPinBox({
    required this.digit,
    required this.isFocused,
    required this.hasError,
  });

  final String digit;
  final bool isFocused;
  final bool hasError;

  @override
  Widget build(BuildContext context) {
    final borderColor = hasError
        ? const Color(0xFFFF897D)
        : isFocused
            ? Colors.white
            : const Color(0xFFD8E0E5);
    final bgColor = digit.isNotEmpty ? Colors.white : const Color(0xFFF8FAFC);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 46,
      height: 56,
      decoration: BoxDecoration(
        color: bgColor,
        border: Border.all(
          color: borderColor,
          width: isFocused ? 2.5 : 1.5,
        ),
        borderRadius: BorderRadius.circular(12),
        boxShadow: isFocused
            ? [
                BoxShadow(
                  color: Colors.white.withAlpha(120),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                )
              ]
            : [
                BoxShadow(
                  color: Colors.black.withAlpha(25),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                )
              ],
      ),
      alignment: Alignment.center,
      child: Text(
        digit,
        style: const TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Color(0xFF213448),
        ),
      ),
    );
  }
}

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/mongo_data_api_service.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/simple_message_dialog.dart';

typedef RegisterOtpRequester = Future<OtpChallenge> Function({
  required String studentStatus,
  required String educationalLevel,
  required String firstName,
  required String lastName,
  required String email,
  required String password,
  String? studentId,
  String? schoolEmail,
  String? yearLevel,
  String? program,
  String? yearGraduated,
  String? lastYearAttended,
  String? lastGradeLevelCompleted,
  String? lastYearLevelCompleted,
});
typedef RegisterOtpVerifier = Future<void> Function({
  required String email,
  required String otp,
  required String challengeToken,
});

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({
    super.key,
    this.otpRequester,
    this.otpVerifier,
  });

  final RegisterOtpRequester? otpRequester;
  final RegisterOtpVerifier? otpVerifier;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  static const _primaryBlue = Color(0xFF547792);
  static const _darkNavy = Color(0xFF213448);

  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _studentIdController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _postgraduateProgramController = TextEditingController();

  final _emailRegex =
      RegExp(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  final _nameRegex = RegExp(
    r"^[A-Za-zÀ-ÖØ-öø-ÿĀ-žÑñ][A-Za-zÀ-ÖØ-öø-ÿĀ-žÑñ .’'\-]*$",
  );
  static const _alumniProgramOptions = [
    'Bachelor of Arts in Religious Education (ABREED)',
    'Bachelor of Secondary Education (BSED) Major in English',
    'Bachelor of Secondary Education (BSED) Major in Mathematics',
    'Bachelor of Secondary Education (BSED) Major in Science',
    'Bachelor of Elementary Education (BEED)',
    'Bachelor of Science in Business Administration (BSBA) Major in Financial Management',
    'Bachelor of Science in Office Administration (BSOA)',
    'Bachelor of Science in Computer Science (BSCS)',
  ];

  static const _defaultProgramOptions = [
    'BSIT',
    'BSCS',
    'BSIS',
    'BSECE',
    'BSCE',
    'BSA',
    'BSBA',
    'BSHM',
    'BSTM',
    'BEED',
    'BSED',
  ];

  static const _shsStrandOptions = [
    'Accounting, Business and Management (ABM)',
    'Science, Technology, Engineering, and Mathematics (STEM)',
    'Humanities and Social Sciences (HUMSS)',
    'General Academic Strand (GAS)',
    'Information-Communication Technology (ICT)',
    'Technological And Livelihood Education (TLE)',
  ];

  List<String> get _programOptions =>
      _isAlumni ? _alumniProgramOptions : _defaultProgramOptions;
  late final List<String> _graduationYears;
  String? _studentStatus;
  String? _studentGradeLevel;
  String? _educationalLevel;
  String? _yearGraduated;
  String? _lastYearAttended;
  String? _lastGradeLevelCompleted;
  String? _lastYearLevelCompleted;
  String? _program;
  bool _acceptedTerms = false;
  bool _isPasswordObscure = true;
  bool _isConfirmPasswordObscure = true;
  bool _isSubmitting = false;

  bool get _isStudent => _studentStatus == 'student';
  bool get _isStudentShs =>
      _isStudent &&
      (_studentGradeLevel == 'Grade 11' || _studentGradeLevel == 'Grade 12');
  bool get _isStudentCollege =>
      _isStudent && (_studentGradeLevel?.endsWith(' Year') ?? false);
  bool get _isAlumni => _studentStatus == 'alumni';
  bool get _isFormerStudent => _studentStatus == 'former_student';
  bool get _isShs => _educationalLevel == 'shs';
  bool get _isBasicEducation =>
      _educationalLevel == 'jhs' || _educationalLevel == 'shs';
  bool get _isPostgraduate =>
      _educationalLevel == 'masters' || _educationalLevel == 'doctorate';
  bool get _requiresProgram =>
      _educationalLevel == 'bachelors' || _isPostgraduate;
  String get _resolvedProgram {
    if (_isStudent) return _program ?? '';
    if (_isShs) return _program ?? '';
    if (!_requiresProgram) return '';
    return _isPostgraduate
        ? _postgraduateProgramController.text.trim()
        : _program ?? '';
  }

  late final ValueNotifier<String> _passwordStrengthNotifier;

  @override
  void initState() {
    super.initState();
    final currentYear = DateTime.now().year;
    _graduationYears = List.generate(
      currentYear - 1950 + 1,
      (index) => (currentYear - index).toString(),
    );
    _passwordStrengthNotifier =
        ValueNotifier<String>(_passwordStrength(_passwordController.text));
    _passwordController.addListener(_updatePasswordStrength);
  }

  @override
  void dispose() {
    _passwordController.removeListener(_updatePasswordStrength);
    _passwordStrengthNotifier.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _studentIdController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _postgraduateProgramController.dispose();
    super.dispose();
  }

  void _updatePasswordStrength() {
    _passwordStrengthNotifier.value =
        _passwordStrength(_passwordController.text);
  }

  String? _validateName(String? value, String fieldName) {
    final name = value?.trim() ?? '';
    if (name.isEmpty) return 'Enter your $fieldName';
    if (name.length < 2 || name.length > 50 || !_nameRegex.hasMatch(name)) {
      return 'Use 2-50 letters; spaces, apostrophes and hyphens are allowed';
    }
    return null;
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) {
      return _isStudent ? 'Enter your school email' : 'Enter your email';
    }
    if (!_emailRegex.hasMatch(email)) return 'Enter a valid email address';
    return null;
  }

  bool _hasMinimumLength(String value) =>
      value.length >= 8 && value.length <= 1024;
  bool _hasUpperAndLower(String value) =>
      RegExp(r'[A-Z]').hasMatch(value) && RegExp(r'[a-z]').hasMatch(value);
  bool _hasNumber(String value) => RegExp(r'[0-9]').hasMatch(value);
  bool _hasSpecialCharacter(String value) =>
      RegExp(r'[!@#\$%^&*(),.?":{}|<>]').hasMatch(value);
  bool _hasNoSpaces(String value) => !RegExp(r'\s').hasMatch(value);

  bool _isStrongPassword(String value) {
    return _hasMinimumLength(value) &&
        _hasUpperAndLower(value) &&
        _hasNumber(value) &&
        _hasSpecialCharacter(value) &&
        _hasNoSpaces(value);
  }

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (password.isEmpty) return 'Enter a password';
    if (!_isStrongPassword(password)) {
      return 'Use 8-1024 chars with upper/lowercase, number, symbol, and no spaces';
    }
    return null;
  }

  String? _validatePasswordConfirmation(String? value) {
    if (value == null || value.isEmpty) return 'Confirm your password';
    if (value != _passwordController.text) return 'Passwords do not match';
    return null;
  }

  Future<void> _handleRegister() async {
    if (_isSubmitting) return;
    FocusManager.instance.primaryFocus?.unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _isSubmitting = true);
    try {
      final email = _emailController.text.trim().toLowerCase();
      final challenge = await _requestOtp(email);

      if (!mounted) return;
      final verified = await _showOtpVerificationDialog(
        email: email,
        challengeToken: challenge.challengeToken,
        developmentOtp: kDebugMode ? challenge.developmentOtp : null,
      );
      if (!mounted || !verified) return;

      await showSimpleMessageDialog(
        context,
        'Your account was created successfully. You can now log in.',
        title: 'Account created',
      );
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
    } catch (error) {
      if (!mounted) return;
      await showSimpleMessageDialog(
        context,
        error.toString().replaceFirst('Exception: ', ''),
        title: 'Could not create account',
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  /// Requests a fresh OTP for [email] using the current registration payload.
  Future<OtpChallenge> _requestOtp(String email) {
    final requester = widget.otpRequester;
    if (requester != null) {
      return requester(
        studentStatus: _studentStatus!,
        educationalLevel: _isStudent
            ? (_isStudentShs
                ? 'shs'
                : _isStudentCollege
                    ? 'bachelors'
                    : 'jhs')
            : _educationalLevel ?? '',
        firstName: _firstNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        email: email,
        password: _passwordController.text,
        studentId: _isStudent ? _studentIdController.text.trim() : null,
        schoolEmail: _isStudent ? email : null,
        yearLevel: _isStudent ? _studentGradeLevel : null,
        program:
            (_isStudentShs || _isStudentCollege || _requiresProgram || _isShs)
                ? _resolvedProgram
                : null,
        yearGraduated: _isAlumni ? _yearGraduated : null,
        lastYearAttended: _isFormerStudent ? _lastYearAttended : null,
        lastGradeLevelCompleted: _isFormerStudent && _isBasicEducation
            ? _lastGradeLevelCompleted
            : null,
        lastYearLevelCompleted: _isFormerStudent && !_isBasicEducation
            ? _lastYearLevelCompleted
            : null,
      );
    }
    return MongoDataApiService.instance.requestRegisterOtp(
      studentStatus: _studentStatus!,
      educationalLevel: _isStudent
          ? (_isStudentShs
              ? 'shs'
              : _isStudentCollege
                  ? 'bachelors'
                  : 'jhs')
          : _educationalLevel ?? '',
      firstName: _firstNameController.text.trim(),
      lastName: _lastNameController.text.trim(),
      email: email,
      password: _passwordController.text,
      studentId: _isStudent ? _studentIdController.text.trim() : null,
      schoolEmail: _isStudent ? email : null,
      yearLevel: _isStudent ? _studentGradeLevel : null,
      program:
          (_isStudentShs || _isStudentCollege || _requiresProgram || _isShs)
              ? _resolvedProgram
              : null,
      yearGraduated: _isAlumni ? _yearGraduated : null,
      lastYearAttended: _isFormerStudent ? _lastYearAttended : null,
      lastGradeLevelCompleted: _isFormerStudent && _isBasicEducation
          ? _lastGradeLevelCompleted
          : null,
      lastYearLevelCompleted: _isFormerStudent && !_isBasicEducation
          ? _lastYearLevelCompleted
          : null,
    );
  }

  Future<bool> _showOtpVerificationDialog({
    required String email,
    required String challengeToken,
    String? developmentOtp,
  }) async {
    // Mutable references so the resend callback can refresh the token.
    String currentChallengeToken = challengeToken;
    String? currentDevOtp = developmentOtp;

    final verified = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _RegistrationOtpDialog(
        email: email,
        developmentOtp: currentDevOtp,
        onVerify: (otp) async {
          final verifier = widget.otpVerifier;
          if (verifier != null) {
            await verifier(
              email: email,
              otp: otp,
              challengeToken: currentChallengeToken,
            );
          } else {
            await MongoDataApiService.instance.verifyRegisterOtp(
              email: email,
              otp: otp,
              challengeToken: currentChallengeToken,
            );
          }
        },
        onResend: () async {
          final newChallenge = await _requestOtp(email);
          currentChallengeToken = newChallenge.challengeToken;
          currentDevOtp = kDebugMode ? newChallenge.developmentOtp : null;
        },
      ),
    );
    return verified ?? false;
  }

  bool get _hasEnteredData {
    return _firstNameController.text.trim().isNotEmpty ||
        _lastNameController.text.trim().isNotEmpty ||
        _studentIdController.text.trim().isNotEmpty ||
        _emailController.text.trim().isNotEmpty ||
        _passwordController.text.isNotEmpty ||
        _confirmPasswordController.text.isNotEmpty ||
        _studentStatus != null ||
        _educationalLevel != null;
  }

  Future<bool> _confirmLeave() async {
    if (_isSubmitting || !_hasEnteredData) return true;
    return await showConfirmationDialog(
      context,
      title: 'Leave Registration?',
      message:
          'Are you sure you want to go back? Any entered registration details will be lost.',
      confirmLabel: 'Leave',
      cancelLabel: 'Stay',
      isDestructive: true,
      icon: Icons.warning_amber_rounded,
    );
  }

  Future<void> _handleBack() async {
    final shouldPop = await _confirmLeave();
    if (shouldPop && mounted) {
      Navigator.maybePop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_hasEnteredData && !_isSubmitting,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final shouldPop = await _confirmLeave();
        if (shouldPop && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
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
                        height: 50,
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.image_outlined,
                          color: _primaryBlue,
                          size: 42,
                        ),
                      ),
                    ),
                  ),
                  SafeArea(
                    bottom: false,
                    child: Align(
                      alignment: Alignment.topLeft,
                      child: IconButton(
                        key: const Key('registration_back_button'),
                        tooltip: 'Back to login',
                        onPressed: _handleBack,
                        icon: const Icon(Icons.arrow_back_rounded),
                        color: _darkNavy,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              flex: 6,
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: _primaryBlue,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(30),
                    topRight: Radius.circular(30),
                  ),
                ),
                child: Form(
                  key: _formKey,
                  autovalidateMode: AutovalidateMode.disabled,
                  child: AutofillGroup(
                    child: SingleChildScrollView(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: EdgeInsets.symmetric(
                        horizontal:
                            MediaQuery.sizeOf(context).shortestSide >= 600
                                ? 36.0
                                : 25.0,
                        vertical: 30,
                      ),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 560),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Text(
                                'Create an Account',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 25),
                              _buildStudentStatusField(),
                              const SizedBox(height: 15),
                              if (_isStudent) ...[
                                _textField(
                                  key: const Key('student_id_field'),
                                  controller: _studentIdController,
                                  hint: 'Student ID',
                                  validator: (value) {
                                    final id = value?.trim() ?? '';
                                    if (id.isEmpty) {
                                      return 'Enter your student ID';
                                    }
                                    if (!RegExp(
                                            r'^[A-Za-z0-9][A-Za-z0-9-]{3,29}$')
                                        .hasMatch(id)) {
                                      return 'Use 4-30 letters, numbers, or hyphens';
                                    }
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 15),
                                _buildStudentGradeLevelField(),
                                const SizedBox(height: 15),
                                if (_isStudentShs || _isStudentCollege) ...[
                                  _buildStudentProgramField(),
                                  const SizedBox(height: 15),
                                ],
                              ],
                              _textField(
                                key: const Key('first_name_field'),
                                controller: _firstNameController,
                                hint: 'First Name',
                                validator: (value) =>
                                    _validateName(value, 'first name'),
                                textCapitalization: TextCapitalization.words,
                                autofillHints: const [
                                  AutofillHints.givenName,
                                ],
                              ),
                              const SizedBox(height: 15),
                              _textField(
                                key: const Key('last_name_field'),
                                controller: _lastNameController,
                                hint: 'Last Name',
                                validator: (value) =>
                                    _validateName(value, 'last name'),
                                textCapitalization: TextCapitalization.words,
                                autofillHints: const [
                                  AutofillHints.familyName,
                                ],
                              ),
                              const SizedBox(height: 15),
                              _textField(
                                key: const Key('registration_email_field'),
                                controller: _emailController,
                                hint: _isStudent ? 'School Email' : 'Email',
                                keyboardType: TextInputType.emailAddress,
                                validator: _validateEmail,
                                autofillHints: const [AutofillHints.email],
                              ),
                              AnimatedSwitcher(
                                duration: const Duration(milliseconds: 180),
                                child: _buildAcademicFields(),
                              ),
                              const SizedBox(height: 15),
                              _textField(
                                key: const Key(
                                  'registration_password_field',
                                ),
                                controller: _passwordController,
                                hint: 'Password',
                                obscureText: _isPasswordObscure,
                                validator: _validatePassword,
                                autofillHints: const [
                                  AutofillHints.newPassword,
                                ],
                                suffixIcon: _visibilityButton(
                                  obscure: _isPasswordObscure,
                                  onPressed: () => setState(
                                    () => _isPasswordObscure =
                                        !_isPasswordObscure,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Use 8–1024 characters with uppercase and lowercase letters, '
                                'a number, and a symbol (e.g. ! or @). No spaces.',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  height: 1.4,
                                ),
                              ),
                              const SizedBox(height: 4),
                              ValueListenableBuilder<String>(
                                valueListenable: _passwordStrengthNotifier,
                                builder: (context, strength, _) {
                                  return Text(
                                    'Password strength: $strength',
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 12,
                                    ),
                                  );
                                },
                              ),
                              const SizedBox(height: 15),
                              _textField(
                                key: const Key('confirm_password_field'),
                                controller: _confirmPasswordController,
                                hint: 'Confirm Password',
                                obscureText: _isConfirmPasswordObscure,
                                validator: _validatePasswordConfirmation,
                                autofillHints: const [
                                  AutofillHints.newPassword,
                                ],
                                textInputAction: TextInputAction.done,
                                suffixIcon: _visibilityButton(
                                  obscure: _isConfirmPasswordObscure,
                                  onPressed: () => setState(
                                    () => _isConfirmPasswordObscure =
                                        !_isConfirmPasswordObscure,
                                  ),
                                ),
                                onFieldSubmitted: (_) => _handleRegister(),
                              ),
                              const SizedBox(height: 8),
                              _buildTermsField(),
                              const SizedBox(height: 25),
                              SizedBox(
                                height: 55,
                                child: ElevatedButton(
                                  key: const Key('create_account_button'),
                                  onPressed:
                                      _isSubmitting ? null : _handleRegister,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: _darkNavy,
                                    foregroundColor: Colors.white,
                                    disabledBackgroundColor:
                                        const Color(0xFF9EABB3),
                                    elevation: 0,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  child: _isSubmitting
                                      ? const SizedBox(
                                          width: 22,
                                          height: 22,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Text(
                                          'Register',
                                          style: TextStyle(
                                            fontSize: 24,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                ),
                              ),
                              const SizedBox(height: 20),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Flexible(
                                    child: Text(
                                      'Already have an account? ',
                                      style: TextStyle(
                                        color: Colors.white70,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () => Navigator.pop(context),
                                    style: TextButton.styleFrom(
                                      padding: EdgeInsets.zero,
                                      minimumSize: Size.zero,
                                      tapTargetSize:
                                          MaterialTapTargetSize.shrinkWrap,
                                    ),
                                    child: const Text(
                                      'Login',
                                      style: TextStyle(
                                        color: Color(0xFFF2F2F2),
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 20),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStudentStatusField() {
    return DropdownButtonFormField<String>(
      key: const Key('student_status_field'),
      initialValue: _studentStatus,
      isExpanded: true,
      decoration: _inputDecoration(hint: 'Student Status'),
      items: const [
        DropdownMenuItem(
          key: Key('student_status_student'),
          value: 'student',
          child: Text('Student'),
        ),
        DropdownMenuItem(
          key: Key('student_status_former_student'),
          value: 'former_student',
          child: Text('Former Student'),
        ),
        DropdownMenuItem(
          key: Key('student_status_alumni'),
          value: 'alumni',
          child: Text('Alumni'),
        ),
      ],
      onChanged: (value) {
        setState(() {
          _studentStatus = value;
          _studentGradeLevel = null;
          _clearAcademicValues(clearEducationalLevel: true);
        });
      },
      validator: (value) =>
          value == null ? 'Select your student status to continue' : null,
    );
  }

  Widget _buildStudentGradeLevelField() {
    const levels = [
      'Grade 7',
      'Grade 8',
      'Grade 9',
      'Grade 10',
      'Grade 11',
      'Grade 12',
      '1st Year',
      '2nd Year',
      '3rd Year',
      '4th Year',
      '5th Year',
    ];
    return DropdownButtonFormField<String>(
      key: const Key('student_grade_level_field'),
      initialValue: _studentGradeLevel,
      isExpanded: true,
      decoration: _inputDecoration(hint: 'Grade Level'),
      items: levels
          .map((level) => DropdownMenuItem(value: level, child: Text(level)))
          .toList(),
      onChanged: (value) => setState(() {
        _studentGradeLevel = value;
        _program = null;
      }),
      validator: (value) => value == null ? 'Select your grade level' : null,
    );
  }

  Widget _buildStudentProgramField() {
    final options = _isStudentShs ? _shsStrandOptions : _defaultProgramOptions;
    return DropdownButtonFormField<String>(
      key: ValueKey('student_program_${_isStudentShs ? 'shs' : 'college'}'),
      initialValue: options.contains(_program) ? _program : null,
      isExpanded: true,
      decoration: _inputDecoration(hint: 'Program'),
      items: options
          .map((program) => DropdownMenuItem(
                value: program,
                child: Text(program, overflow: TextOverflow.ellipsis),
              ))
          .toList(),
      onChanged: (value) => setState(() => _program = value),
      validator: (value) => value == null ? 'Select your program' : null,
    );
  }

  void _clearAcademicValues({bool clearEducationalLevel = false}) {
    if (clearEducationalLevel) _educationalLevel = null;
    _yearGraduated = null;
    _lastYearAttended = null;
    _lastGradeLevelCompleted = null;
    _lastYearLevelCompleted = null;
    _program = null;
    _postgraduateProgramController.clear();
  }

  Widget _buildAcademicFields() {
    if (_studentStatus == null || _isStudent) {
      return const SizedBox.shrink(key: ValueKey('academic_fields_hidden'));
    }

    return Column(
      key: ValueKey(
        'academic_fields_${_studentStatus}_${_educationalLevel ?? 'none'}',
      ),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 15),
        _buildEducationalLevelField(),
        if (_educationalLevel != null) ...[
          if (_isShs) ...[
            const SizedBox(height: 15),
            _buildStrandField(),
          ],
          if (_requiresProgram) ...[
            const SizedBox(height: 15),
            _buildProgramField(),
          ],
          if (_isAlumni) ...[
            const SizedBox(height: 15),
            _buildYearDropdown(
              key: const Key('year_graduated_field'),
              hint: 'Year Graduated',
              value: _yearGraduated,
              onChanged: (value) => setState(() => _yearGraduated = value),
              validationMessage: 'Select your year graduated',
            ),
          ],
          if (_isFormerStudent) ...[
            const SizedBox(height: 15),
            _buildYearDropdown(
              key: const Key('last_year_attended_field'),
              hint: 'Last Year Attended',
              value: _lastYearAttended,
              onChanged: (value) => setState(() => _lastYearAttended = value),
              validationMessage: 'Select your last year attended',
            ),
            const SizedBox(height: 15),
            _isBasicEducation
                ? _buildLastGradeLevelField()
                : _buildLastYearLevelField(),
          ],
        ],
      ],
    );
  }

  Widget _buildEducationalLevelField() {
    final hint = _isFormerStudent
        ? 'Last Educational Level Attended'
        : 'Highest Educational Level Completed';
    return DropdownButtonFormField<String>(
      key: ValueKey('educational_level_${_studentStatus ?? 'none'}'),
      initialValue: _educationalLevel,
      isExpanded: true,
      decoration: _inputDecoration(hint: hint),
      items: const [
        DropdownMenuItem(value: 'jhs', child: Text('JHS')),
        DropdownMenuItem(value: 'shs', child: Text('SHS')),
        DropdownMenuItem(value: 'bachelors', child: Text("Bachelor's")),
        DropdownMenuItem(value: 'masters', child: Text("Master's")),
        DropdownMenuItem(value: 'doctorate', child: Text('Doctorate')),
      ],
      onChanged: (value) {
        setState(() {
          _educationalLevel = value;
          _clearAcademicValues();
        });
      },
      validator: (value) => value == null
          ? _isFormerStudent
              ? 'Select the last educational level you attended'
              : 'Select your highest completed educational level'
          : null,
    );
  }

  Widget _buildYearDropdown({
    required Key key,
    required String hint,
    required String? value,
    required ValueChanged<String?> onChanged,
    required String validationMessage,
  }) {
    return DropdownButtonFormField<String>(
      key: key,
      initialValue: value,
      isExpanded: true,
      decoration: _inputDecoration(hint: hint),
      items: _graduationYears
          .map(
            (year) => DropdownMenuItem(
              value: year,
              child: Text(year, overflow: TextOverflow.ellipsis),
            ),
          )
          .toList(),
      onChanged: onChanged,
      validator: (selected) => selected == null ? validationMessage : null,
    );
  }

  Widget _buildLastGradeLevelField() {
    final options = _educationalLevel == 'jhs'
        ? const ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']
        : const ['Grade 11', 'Grade 12'];
    return DropdownButtonFormField<String>(
      key: ValueKey('last_grade_level_${_educationalLevel ?? 'none'}'),
      initialValue: _lastGradeLevelCompleted,
      isExpanded: true,
      decoration: _inputDecoration(hint: 'Last Grade Level Completed'),
      items: options
          .map(
            (grade) => DropdownMenuItem(value: grade, child: Text(grade)),
          )
          .toList(),
      onChanged: (value) => setState(() => _lastGradeLevelCompleted = value),
      validator: (value) =>
          value == null ? 'Select your last completed grade level' : null,
    );
  }

  Widget _buildLastYearLevelField() {
    const options = [
      '1st Year',
      '2nd Year',
      '3rd Year',
      '4th Year',
      '5th Year',
    ];
    return DropdownButtonFormField<String>(
      key: const Key('last_year_level_completed_field'),
      initialValue: _lastYearLevelCompleted,
      isExpanded: true,
      decoration: _inputDecoration(hint: 'Last Year Level Completed'),
      items: options
          .map(
            (yearLevel) => DropdownMenuItem(
              value: yearLevel,
              child: Text(yearLevel),
            ),
          )
          .toList(),
      onChanged: (value) => setState(() => _lastYearLevelCompleted = value),
      validator: (value) =>
          value == null ? 'Select your last completed year level' : null,
    );
  }

  Widget _buildProgramField() {
    if (_isPostgraduate) {
      return _textField(
        key: const Key('postgraduate_program_field'),
        controller: _postgraduateProgramController,
        hint: 'Program',
        textCapitalization: TextCapitalization.words,
        validator: (value) {
          final program = value?.trim() ?? '';
          if (program.isEmpty) return 'Enter your program';
          if (program.length < 2 || program.length > 100) {
            return 'Use 2-100 characters for your program';
          }
          return null;
        },
      );
    }

    final options = _programOptions;
    final selectedProgram = options.contains(_program) ? _program : null;

    return DropdownButtonFormField<String>(
      key: ValueKey('program_field_${_studentStatus ?? 'none'}'),
      initialValue: selectedProgram,
      isExpanded: true,
      isDense: false,
      itemHeight: null,
      decoration: _inputDecoration(hint: 'Program'),
      selectedItemBuilder: (context) {
        return options.map((program) {
          return Align(
            alignment: Alignment.centerLeft,
            child: Text(
              program,
              softWrap: true,
              maxLines: 3,
              style: const TextStyle(
                color: _darkNavy,
                fontSize: 14,
                height: 1.25,
              ),
            ),
          );
        }).toList();
      },
      items: options
          .map(
            (program) => DropdownMenuItem(
              value: program,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8.0),
                child: Text(
                  program,
                  softWrap: true,
                  maxLines: 4,
                  style: const TextStyle(
                    color: _darkNavy,
                    fontSize: 14,
                    height: 1.3,
                  ),
                ),
              ),
            ),
          )
          .toList(),
      onChanged: (value) => setState(() => _program = value),
      validator: (value) => value == null ? 'Select your program' : null,
    );
  }

  Widget _buildStrandField() {
    const options = _shsStrandOptions;
    final selectedStrand = options.contains(_program) ? _program : null;

    return DropdownButtonFormField<String>(
      key: ValueKey('strand_field_${_studentStatus ?? 'none'}'),
      initialValue: selectedStrand,
      isExpanded: true,
      isDense: false,
      itemHeight: null,
      decoration: _inputDecoration(hint: 'Strand'),
      selectedItemBuilder: (context) {
        return options.map((strand) {
          return Align(
            alignment: Alignment.centerLeft,
            child: Text(
              strand,
              softWrap: true,
              maxLines: 3,
              style: const TextStyle(
                color: _darkNavy,
                fontSize: 14,
                height: 1.25,
              ),
            ),
          );
        }).toList();
      },
      items: options
          .map(
            (strand) => DropdownMenuItem(
              value: strand,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8.0),
                child: Text(
                  strand,
                  softWrap: true,
                  maxLines: 4,
                  style: const TextStyle(
                    color: _darkNavy,
                    fontSize: 14,
                    height: 1.3,
                  ),
                ),
              ),
            ),
          )
          .toList(),
      onChanged: (value) => setState(() => _program = value),
      validator: (value) => value == null ? 'Select your strand' : null,
    );
  }

  Widget _buildTermsField() {
    return FormField<bool>(
      initialValue: _acceptedTerms,
      validator: (value) => value == true
          ? null
          : 'Confirm that all details provided are correct to continue',
      builder: (field) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Checkbox(
                  key: const Key('registration_terms_checkbox'),
                  value: _acceptedTerms,
                  side: const BorderSide(color: Colors.white70),
                  checkColor: _darkNavy,
                  fillColor: WidgetStateProperty.all(Colors.white),
                  onChanged: (value) {
                    setState(() => _acceptedTerms = value ?? false);
                    field.didChange(value ?? false);
                  },
                ),
                const Expanded(
                  child: Text(
                    'I confirm that all details provided are correct.',
                    style: TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ),
              ],
            ),
            if (field.hasError)
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Text(
                  field.errorText!,
                  style: const TextStyle(
                    color: Color(0xFFFFDAD6),
                    fontSize: 12,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _textField({
    required Key key,
    required TextEditingController controller,
    required String hint,
    String? Function(String?)? validator,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    TextInputAction textInputAction = TextInputAction.next,
    Iterable<String>? autofillHints,
    bool obscureText = false,
    Widget? suffixIcon,
    ValueChanged<String>? onFieldSubmitted,
    ValueChanged<String>? onChanged,
  }) {
    return TextFormField(
      key: key,
      controller: controller,
      validator: validator,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      textInputAction: textInputAction,
      autofillHints: autofillHints,
      obscureText: obscureText,
      onFieldSubmitted: onFieldSubmitted,
      onChanged: onChanged,
      style: const TextStyle(color: _darkNavy, fontSize: 15),
      decoration: _inputDecoration(
        hint: hint,
        suffixIcon: suffixIcon,
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String hint,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      hintText: hint,
      suffixIcon: suffixIcon,
      filled: true,
      fillColor: Colors.white,
      hintStyle: const TextStyle(color: _darkNavy, fontSize: 14),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFD8E0E5)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFD8E0E5)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Colors.blue, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFB3261E)),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFB3261E), width: 1.5),
      ),
    );
  }

  Widget _visibilityButton({
    required bool obscure,
    required VoidCallback onPressed,
  }) {
    return IconButton(
      tooltip: obscure ? 'Show password' : 'Hide password',
      onPressed: onPressed,
      icon: Icon(
        obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
      ),
    );
  }

  String _passwordStrength(String password) {
    if (password.isEmpty) return 'Enter password';
    if (!_hasMinimumLength(password)) return 'Weak';

    var score = 0;
    if (_hasUpperAndLower(password)) score += 2;
    if (_hasNumber(password)) score++;
    if (_hasSpecialCharacter(password)) score++;
    if (!_hasNoSpaces(password)) return 'Weak';
    if (score <= 2) return 'Weak';
    if (score == 3) return 'Medium';
    return 'Strong';
  }
}

class _RegistrationOtpDialog extends StatefulWidget {
  const _RegistrationOtpDialog({
    required this.email,
    required this.developmentOtp,
    required this.onVerify,
    this.onResend,
  });

  final String email;
  final String? developmentOtp;
  final Future<void> Function(String otp) onVerify;
  final Future<void> Function()? onResend;

  @override
  State<_RegistrationOtpDialog> createState() => _RegistrationOtpDialogState();
}

class _RegistrationOtpDialogState extends State<_RegistrationOtpDialog> {
  static const _pinCount = 6;
  static const _accentBlue = Color(0xFF2C5FF6);

  final _hiddenController = TextEditingController();
  final _hiddenFocus = FocusNode();
  final List<String> _digits = List.filled(_pinCount, '');

  bool _isVerifying = false;
  bool _isResending = false;
  String? _verificationError;

  String get _otp => _digits.join();
  bool get _isFilled => _digits.every((d) => d.isNotEmpty);

  @override
  void initState() {
    super.initState();
    _hiddenController.addListener(_onTextChanged);
    // pre-fill dev OTP if available
    if (widget.developmentOtp?.length == _pinCount) {
      _hiddenController.text = widget.developmentOtp!;
    }
  }

  void _onTextChanged() {
    final raw = _hiddenController.text.replaceAll(RegExp(r'\D'), '');
    final clamped = raw.length > _pinCount ? raw.substring(0, _pinCount) : raw;
    if (_hiddenController.text != clamped) {
      _hiddenController.value = _hiddenController.value.copyWith(
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
    _hiddenController.removeListener(_onTextChanged);
    _hiddenController.dispose();
    _hiddenFocus.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (_isVerifying) return;
    if (!_isFilled) {
      setState(() => _verificationError = 'Enter all 6 digits');
      return;
    }
    setState(() {
      _isVerifying = true;
      _verificationError = null;
    });
    try {
      await widget.onVerify(_otp);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _isVerifying = false;
        _verificationError = error
            .toString()
            .replaceFirst('Exception: ', '')
            .replaceFirst('Invalid argument(s): ', '');
      });
    }
  }

  Future<void> _resend() async {
    if (_isResending || _isVerifying || widget.onResend == null) return;
    setState(() {
      _isResending = true;
      _verificationError = null;
    });
    try {
      await widget.onResend!();
      // clear digits for new code
      _hiddenController.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('A new code has been sent.')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() =>
            _verificationError = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _isResending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog.fullscreen(
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: GestureDetector(
            // tapping anywhere refocuses the hidden input
            onTap: () => _hiddenFocus.requestFocus(),
            behavior: HitTestBehavior.translucent,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 16),
                  // Back / close
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      icon: const Icon(Icons.arrow_back_rounded),
                      onPressed: _isVerifying
                          ? null
                          : () => Navigator.of(context).pop(false),
                    ),
                  ),
                  const SizedBox(height: 24),
                  // Title
                  RichText(
                    textAlign: TextAlign.center,
                    text: const TextSpan(
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF1A1A2E),
                      ),
                      children: [
                        TextSpan(text: 'Verify '),
                        TextSpan(
                          text: 'your email',
                          style: TextStyle(fontStyle: FontStyle.italic),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  // Subtitle
                  Text(
                    "Enter code we've sent to your inbox\n${widget.email}",
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF6B7280),
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 36),
                  // 6 PIN boxes with transparent text field overlay
                  SizedBox(
                    height: 56,
                    child: Stack(
                      children: [
                        // Visual PIN boxes
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: List.generate(_pinCount, (i) {
                            final isFocused = _hiddenFocus.hasFocus &&
                                _digits[i].isEmpty &&
                                (i == 0 || _digits[i - 1].isNotEmpty);
                            return _PinBox(
                              digit: _digits[i],
                              isFocused: isFocused,
                              hasError: _verificationError != null,
                            );
                          }),
                        ),
                        // Transparent text field on top to capture taps & keyboard
                        Positioned.fill(
                          child: TextField(
                            key: const Key('registration_otp_field'),
                            controller: _hiddenController,
                            focusNode: _hiddenFocus,
                            autofocus: true,
                            enabled: !_isVerifying,
                            keyboardType: TextInputType.number,
                            textInputAction: TextInputAction.done,
                            autofillHints: const [AutofillHints.oneTimeCode],
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(_pinCount),
                            ],
                            onSubmitted: (_) => _verify(),
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
                  const SizedBox(height: 8),
                  // Error message
                  if (_verificationError != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        _verificationError!,
                        key: const Key('registration_otp_error'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Color(0xFFB3261E),
                          fontSize: 13,
                        ),
                      ),
                    ),
                  // Dev OTP hint
                  if (widget.developmentOtp?.isNotEmpty == true) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Dev code: ${widget.developmentOtp}',
                      key: const Key('registration_development_otp'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF6B7280)),
                    ),
                  ],
                  const SizedBox(height: 28),
                  // Resend row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        "Didn't get the code? ",
                        style:
                            TextStyle(color: Color(0xFF6B7280), fontSize: 14),
                      ),
                      GestureDetector(
                        onTap: (_isResending || widget.onResend == null)
                            ? null
                            : _resend,
                        child: Text(
                          _isResending ? 'Sending…' : 'Resend it.',
                          style: const TextStyle(
                            color: _accentBlue,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  // Continue button
                  SizedBox(
                    height: 54,
                    child: ElevatedButton(
                      key: const Key('verify_registration_otp_button'),
                      onPressed: (_isVerifying || !_isFilled) ? null : _verify,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _accentBlue,
                        disabledBackgroundColor: const Color(0xFFB0C0F5),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: _isVerifying
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Continue',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A single PIN digit box.
class _PinBox extends StatelessWidget {
  const _PinBox({
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
        ? const Color(0xFFB3261E)
        : isFocused
            ? const Color(0xFF2C5FF6)
            : const Color(0xFFE5E7EB);
    final bgColor = digit.isNotEmpty ? const Color(0xFFF0F4FF) : Colors.white;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 46,
      height: 56,
      decoration: BoxDecoration(
        color: bgColor,
        border: Border.all(color: borderColor, width: isFocused ? 2 : 1.5),
        borderRadius: BorderRadius.circular(12),
        boxShadow: isFocused
            ? [
                BoxShadow(
                  color: const Color(0xFF2C5FF6).withAlpha(40),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                )
              ]
            : null,
      ),
      alignment: Alignment.center,
      child: Text(
        digit,
        style: const TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Color(0xFF1A1A2E),
        ),
      ),
    );
  }
}

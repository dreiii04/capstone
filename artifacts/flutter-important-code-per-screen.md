# Important Flutter code per screen

Selected excerpts from the current project, grouped by screen. Each block is copied from its source file and includes a source link. These are excerpts: they use the screen's existing state, controllers, services, imports, and shared widgets.

For an interface screenshot, capture the running screen. For a code screenshot, choose the UI widget block or main action below.

## Splash screen

Starts the app, checks the session, and routes login, logout, or request transitions.

[splash_screen.dart:67](/C:/Users/andre/Documents/capstone/mobile/lib/screens/splash_screen.dart:67) — _handleTransition()

```dart
Future<void> _handleTransition() async {
  final timer = Future.delayed(widget.duration ?? const Duration(milliseconds: 250));
  switch (widget.mode) {
    case SplashMode.initial:
      try {
        await Future.wait([
          MongoDataApiService.instance.initialize().timeout(
                const Duration(seconds: 3),
              ),
          timer,
        ]);
      } catch (_) {
        await timer;
      }
      if (!mounted) return;
      final hasSession = MongoDataApiService.instance.hasSession;
      final targetRoute = hasSession ? '/home' : '/login';
      Navigator.of(context).pushReplacementNamed(targetRoute);
      break;

    case SplashMode.login:
    case SplashMode.request:
      await timer;
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (_) => HomeScreen(
            initialIndex: widget.targetIndex ?? (widget.mode == SplashMode.login ? 0 : 1),
          ),
        ),
        (route) => false,
      );
      break;

    case SplashMode.logout:
      try {
        await Future.wait([
          MongoDataApiService.instance.logout(),
          timer,
        ]);
      } catch (_) {
        await timer;
      }
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
      break;
  }
}
```

## Role selection

Displays the student and alumni buttons and opens the login screen.

[choose_actor_screen.dart:70](/C:/Users/andre/Documents/capstone/mobile/lib/screens/choose_actor_screen.dart:70) — _roleButton()

```dart
Widget _roleButton(BuildContext context, String label) => CustomInkwellButton(
      buttonName: label,
      fontSize: 22.sp,
      fontWeight: FontWeight.bold,
      bgColor: fbBackgroundLight,
      fontColor: fbDarkPrimary,
      onTap: () => Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LogInScreen()),
      ),
      height: 65.h,
      width: 280.w,
    );
```

## Login

Validates the form, authenticates the account, and displays the password field.

[login_screen.dart:55](/C:/Users/andre/Documents/capstone/mobile/lib/screens/login_screen.dart:55) — _handleLogin()

```dart
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
```

[login_screen.dart:167](/C:/Users/andre/Documents/capstone/mobile/lib/screens/login_screen.dart:167) — TextFormField widget

```dart
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
)
```

## Registration

Validates password strength, requests OTP verification, and selects the account type.

[register_screen.dart:161](/C:/Users/andre/Documents/capstone/mobile/lib/screens/register_screen.dart:161) — _validatePassword()

```dart
String? _validatePassword(String? value) {
  final password = value ?? '';
  if (password.isEmpty) return 'Enter a password';
  if (!PasswordRules.isStrong(password)) {
    return 'Use 8-1024 chars with upper/lowercase, number, symbol, and no spaces';
  }
  return null;
}
```

[register_screen.dart:176](/C:/Users/andre/Documents/capstone/mobile/lib/screens/register_screen.dart:176) — _handleRegister()

```dart
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
```

[register_screen.dart:621](/C:/Users/andre/Documents/capstone/mobile/lib/screens/register_screen.dart:621) — _buildStudentStatusField()

```dart
Widget _buildStudentStatusField() => DropdownButtonFormField<String>(
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
      validator: (value) => value == null ? 'Select your student status to continue' : null,
    );
```

## Forgot/reset password

Requests and verifies an email OTP, then submits a new password.

[forgot_password_screen.dart:122](/C:/Users/andre/Documents/capstone/mobile/lib/screens/forgot_password_screen.dart:122) — _requestOtp()

```dart
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
```

[forgot_password_screen.dart:171](/C:/Users/andre/Documents/capstone/mobile/lib/screens/forgot_password_screen.dart:171) — _verifyOtp()

```dart
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
```

[forgot_password_screen.dart:655](/C:/Users/andre/Documents/capstone/mobile/lib/screens/forgot_password_screen.dart:655) — _resetPassword()

```dart
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
```

## Change password

Validates the new password and changes it after confirmation.

[change_password_screen.dart:66](/C:/Users/andre/Documents/capstone/mobile/lib/screens/change_password_screen.dart:66) — _validateNewPassword()

```dart
String? _validateNewPassword(String? value) {
  final password = value ?? '';
  if (password.isEmpty) return 'Enter a new password';
  if (!PasswordRules.isStrong(password)) {
    return 'Complete all password requirements below';
  }
  if (password == _currentPasswordController.text) {
    return 'New password must be different';
  }
  return null;
}
```

[change_password_screen.dart:84](/C:/Users/andre/Documents/capstone/mobile/lib/screens/change_password_screen.dart:84) — _changePassword()

```dart
Future<void> _changePassword() async {
  if (_isSubmitting) return;
  FocusManager.instance.primaryFocus?.unfocus();
  if (!(_formKey.currentState?.validate() ?? false)) return;

  final confirmed = await showConfirmationDialog(
    context,
    title: 'Change Password',
    message:
        'Are you sure you want to update your password? Other active sessions will be signed out.',
    confirmLabel: 'Change Password',
    cancelLabel: 'Cancel',
    icon: Icons.lock_reset_rounded,
  );
  if (!confirmed || !mounted) return;

  setState(() => _isSubmitting = true);
  try {
    final handler = widget.changePasswordHandler;
    if (handler != null) {
      await handler(
        _currentPasswordController.text,
        _newPasswordController.text,
      );
    } else {
      await MongoDataApiService.instance.changePassword(
        currentPassword: _currentPasswordController.text,
        newPassword: _newPasswordController.text,
      );
    }
    if (!mounted) return;

    setState(() => _isSubmitting = false);
    TextInput.finishAutofillContext();
    await showSimpleMessageDialog(
      context,
      'Your password was changed. Other signed-in devices have been signed out.',
      title: 'Password changed',
    );
    if (mounted) Navigator.pop(context, true);
  } catch (error) {
    if (!mounted) return;
    setState(() => _isSubmitting = false);
    await showSimpleMessageDialog(
      context,
      error.toString().replaceFirst('Exception: ', ''),
      title: 'Could not change password',
    );
  }
}
```

## Home

Loads requests and changes the selected bottom-navigation tab.

[home_screen.dart:633](/C:/Users/andre/Documents/capstone/mobile/lib/screens/home_screen.dart:633) — _performRequestLoad()

```dart
Future<void> _performRequestLoad() async {
  if (!mounted) return;
  setState(() {
    _isLoadingRequests = true;
    _pendingRequestsError = null;
    _historyRequestsError = null;
  });

  final service = MongoDataApiService.instance;
  final results = await Future.wait<_RequestListLoad>([
    _captureRequestLoad(service.fetchRequests()),
    _captureRequestLoad(service.fetchTransactions()),
  ]);
  final requestResult = results[0];
  final transactionResult = results[1];

  List<PendingRequest>? nextPending;
  List<HistoryItem>? nextTrackingRefunds;
  List<HistoryItem>? nextHistory;
  if (requestResult.data != null) {
    final mapped = _runRequestMapping(
      _MappingInput(
        requests: requestResult.data!,
        transactions: transactionResult.data ?? const <Map<String, dynamic>>[],
      ),
    );
    nextPending = mapped.pending;
    nextTrackingRefunds = transactionResult.data == null
        ? _mergeHistoryLists(
            mapped.trackingRefunds,
            _trackingRefundItems,
          )
        : mapped.trackingRefunds;
    final candidateHistory = transactionResult.data == null
        ? _mergeHistoryLists(mapped.history, _historyItems)
        : mapped.history;
    nextHistory = _withoutTrackedRefunds(
      candidateHistory,
      nextTrackingRefunds,
    );
  } else if (transactionResult.data != null) {
    final mapped = _runRequestMapping(
      _MappingInput(
        requests: const <Map<String, dynamic>>[],
        transactions: transactionResult.data!,
      ),
    );
    nextTrackingRefunds = mapped.trackingRefunds;
    nextHistory = _withoutTrackedRefunds(
      _mergeHistoryLists(mapped.history, _historyItems),
      nextTrackingRefunds,
    );
  }

  if (!mounted) return;
  setState(() {
    if (nextPending != null) _pendingRequests = nextPending;
    if (nextTrackingRefunds != null) {
      _trackingRefundItems = nextTrackingRefunds;
    }
    if (nextHistory != null) _historyItems = nextHistory;
    _pendingRequestsError = requestResult.data == null
        ? _loadErrorMessage(
            requestResult.error,
            'Tracked requests could not be refreshed. Please try again.',
          )
        : null;
    if (requestResult.data == null && transactionResult.data == null) {
      _historyRequestsError = _loadErrorMessage(
        requestResult.error ?? transactionResult.error,
        'Request history could not be refreshed. Please try again.',
      );
    } else if (requestResult.data == null) {
      _historyRequestsError =
          'Some request records could not be refreshed. Showing the latest available history.';
    } else if (transactionResult.data == null) {
      _historyRequestsError =
          'Payment and refund updates could not be refreshed. Showing available request history.';
    } else {
      _historyRequestsError = null;
    }
    _isLoadingRequests = false;
  });
}
```

[home_screen.dart:764](/C:/Users/andre/Documents/capstone/mobile/lib/screens/home_screen.dart:764) — _onTappedBar()

```dart
void _onTappedBar(int value) {
  if (_selectedIndex == value) return;
  setState(() {
    _selectedIndex = value;
    _visitedTabs.add(value);
  });
  WidgetsBinding.instance.addPostFrameCallback((_) {
    if (!mounted) return;
    if (value == 1 || value == 2) {
      if (_pendingRequests.isEmpty && _historyItems.isEmpty) {
        _loadRequests();
      }
    } else if (value == 0) {
      if (_profileSummary == null) {
        _loadProfileSummary();
      }
    }
  });
}
```

## Data consent

Stores consent and enables the Next button only after the checkbox is selected.

[data_consent_screen.dart:141](/C:/Users/andre/Documents/capstone/mobile/lib/screens/data_consent_screen.dart:141) — Checkbox widget

```dart
Checkbox(
  value: _hasConsented,
  activeColor: const Color(0xFF5D7E97),
  onChanged: (val) => setState(() => _hasConsented = val!),
)
```

[data_consent_screen.dart:162](/C:/Users/andre/Documents/capstone/mobile/lib/screens/data_consent_screen.dart:162) — ElevatedButton widget

```dart
ElevatedButton(
  onPressed: _hasConsented
      ? () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => RequestFormScreen(profile: widget.profile),
            ),
          )
      : null,
  style: ElevatedButton.styleFrom(
    backgroundColor: const Color(0xFF233446),
    padding: EdgeInsets.symmetric(horizontal: 50.w, vertical: 12.h),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
  ),
  child: Text("Next", style: TextStyle(color: Colors.white, fontSize: 18.sp)),
)
```

## Request form

Validates document and purpose choices, submits the request, and builds the selection dropdowns.

[request_form_screen.dart:134](/C:/Users/andre/Documents/capstone/mobile/lib/screens/request_form_screen.dart:134) — _handleSubmission()

```dart
Future<void> _handleSubmission() async {
  if (_isSubmitting) return;
  if (!(_formKey.currentState?.validate() ?? false)) return;

  // Check Checkbox
  if (!_isConfirmed) {
    _showErrorDialog("Please confirm that your details are accurate by checking the box.");
    return;
  }

  // Prepare data for the Tracking screen.
  String finalDocName = _mainDocType!;

  String finalPurpose =
      (_selectedPurpose == 'Others') ? _otherPurposeController.text.trim() : _selectedPurpose!;

  if (!isDocumentAllowedForRole(finalDocName, _userRole)) {
    _showErrorDialog("You are not eligible to request this document.");
    return;
  }

  final amountLabel = 'Total: PHP ${documentPriceForName(finalDocName).toStringAsFixed(2)}.';
  setState(() => _isSubmitting = true);
  final confirmed = await showConfirmationDialog(
    context,
    title: 'Submit Request',
    message: 'Submit a request for "$finalDocName" for "$finalPurpose"? $amountLabel',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    icon: Icons.description_outlined,
  );
  if (!mounted) return;
  if (!confirmed) {
    setState(() => _isSubmitting = false);
    return;
  }

  setState(() {
    _isSubmitting = true;
  });

  Map<String, dynamic>? response;
  try {
    response = await MongoDataApiService.instance.createDocumentRequest(
      docName: finalDocName,
      purpose: finalPurpose,
      processingOption: 'standard',
    );
  } catch (e) {
    if (!mounted) return;
    await showSimpleMessageDialog(
      context,
      e.toString().replaceFirst('Exception: ', ''),
      title: 'Request failed',
    );
    setState(() {
      _isSubmitting = false;
    });
    return;
  }

  if (!mounted) return;
  setState(() {
    _isSubmitting = false;
  });

  // Redirect to Tracking (index 1 of the main layout).
  // Adjust 'HomeScreen' to match your actual Main/Home class name
  final requestData = response['request'];
  final requestMap =
      requestData is Map ? Map<String, dynamic>.from(requestData) : <String, dynamic>{};
  final requestId = [
    requestMap['requestId'],
    requestMap['id'],
    requestMap['_id'],
    response['requestId'],
  ]
      .map((value) => value?.toString().trim() ?? '')
      .firstWhere((value) => value.isNotEmpty, orElse: () => '');
  final statusRaw = requestMap['status']?.toString() ?? '';
  final documentPrice = _parseAmount(requestMap['documentPrice']);
  final totalAmount = _parseAmount(requestMap['totalAmount']);
  final resolvedTotal = totalAmount > 0 ? totalAmount : documentPrice;
  final dateCreated = parseApiDateTime(requestMap['createdAt']);
  final displayStatus = statusRaw.trim().toLowerCase() == 'pending_completion' ||
          statusRaw.trim().toLowerCase() == 'pending'
      ? 'PENDING'
      : 'PENDING FOR PAYMENT';

  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (context) => SuccessfulScreen(
        request: PendingRequest(
          requestId: requestId.isEmpty ? null : requestId,
          status: displayStatus,
          processingOption: 'standard',
          purpose: finalPurpose,
          docName: finalDocName,
          dateCreated: dateCreated,
          documentPrice: documentPrice,
          totalAmount: resolvedTotal,
        ),
      ),
    ),
  );
}
```

[request_form_screen.dart:448](/C:/Users/andre/Documents/capstone/mobile/lib/screens/request_form_screen.dart:448) — _buildDropdown()

```dart
Widget _buildDropdown(
        {required String hint,
        String? value,
        required List<String> items,
        required Function(String?) onChanged,
        String? Function(String?)? validator}) =>
    Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.r),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: DropdownButtonFormField<String>(
        initialValue: value,
        isExpanded: true,
        hint: Text(hint, style: TextStyle(fontSize: 13.sp, color: Colors.grey)),
        icon: const Icon(Icons.arrow_drop_down, color: Colors.black54),
        decoration: InputDecoration(
          contentPadding: EdgeInsets.symmetric(horizontal: 15.w),
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8.r), borderSide: BorderSide.none),
        ),
        validator: validator,
        items: items
            .map((e) =>
                DropdownMenuItem(value: e, child: Text(e, style: TextStyle(fontSize: 13.sp))))
            .toList(),
        onChanged: onChanged,
      ),
    );
```

## Request details

Displays request progress and opens payment details when payment is available.

[request_detail_screen.dart:75](/C:/Users/andre/Documents/capstone/mobile/lib/screens/request_detail_screen.dart:75) — RequestStatusTracker widget

```dart
RequestStatusTracker(
status: request.status,
createdAt: request.dateCreated,
history: request.statusHistory,
remarks: request.remarks,
processingStartedAt: request.processingStartedAt,
estimatedProcessingStart: request.estimatedProcessingStart,
estimatedCompletionDate: request.estimatedCompletionDate)
```

[request_detail_screen.dart:128](/C:/Users/andre/Documents/capstone/mobile/lib/screens/request_detail_screen.dart:128) — Align widget

```dart
Align(
  alignment: Alignment.centerRight,
  child: ElevatedButton(
    onPressed: () {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => PaymentDetailsScreen(request: request),
        ),
      );
    },
    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF233446)),
    child: CustomFont(
        text: "Pay now",
        color: Colors.white,
        fontWeight: FontWeight.bold,
        fontSize: 14.sp),
  ),
)
```

## Tracking/pending requests

Filters tracking entries and opens the appropriate details page.

[pending_screen.dart:96](/C:/Users/andre/Documents/capstone/mobile/lib/screens/pending_screen.dart:96) — _applyFilter()

```dart
void _applyFilter() {
  _filteredList = _selectedFilter == 'All'
      ? _trackingEntries
      : _trackingEntries.where((item) => item.docName == _selectedFilter).toList();
}
```

[pending_screen.dart:124](/C:/Users/andre/Documents/capstone/mobile/lib/screens/pending_screen.dart:124) — _openDetails()

```dart
Future<void> _openDetails(_TrackingEntry item) async {
  await Navigator.push<void>(
    context,
    MaterialPageRoute(
      builder: (context) => item.refundItem == null
          ? RequestDetailsScreen(request: item.request!)
          : HistoryDetailScreen(item: item.refundItem!),
    ),
  );
  if (mounted) await _refresh();
}
```

## Payment details

Shows the amount due and requires billing confirmation before continuing.

[payment_details_screen.dart:38](/C:/Users/andre/Documents/capstone/mobile/lib/screens/payment_details_screen.dart:38) — paymentSummaryCard widget

```dart
paymentSummaryCard("Billing Summary", [
  paymentInfoRow("Document Requested", widget.request.docName),
  paymentInfoRow("Processing", widget.request.processingOption.toUpperCase()),
  if (widget.request.totalAmount > widget.request.documentPrice)
    paymentInfoRow("Processing Fee",
        _amountLabel(widget.request.totalAmount - widget.request.documentPrice)),
  paymentInfoRow(
    "Document Price",
    _amountLabel(widget.request.documentPrice),
  ),
  const Divider(),
  paymentInfoRow(
    "Total Amount Due",
    _amountLabel(widget.request.totalAmount),
    isBold: true,
  ),
])
```

[payment_details_screen.dart:77](/C:/Users/andre/Documents/capstone/mobile/lib/screens/payment_details_screen.dart:77) — Checkbox widget

```dart
Checkbox(
  value: _isConfirmed,
  activeColor: const Color(0xFF5D7E97),
  onChanged: (val) => setState(() => _isConfirmed = val!),
)
```

[payment_details_screen.dart:95](/C:/Users/andre/Documents/capstone/mobile/lib/screens/payment_details_screen.dart:95) — ElevatedButton widget

```dart
ElevatedButton(
  onPressed: _isConfirmed
      ? () => Navigator.push(
          context,
          MaterialPageRoute(
              builder: (context) => PaymentMethodScreen(request: widget.request)))
      : null,
  style: ElevatedButton.styleFrom(
    backgroundColor: const Color(0xFF233446),
    padding: EdgeInsets.symmetric(horizontal: 45.w, vertical: 12.h),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
  ),
  child: CustomFont(
      text: "Next",
      color: Colors.white,
      fontSize: 16.sp,
      fontWeight: FontWeight.bold),
)
```

## Payment/receipt upload

Selects and checks receipt images, then submits the payment details.

[payment_method_screen.dart:32](/C:/Users/andre/Documents/capstone/mobile/lib/screens/payment_method_screen.dart:32) — _pickReceipt()

```dart
Future<void> _pickReceipt({
  required ImageSource source,
}) async {
  try {
    final file = await _picker.pickImage(
      source: source,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 85,
    );
    if (file == null) return;

    final bytes = await file.readAsBytes();
    if (!mounted) return;
    if (bytes.isEmpty ||
        bytes.length > 4 * 1024 * 1024 ||
        receiptImageContentType(bytes) == null) {
      await showSimpleMessageDialog(
          context, 'Choose a valid JPG, PNG, WEBP, or HEIC receipt up to 4 MB.',
          title: 'Invalid receipt');
      return;
    }
    setState(() {
      _receiptBytes = bytes;
      _receiptName = file.name;
      _acknowledged = false;
    });
  } catch (_) {
    if (mounted) {
      await showSimpleMessageDialog(
          context, 'The receipt could not be opened. Choose another image and try again.',
          title: 'Receipt unavailable');
    }
  }
}
```

[payment_method_screen.dart:105](/C:/Users/andre/Documents/capstone/mobile/lib/screens/payment_method_screen.dart:105) — _submitPayment()

```dart
Future<void> _submitPayment() async {
  if (_isSubmitting || !_hasReceipt) return;
  setState(() => _isSubmitting = true);
  final confirmed = await showConfirmationDialog(context,
      title: _isResubmission ? 'Resubmit Receipt' : 'Submit Receipt',
      message: _isResubmission
          ? 'Replace the receipt that needs updating? Your payment and document request will stay the same while the Registrar reviews the new image.'
          : 'Submit this receipt for ${widget.request.processingOption} processing? Total: ${_amountLabel(widget.request.totalAmount)}. The Registrar will review your payment.');
  if (!mounted) return;
  if (!confirmed) {
    setState(() => _isSubmitting = false);
    return;
  }
  setState(() {
    _isSubmitting = true;
  });

  try {
    final requestId = widget.request.requestId?.trim() ?? '';
    if (requestId.isEmpty) {
      throw Exception(
        'This payment is not linked to a request. Refresh your requests and try again.',
      );
    }
    final service = MongoDataApiService.instance;
    if (_receiptBytes != null) {
      await service.uploadReceipt(
        bytes: _receiptBytes!,
        fileName: _receiptName ?? 'payment-receipt.jpg',
        requestId: requestId,
        paymentType: 'receipt',
        docName: widget.request.docName,
        purpose: widget.request.purpose,
      );
    }

    if (!mounted) return;
    final updatedRequest = PendingRequest(
      requestId: widget.request.requestId,
      docName: widget.request.docName,
      purpose: widget.request.purpose,
      dateCreated: widget.request.dateCreated,
      status: 'PENDING',
      correctionType: widget.request.correctionType,
      processingOption: widget.request.processingOption,
      documentPrice: widget.request.documentPrice,
      totalAmount: widget.request.totalAmount,
    );
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(
        builder: (context) => SuccessfulScreen(request: updatedRequest),
      ),
      (route) => false,
    );
  } catch (e) {
    if (!mounted) return;
    await showSimpleMessageDialog(
      context,
      e.toString().replaceFirst('Exception: ', ''),
      title: 'Upload failed',
    );
  } finally {
    if (mounted) {
      setState(() {
        _isSubmitting = false;
      });
    }
  }
}
```

## Refund request

Collects confirmation and submits the refund request.

[payment_refund_screen.dart:398](/C:/Users/andre/Documents/capstone/mobile/lib/screens/payment_refund_screen.dart:398) — _buildConfirmation()

```dart
Widget _buildConfirmation() => Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: CheckboxListTile(
        key: const Key('refund_confirmation_checkbox'),
        value: _confirmed,
        onChanged: (value) => setState(() => _confirmed = value ?? false),
        controlAffinity: ListTileControlAffinity.leading,
        activeColor: _primaryBlue,
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        title: const Text(
          'I confirm that the refund details are correct.',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
        subtitle: const Text(
          'Incorrect account information may delay your refund.',
          style: TextStyle(fontSize: 12),
        ),
      ),
    );
```

[payment_refund_screen.dart:69](/C:/Users/andre/Documents/capstone/mobile/lib/screens/payment_refund_screen.dart:69) — _submitRefund()

```dart
Future<void> _submitRefund() async {
  if (_isSubmitting) return;
  FocusManager.instance.primaryFocus?.unfocus();
  final isValid = _formKey.currentState?.validate() ?? false;
  if (!isValid) return;
  if (!_confirmed) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Confirm that the refund details are correct.'),
      ),
    );
    return;
  }

  final docTitle = widget.item.title.isNotEmpty ? widget.item.title : 'this document';
  final confirmed = await showConfirmationDialog(
    context,
    title: 'Submit Refund Request',
    message:
        'Are you sure you want to submit a refund request for "$docTitle"? Please double check your account details.',
    confirmLabel: 'Submit Refund',
    cancelLabel: 'Review',
    icon: Icons.receipt_long_outlined,
  );
  if (!confirmed || !mounted) return;

  setState(() => _isSubmitting = true);
  try {
    final requestRefund = widget.requestRefund ?? MongoDataApiService.instance.requestRefund;
    final result = await requestRefund(
      transactionId: widget.item.transactionId,
      refundMethod: _refundMethod,
      accountName: _accountNameController.text,
      accountNumber: _accountNumberController.text,
      bankName: _refundMethod == 'bank_transfer' ? _bankNameController.text : null,
      reason: _reasonController.text,
    );
    if (!mounted) return;
    widget.item.refundStatus = result['refundStatus']?.toString().trim().isNotEmpty == true
        ? result['refundStatus'].toString().trim()
        : 'pending';
    if (result['alreadyRequested'] == true) {
      setState(() => _isSubmitting = false);
      await showSimpleMessageDialog(
        context,
        'You already submitted a refund request for this payment. Only one '
        'request is allowed. Track the existing request in Tracking, or '
        "contact the Registrar's Office if you need to correct the refund "
        'destination.',
        title: 'Refund already requested',
      );
      if (mounted && Navigator.canPop(context)) {
        Navigator.pop(context, true);
      }
      return;
    }
    setState(() {
      _submitted = true;
      _isSubmitting = false;
    });
  } catch (error) {
    if (!mounted) return;
    await showSimpleMessageDialog(
      context,
      error.toString().replaceFirst('Exception: ', ''),
      title: 'Refund request failed',
    );
    if (mounted) setState(() => _isSubmitting = false);
  }
}
```

## History

Filters and searches history entries and allows completed documents to be marked as claimed.

[history_screen.dart:205](/C:/Users/andre/Documents/capstone/mobile/lib/screens/history_screen.dart:205) — _applyFilter()

```dart
void _applyFilter() {
  _filteredList = _selectedFilter == 'All'
      ? widget.historyList
      : widget.historyList.where((item) => item.title == _selectedFilter).toList();
  final query = _searchQuery.trim().toLowerCase();
  _filteredList = widget.historyList.where((item) {
    final matchesFilter = _selectedFilter == 'All' || item.title == _selectedFilter;
    if (!matchesFilter) return false;
    if (query.isEmpty) return true;
    return item.title.toLowerCase().contains(query) ||
        item.requestId.toLowerCase().contains(query) ||
        item.purpose.toLowerCase().contains(query) ||
        item.status.toLowerCase().contains(query);
  }).toList();
}
```

[history_screen.dart:248](/C:/Users/andre/Documents/capstone/mobile/lib/screens/history_screen.dart:248) — _claimItem()

```dart
Future<void> _claimItem(HistoryItem item) async {
  if (_claimingRequestId != null ||
      item.displayStatus != 'READY TO CLAIM' ||
      item.requestId.isEmpty) {
    return;
  }
  final confirmed = await showConfirmationDialog(
    context,
    title: 'Confirm document claim',
    message: 'Have you received this document? Confirming will mark this request as Claimed.',
    confirmLabel: 'Mark as claimed',
  );
  if (!confirmed || !mounted) return;

  setState(() => _claimingRequestId = item.requestId);
  try {
    await MongoDataApiService.instance.claimRequest(requestId: item.requestId);
    if (mounted) await _refresh();
  } catch (error) {
    if (mounted) {
      await showSimpleMessageDialog(
        context,
        error.toString().replaceFirst('Exception: ', ''),
        title: 'Could not claim document',
      );
    }
  } finally {
    if (mounted) setState(() => _claimingRequestId = null);
  }
}
```

## History details

Marks a document as claimed and opens the refund screen.

[history_detail_screen.dart:29](/C:/Users/andre/Documents/capstone/mobile/lib/screens/history_detail_screen.dart:29) — _claimDocument()

```dart
Future<void> _claimDocument() async {
  if (_isClaiming || !_isReadyToClaim || item.requestId.isEmpty) return;
  final confirmed = await showConfirmationDialog(
    context,
    title: 'Confirm document claim',
    message: 'Have you received this document? Confirming will mark this request as Claimed.',
    confirmLabel: 'Mark as claimed',
  );
  if (!confirmed || !mounted) return;

  setState(() => _isClaiming = true);
  try {
    await MongoDataApiService.instance.claimRequest(requestId: item.requestId);
    if (mounted) Navigator.pop(context, true);
  } catch (error) {
    if (mounted) {
      await showSimpleMessageDialog(
        context,
        error.toString().replaceFirst('Exception: ', ''),
        title: 'Could not claim document',
      );
    }
  } finally {
    if (mounted) setState(() => _isClaiming = false);
  }
}
```

[history_detail_screen.dart:79](/C:/Users/andre/Documents/capstone/mobile/lib/screens/history_detail_screen.dart:79) — _openRefundScreen()

```dart
Future<void> _openRefundScreen() async {
  final submitted = await Navigator.push<bool>(
    context,
    MaterialPageRoute(builder: (_) => PaymentRefundScreen(item: item)),
  );
  if (submitted == true && mounted) setState(() {});
}
```

## Notifications

Sorts/filters notifications and marks a notification as read.

[notification_screen.dart:53](/C:/Users/andre/Documents/capstone/mobile/lib/screens/notification_screen.dart:53) — _buildFilteredList()

```dart
List<NotificationItem> _buildFilteredList() {
  final filtered = _filterType == 'unread'
      ? widget.notifications.where((item) => !item.isRead).toList()
      : List<NotificationItem>.from(widget.notifications);
  filtered.sort((a, b) {
    final byDate = b.createdAt.compareTo(a.createdAt);
    return byDate != 0 ? byDate : b.id.compareTo(a.id);
  });
  return filtered;
}
```

[notification_screen.dart:64](/C:/Users/andre/Documents/capstone/mobile/lib/screens/notification_screen.dart:64) — _markAsRead()

```dart
Future<void> _markAsRead(NotificationItem notification) async {
  if (notification.isRead || _updatingIds.contains(notification.id)) return;
  setState(() => _updatingIds.add(notification.id));
  try {
    await (widget.onMarkRead ??
        MongoDataApiService.instance.markNotificationRead)(notification.id);
    if (!mounted) return;
    setState(() {
      notification.isRead = true;
      _filteredNotifications = _buildFilteredList();
    });
  } catch (error) {
    if (!mounted) return;
    _showError(error, 'Could not mark this notification as read.');
  } finally {
    if (mounted) setState(() => _updatingIds.remove(notification.id));
  }
}
```

## Profile

Loads the account profile and opens the profile editor.

[profile_screen.dart:56](/C:/Users/andre/Documents/capstone/mobile/lib/screens/profile_screen.dart:56) — _loadProfile()

```dart
Future<void> _loadProfile() async {
  setState(() {
    _isLoading = true;
    _errorMessage = null;
  });

  try {
    final profile = await MongoDataApiService.instance.fetchProfile();
    if (!mounted) return;
    setState(() {
      _profile = profile;
      _isLoading = false;
      _errorMessage = null;
    });
    widget.onProfileChanged?.call(profile);
  } catch (error) {
    if (!mounted) return;
    await showSimpleMessageDialog(
      context,
      error.toString().replaceFirst('Exception: ', ''),
      title: 'Profile failed',
    );
    if (!mounted) return;
    setState(() {
      _errorMessage = 'Unable to load profile.';
      _isLoading = false;
    });
  }
}
```

[profile_screen.dart:284](/C:/Users/andre/Documents/capstone/mobile/lib/screens/profile_screen.dart:284) — ElevatedButton widget

```dart
ElevatedButton(
  key: const Key('profile_edit_button'),
  onPressed: () async {
    final updated = await Navigator.push<ProfileData>(
      context,
      MaterialPageRoute(
        builder: (context) => EditProfileScreen(profile: profile),
      ),
    );
    if (!context.mounted) return;
    if (updated != null) {
      setState(() {
        _profile = updated;
      });
      widget.onProfileChanged?.call(updated);
    }
  },
  style: ElevatedButton.styleFrom(
    backgroundColor: darkNavy,
    foregroundColor: Colors.white,
    fixedSize: Size(210.w, 48.h),
    elevation: 0,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.r)),
  ),
  child: Text(
    "Edit profile",
    style: TextStyle(
      fontSize: 18.sp,
      fontWeight: FontWeight.w600,
    ),
  ),
)
```

## Edit profile

Validates and saves profile updates and enables saving when the form has changes.

[edit_profile_screen.dart:222](/C:/Users/andre/Documents/capstone/mobile/lib/screens/edit_profile_screen.dart:222) — _handleSave()

```dart
Future<void> _handleSave() async {
  if (_isSaving || !_hasChanges) return;
  FocusManager.instance.primaryFocus?.unfocus();
  if (!(_formKey.currentState?.validate() ?? false)) return;

  setState(() => _isSaving = true);
  final confirmed = await showConfirmationDialog(context,
      title: 'Save Account Changes', message: 'Save these changes to your account profile?');
  if (!mounted) return;
  if (!confirmed) {
    setState(() => _isSaving = false);
    return;
  }

  final updated = ProfileData(
    id: widget.profile.id,
    firstName: _firstNameController.text.trim(),
    lastName: _lastNameController.text.trim(),
    studentId: widget.profile.isCurrentStudent ? widget.profile.studentId : '',
    yearLevel: _yearLevelController.text.trim(),
    program: _programController.text.trim(),
    schoolEmail: widget.profile.usesSchoolLogin ? widget.profile.schoolEmail : '',
    personalEmail: widget.profile.usesSchoolLogin ? '' : widget.profile.personalEmail,
    role: widget.profile.role,
    profileImageUrl: widget.profile.profileImageUrl,
  );

  try {
    var saved = await MongoDataApiService.instance.updateProfile(
      profile: updated,
    );
    if (_image != null) {
      final bytes = await _image!.readAsBytes();
      final fileName = _image!.path.split(Platform.pathSeparator).last;
      try {
        saved = await MongoDataApiService.instance.uploadProfilePhoto(
          bytes: bytes,
          fileName: fileName,
        );
        _profileImageUrl = saved.profileImageUrl;
      } catch (error) {
        if (mounted) {
          await showSimpleMessageDialog(
            context,
            error.toString().replaceFirst('Exception: ', ''),
            title: 'Photo upload failed',
          );
        }
      }
    }
    if (!mounted) return;
    Navigator.pop(context, saved);
  } catch (error) {
    if (!mounted) return;
    await showSimpleMessageDialog(
      context,
      error.toString().replaceFirst('Exception: ', ''),
      title: 'Could not save changes',
    );
  } finally {
    if (mounted) setState(() => _isSaving = false);
  }
}
```

[edit_profile_screen.dart:720](/C:/Users/andre/Documents/capstone/mobile/lib/screens/edit_profile_screen.dart:720) — _buildSaveBar()

```dart
Widget _buildSaveBar() {
  final canSave = _hasChanges && !_isSaving;
  return SafeArea(
    top: false,
    child: Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8EC))),
      ),
      child: Center(
        // A bottom bar receives the full page height as a loose constraint.
        // Shrink-wrap it so it cannot cover the app bar and form.
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              key: const Key('save_profile_button'),
              onPressed: canSave ? _handleSave : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: _darkNavy,
                foregroundColor: Colors.white,
                disabledBackgroundColor: const Color(0xFFDDE3E7),
                disabledForegroundColor: const Color(0xFF7B878F),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
              icon: _isSaving ? const ButtonProgressIndicator() : const Icon(Icons.save_outlined),
              label: Text(
                _isSaving ? 'Saving changes...' : 'Save changes',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
```


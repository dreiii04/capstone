import 'package:capstone_project/screens/home_screen.dart';
import 'package:capstone_project/screens/pending_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../models/api_date_time.dart';
import '../models/document_catalog.dart';
import '../models/profile_data.dart';
import '../widgets/custom_font.dart';
import '../services/mongo_data_api_service.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/simple_message_dialog.dart';
import '../widgets/request_progress_indicator.dart';

class RequestFormScreen extends StatefulWidget {
  final ProfileData? profile;
  final bool? isAlumni; // kept for backward compatibility

  const RequestFormScreen({
    super.key,
    this.profile,
    this.isAlumni,
  });

  @override
  State<RequestFormScreen> createState() => _RequestFormScreenState();
}

class _RequestFormScreenState extends State<RequestFormScreen> {
  // --- State Variables ---
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  String? _mainDocType;
  String? _selectedPurpose;
  bool _isConfirmed = false;
  bool _isSubmitting = false;
  String _userRole = '';
  @override
  void initState() {
    super.initState();
    if (widget.profile != null) {
      _userRole = widget.profile!.documentEligibilityRole;
    } else if (widget.isAlumni == true) {
      _userRole = 'alumni';
    } else {
      final cached = MongoDataApiService.instance.cachedProfile;
      if (cached != null) {
        _userRole = cached.documentEligibilityRole;
      }
      _resolveUserRole();
    }
  }

  Future<void> _resolveUserRole() async {
    final cached = MongoDataApiService.instance.cachedProfile;
    if (cached != null) {
      final resolved = cached.documentEligibilityRole;
      if (resolved != _userRole && mounted) {
        setState(() {
          _userRole = resolved;
          _clearInvalidSelection();
        });
      }
      return;
    }
    try {
      final profile = await MongoDataApiService.instance.fetchProfile();
      final resolved = profile.documentEligibilityRole;
      if (mounted && resolved != _userRole) {
        setState(() {
          _userRole = resolved;
          _clearInvalidSelection();
        });
      }
    } catch (_) {}
  }

  void _clearInvalidSelection() {
    if (_mainDocType != null &&
        !isDocumentAllowedForRole(_mainDocType!, _userRole)) {
      _mainDocType = null;
    }
  }

  List<DocumentOption> get _availableDocs =>
      getAvailableDocumentOptions(normalizedRole: _userRole);

  final TextEditingController _otherPurposeController = TextEditingController();

  final List<String> purposes = [
    'Employment',
    'Board Exam',
    'Personal Use',
    'Transfer',
    'Others'
  ];

  // --- Logic Methods ---

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(15.r)),
        title: Text("Notice",
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18.sp)),
        content: Text(message, style: TextStyle(fontSize: 14.sp)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("OK",
                style: TextStyle(
                    color: Color(0xFF233446), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  double _parseAmount(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) {
      final parsed = double.tryParse(value);
      if (parsed != null) return parsed;
    }
    return 0;
  }

  String? _validateOtherInput(String? value, String fieldName) {
    final trimmed = value?.trim() ?? '';
    final wordCount = trimmed.isEmpty
        ? 0
        : trimmed.split(RegExp(r'\s+')).where((word) => word.isNotEmpty).length;

    if (trimmed.isEmpty) {
      return 'Please specify $fieldName.';
    }

    if (trimmed.length < 3 && wordCount < 2) {
      return 'Please enter at least 3 characters or 2 words.';
    }

    return null;
  }

  Future<void> _handleSubmission() async {
    if (_isSubmitting) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;

    // Check Checkbox
    if (!_isConfirmed) {
      _showErrorDialog(
          "Please confirm that your details are accurate by checking the box.");
      return;
    }

    // Prepare data for the Tracking screen.
    String finalDocName = _mainDocType!;

    String finalPurpose = (_selectedPurpose == 'Others')
        ? _otherPurposeController.text.trim()
        : _selectedPurpose!;

    if (!isDocumentAllowedForRole(finalDocName, _userRole)) {
      _showErrorDialog("You are not eligible to request this document.");
      return;
    }

    final amountLabel =
        'Total: PHP ${documentPriceForName(finalDocName).toStringAsFixed(2)}.';
    setState(() => _isSubmitting = true);
    final confirmed = await showConfirmationDialog(
      context,
      title: 'Submit Request',
      message:
          'Submit a request for "$finalDocName" for "$finalPurpose"? $amountLabel',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      icon: Icons.description_outlined,
    );
    if (!mounted) return;
    if (!confirmed) { setState(() => _isSubmitting = false); return; }

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
    final requestMap = requestData is Map
        ? Map<String, dynamic>.from(requestData)
        : <String, dynamic>{};
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

  bool get _hasEnteredData {
    return _mainDocType != null ||
        _selectedPurpose != null ||
        _otherPurposeController.text.trim().isNotEmpty;
  }

  Future<bool> _confirmDiscard() async {
    if (_isSubmitting || !_hasEnteredData) return true;
    return await showConfirmationDialog(
      context,
      title: 'Discard Request?',
      message:
          'Are you sure you want to exit? Any entered information will be lost.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      isDestructive: true,
      icon: Icons.warning_amber_rounded,
    );
  }

  Future<void> _handleBack() async {
    final shouldPop = await _confirmDiscard();
    if (shouldPop && mounted) {
      Navigator.maybePop(context);
    }
  }

  Future<void> _handleCancel() async {
    final shouldPop = await _confirmDiscard();
    if (shouldPop && mounted) {
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
  }

  @override
  void dispose() {
    _otherPurposeController.dispose();
    super.dispose();
  }

  // --- UI Build ---

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_hasEnteredData && !_isSubmitting,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final shouldPop = await _confirmDiscard();
        if (shouldPop && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F5F5), // Light grey background
        appBar: AppBar(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          elevation: 0,
          centerTitle: true,
          automaticallyImplyLeading: false,
          leading: IconButton(
            key: const Key('request_form_back_button'),
            tooltip: 'Back to data consent',
            onPressed: _isSubmitting ? null : _handleBack,
            icon: const Icon(
              Icons.arrow_back_rounded,
              color: Color(0xFF233446),
            ),
          ),
          title: Image.asset(
            'assets/logo/logo.png',
            width: 92.w,
            height: 30.h,
            fit: BoxFit.contain,
          ),
          actions: [
            TextButton(
              onPressed: _isSubmitting ? null : _handleCancel,
              child: Text(
                'Cancel',
                style: TextStyle(
                  color: _isSubmitting
                      ? const Color(0xFFAAB3B9)
                      : const Color(0xFF356A94),
                  fontSize: 12.sp,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            SizedBox(width: 6.w),
          ],
          bottom: PreferredSize(
            preferredSize: Size.fromHeight(47.h),
            child: RequestProgressIndicator(
              currentStep: _isSubmitting ? 2 : 1,
            ),
          ),
        ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(25.w),
        child: Form(
          key: _formKey,
          autovalidateMode: AutovalidateMode.onUserInteraction,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Document Request",
                  style:
                      TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold)),
              SizedBox(height: 20.h),

              // Document Price List
              Text("Available Documents and Prices",
                  style: TextStyle(
                      fontSize: 14.sp,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87)),
              SizedBox(height: 12.h),
              _buildPriceListTable(),
              SizedBox(height: 30.h),

              // Document Dropdown
              _buildLabel("Document:"),
              _buildDropdown(
                hint: "Choose Document",
                value: _mainDocType,
                items: _availableDocs.map((doc) => doc.name).toList(),
                onChanged: (val) => setState(() => _mainDocType = val),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Please select a document.';
                  }
                  return null;
                },
              ),

              // 3. Purpose Dropdown
              _buildLabel("Purpose of Request:"),
              _buildDropdown(
                hint: "Purpose of Request",
                value: _selectedPurpose,
                items: purposes,
                onChanged: (val) => setState(() => _selectedPurpose = val),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Please select a purpose.';
                  }
                  return null;
                },
              ),

              // 4. Conditional Other Field
              if (_selectedPurpose == 'Others') ...[
                SizedBox(height: 10.h),
                TextFormField(
                  controller: _otherPurposeController,
                  decoration: _inputDecoration(hint: "Please specify purpose"),
                  validator: (value) =>
                      _validateOtherInput(value, 'the purpose'),
                ),
              ],

              SizedBox(height: 30.h),

              // 5. Checkbox
              Row(
                children: [
                  Checkbox(
                    value: _isConfirmed,
                    activeColor: const Color(0xFF5D7E97),
                    onChanged: (val) => setState(() => _isConfirmed = val!),
                  ),
                  Expanded(
                    child: Text(
                      "I confirm that the details I provided are true, accurate, and complete.",
                      style: TextStyle(fontSize: 11.sp, color: Colors.black54),
                    ),
                  ),
                ],
              ),

              SizedBox(height: 20.h),

              // 6. Submit Button
              Align(
                alignment: Alignment.bottomRight,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _handleSubmission,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF233446), // Dark Navy
                    padding:
                        EdgeInsets.symmetric(horizontal: 45.w, vertical: 12.h),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8.r)),
                  ),
                  child: Text(_isSubmitting ? "Submitting..." : "Submit",
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 16.sp,
                          fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }

  // --- Helper Widgets ---

  Widget _buildLabel(String text) {
    return Padding(
      padding: EdgeInsets.only(bottom: 8.h, top: 15.h),
      child: Text(text,
          style: TextStyle(
              fontSize: 14.sp,
              fontWeight: FontWeight.w600,
              color: Colors.black87)),
    );
  }

  Widget _buildDropdown(
      {required String hint,
      String? value,
      required List<String> items,
      required Function(String?) onChanged,
      String? Function(String?)? validator}) {
    return Container(
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
              borderRadius: BorderRadius.circular(8.r),
              borderSide: BorderSide.none),
        ),
        validator: validator,
        items: items
            .map((e) => DropdownMenuItem(
                value: e, child: Text(e, style: TextStyle(fontSize: 13.sp))))
            .toList(),
        onChanged: onChanged,
      ),
    );
  }

  InputDecoration _inputDecoration({String? hint}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(fontSize: 13.sp, color: Colors.grey),
      filled: true,
      fillColor: Colors.white,
      contentPadding: EdgeInsets.symmetric(horizontal: 15.w, vertical: 15.h),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8.r),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8.r),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
    );
  }

  Widget _buildPriceListTable() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.r),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Table(
        columnWidths: const {
          0: FlexColumnWidth(3),
          1: FlexColumnWidth(1),
        },
        children: [
          TableRow(
            decoration: const BoxDecoration(
              color: Color(0xFF5D7E97),
              borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
            ),
            children: [
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
                child: Text('Document',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 12.sp)),
              ),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
                child: Text('Price (₱)',
                    textAlign: TextAlign.end,
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 12.sp)),
              ),
            ],
          ),
          ..._availableDocs.map(
            (doc) => TableRow(
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(color: Colors.grey.shade200, width: 1),
                ),
              ),
              children: [
                Padding(
                  padding: EdgeInsets.symmetric(
                      horizontal: 12.w, vertical: 8.h),
                  child: Text(
                    doc.name,
                    style: TextStyle(
                        fontSize: 11.sp, color: Colors.black87),
                  ),
                ),
                Padding(
                  padding: EdgeInsets.symmetric(
                      horizontal: 12.w, vertical: 8.h),
                  child: Text(
                    doc.price == 0 ? 'Varies' : doc.price.toStringAsFixed(2),
                    textAlign: TextAlign.end,
                    style: TextStyle(
                        fontSize: 11.sp,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF233446)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ----SUCCESS SCREEN ----

class SuccessfulScreen extends StatelessWidget {
  final PendingRequest request;

  const SuccessfulScreen({
    super.key,
    required this.request,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 40.w),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                height: 120.r,
                width: 120.r,
                decoration: const BoxDecoration(
                  color: Color(0xFF9DB2BF),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.check,
                  color: Colors.white,
                  size: 80.r,
                ),
              ),
              SizedBox(height: 30.h),
              CustomFont(
                text: "Request Submitted Successfully",
                fontSize: 20.sp,
                fontWeight: FontWeight.bold,
                color: Colors.black,
              ),
              Text(
                "Your document request has been submitted. You can follow its current status and future updates in Tracking.",
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14.sp, color: Colors.black54),
              ),
              SizedBox(height: 50.h),
              ElevatedButton(
                onPressed: () {
                  Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const HomeScreen(
                        initialIndex: 1,
                      ),
                    ),
                    (route) => false,
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF27374D),
                  fixedSize: Size(340.w, 50.h),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8.r),
                  ),
                  elevation: 5,
                ),
                child: CustomFont(
                  text: "Proceed",
                  fontSize: 18.sp,
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

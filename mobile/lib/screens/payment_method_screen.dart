import '../widgets/payment_summary.dart';
import '../widgets/confirmation_dialog.dart';
import 'dart:typed_data';

import 'package:capstone_project/screens/home_screen.dart';
import 'package:capstone_project/screens/pending_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:image_picker/image_picker.dart';
import '../services/mongo_data_api_service.dart';
import '../widgets/custom_font.dart';
import '../widgets/simple_message_dialog.dart';

class PaymentMethodScreen extends StatefulWidget {
  final PendingRequest request;
  const PaymentMethodScreen({super.key, required this.request});

  @override
  State<PaymentMethodScreen> createState() => _PaymentMethodScreenState();
}

class _PaymentMethodScreenState extends State<PaymentMethodScreen> {
  bool _acknowledged = false;
  bool _isSubmitting = false;
  final ImagePicker _picker = ImagePicker();
  Uint8List? _receiptBytes;
  String? _receiptName;

  bool get _hasReceipt => _receiptBytes != null;
  bool get _isResubmission => widget.request.correctionType == 'receipt';
  String _amountLabel(double value) => 'PHP ${value.toStringAsFixed(2)}';
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

  void _removeReceipt() {
    setState(() {
      _receiptBytes = null;
      _receiptName = null;
      _acknowledged = false;
    });
  }

  void _showReceiptSourceSheet() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera),
              title: const Text('Take photo'),
              onTap: () {
                Navigator.pop(context);
                _pickReceipt(source: ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from gallery'),
              onTap: () {
                Navigator.pop(context);
                _pickReceipt(source: ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

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

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          backgroundColor: const Color(0xFF5D7E97),
          title: CustomFont(
              text: _isResubmission ? 'Resubmit Receipt' : 'Payment Method',
              color: Colors.white,
              fontSize: 20.sp,
              fontWeight: FontWeight.bold),
        ),
        body: SingleChildScrollView(
          child: Padding(
            padding: EdgeInsets.all(20.w),
            child: Column(
              children: [
                paymentSummaryCard(_isResubmission ? 'Existing Payment' : 'Billing Summary', [
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
                    _isResubmission ? 'Payment Amount' : 'Total Amount Due',
                    _amountLabel(widget.request.totalAmount),
                    isBold: true,
                  ),
                ]),

                SizedBox(height: 20.h),
                if (_isResubmission) ...[
                  const Text(
                      'Your receipt needs an update. Upload a clearer image of the same payment; you do not need to pay again.'),
                  if (widget.request.receiptRejectionReason.isNotEmpty ||
                      widget.request.remarks.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                        'Reason: ${widget.request.receiptRejectionReason.isNotEmpty ? widget.request.receiptRejectionReason : widget.request.remarks}'),
                  ],
                  SizedBox(height: 16.h),
                ] else if (widget.request.remarks.isNotEmpty)
                  Text(widget.request.remarks),
                if (_receiptBytes != null)
                  Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Image.memory(_receiptBytes!,
                          height: 220,
                          fit: BoxFit.contain,
                          errorBuilder: (_, error, stack) => const Text('Preview unavailable'))),
                // Receipt Upload
                Container(
                  padding: EdgeInsets.all(20.r),
                  decoration: BoxDecoration(
                      color: const Color(0xFFF5F5F5), borderRadius: BorderRadius.circular(10.r)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CustomFont(
                          text: _hasReceipt
                              ? 'Receipt Image'
                              : (_isResubmission ? 'Replacement Receipt' : 'Upload Receipt'),
                          fontSize: 16.sp,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF233446)),
                      SizedBox(height: 12.h),
                      _buildReceiptSection(
                        title: "Receipt",
                        description: _hasReceipt
                            ? 'Remove this image to choose a different receipt.'
                            : (_isResubmission
                                ? 'Choose a new, readable image of the same payment.'
                                : 'Upload your official receipt file.'),
                        buttonLabel: _hasReceipt
                            ? 'Remove image'
                            : (_isResubmission ? 'Choose new receipt' : 'Upload file'),
                        buttonIcon: _hasReceipt ? Icons.delete_outline : Icons.upload_file,
                        onPressed: _isSubmitting
                            ? null
                            : (_hasReceipt ? _removeReceipt : _showReceiptSourceSheet),
                        fileName: _receiptName,
                      ),
                    ],
                  ),
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _acknowledged,
                  activeColor: const Color(0xFF233446),
                  controlAffinity: ListTileControlAffinity.leading,
                  title: CustomFont(
                    text: "I confirm the details and uploaded receipt are correct.",
                    fontSize: 11.sp,
                    color: Colors.black87,
                  ),
                  onChanged: _isSubmitting
                      ? null
                      : (value) {
                          setState(() {
                            _acknowledged = value ?? false;
                          });
                        },
                ),
                if (!_hasReceipt)
                  Padding(
                    padding: EdgeInsets.only(left: 8.w, bottom: 6.h),
                    child: CustomFont(
                      text: _isResubmission
                          ? 'Choose a replacement receipt to continue.'
                          : 'Upload a receipt to continue.',
                      fontSize: 10.sp,
                      color: Colors.redAccent,
                    ),
                  ),
                SizedBox(height: 10.h),
                ElevatedButton(
                  onPressed: _acknowledged && _hasReceipt && !_isSubmitting ? _submitPayment : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF233446),
                    fixedSize: Size(double.infinity, 50.h),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : CustomFont(
                          text: _isResubmission ? 'Resubmit Receipt' : 'Confirm Payment',
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16.sp),
                ),
              ],
            ),
          ),
        ),
      );

  Widget _buildReceiptSection({
    required String title,
    required String description,
    required String buttonLabel,
    required IconData buttonIcon,
    required VoidCallback? onPressed,
    String? fileName,
  }) =>
      Container(
        padding: EdgeInsets.all(12.r),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10.r),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CustomFont(
                text: title,
                fontSize: 14.sp,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF233446)),
            SizedBox(height: 4.h),
            CustomFont(text: description, fontSize: 11.sp, color: Colors.black54),
            SizedBox(height: 8.h),
            OutlinedButton.icon(
              onPressed: onPressed,
              icon: Icon(buttonIcon),
              label: Text(buttonLabel),
            ),
            if (fileName != null && fileName.trim().isNotEmpty) ...[
              SizedBox(height: 6.h),
              CustomFont(text: fileName, fontSize: 10.sp, color: Colors.black54),
            ],
          ],
        ),
      );
}

class SuccessfulScreen extends StatelessWidget {
  final PendingRequest request;

  const SuccessfulScreen({super.key, required this.request});

  @override
  Widget build(BuildContext context) => Scaffold(
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
                  decoration: const BoxDecoration(color: Color(0xFF9DB2BF), shape: BoxShape.circle),
                  child: Icon(Icons.check, color: Colors.white, size: 80.r),
                ),
                SizedBox(height: 30.h),
                CustomFont(
                    text: request.correctionType == 'receipt'
                        ? 'New Receipt Submitted'
                        : 'Receipt Submitted',
                    fontSize: 24.sp,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF233446)),
                SizedBox(height: 10.h),
                CustomFont(
                  text: request.correctionType == 'receipt'
                      ? 'Your new receipt has been submitted and is waiting for verification.'
                      : 'Your receipt has been submitted and is waiting for verification.',
                  textAlign: TextAlign.center,
                  fontSize: 13.sp,
                  color: Colors.black54,
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
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
                  ),
                  child: CustomFont(
                      text: "Proceed",
                      fontSize: 18.sp,
                      color: Colors.white,
                      fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ),
      );
}

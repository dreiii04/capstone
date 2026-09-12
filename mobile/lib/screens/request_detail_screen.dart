import 'package:capstone_project/constants.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:intl/intl.dart';
import '../widgets/custom_font.dart';
import '../screens/payment_details_screen.dart';
import '../screens/pending_screen.dart';
import '../models/request_status.dart';

class RequestDetailsScreen extends StatelessWidget {
import '../services/mongo_data_api_service.dart';

class RequestDetailsScreen extends StatefulWidget {
  final PendingRequest request;
  const RequestDetailsScreen({super.key, required this.request});

  @override
  State<RequestDetailsScreen> createState() => _RequestDetailsScreenState();
}

class _RequestDetailsScreenState extends State<RequestDetailsScreen> {
  bool _isClaiming = false;

  String _amountLabel(double value) => 'PHP ${value.toStringAsFixed(2)}';

  Future<void> _handleClaim() async {
    final requestId = widget.request.requestId?.trim() ?? '';
    if (requestId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Missing Request ID. Please refresh and try again.'),
        ),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Claim Document'),
        content: Text(
          'Have you received your ${widget.request.docName}? This will confirm receipt and move the request to History.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2E7D32),
            ),
            child: const Text(
              'Confirm Claim',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _isClaiming = true);
    try {
      await MongoDataApiService.instance.claimRequest(requestId: requestId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Document claimed successfully! Moved to History.'),
          backgroundColor: Color(0xFF2E7D32),
        ),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isClaiming = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceFirst(RegExp(r'^Exception:\s*'), ''),
          ),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final request = this.request;
    final request = widget.request;
    final statusUpper = request.status.toUpperCase();
    final needsPayment = requestNeedsPayment(request.status);
    final canPay = needsPayment && request.totalAmount > 0;
    final pendingCompletion = statusUpper == 'PENDING TO COMPLETE';
    final statusNote = needsPayment
        ? "Payment is required to continue processing your request. Please complete your payment to proceed."
        : pendingCompletion
            ? "Payment received. Your request is pending completion."
            : "Your request is being processed.";
    final isReadyToClaim =
        statusUpper == 'READY TO CLAIM' || statusUpper == 'RELEASED';
    final isClaimed = statusUpper == 'CLAIMED';
    final isProcessing =
        statusUpper == 'PROCESSING' || statusUpper == 'IN PROCESS';
    final isPending =
        statusUpper == 'PENDING' || statusUpper == 'PENDING TO COMPLETE';

    final String statusNote;
    if (needsPayment) {
      statusNote =
          "Payment is required to continue processing your request. Please complete your payment to proceed.";
    } else if (isReadyToClaim) {
      statusNote = "Your document is ready to claim! Tap below to confirm receipt.";
      statusNote =
          "Your document is ready for pickup/claim! Please proceed to the Registrar's Office to claim your document.";
    } else if (isClaimed) {
      statusNote = "Document claimed.";
      statusNote = "This document has been claimed.";
    } else if (isProcessing) {
      statusNote = "Your request is being processed.";
    } else if (isPending) {
      statusNote = "Payment received. Your request is pending processing.";
    } else {
      statusNote = "Your request is being processed.";
    }

    Color badgeBgColor = Colors.yellow.shade100;
    Color badgeTextColor = Colors.yellow.shade800;
    if (isReadyToClaim || isClaimed) {
      badgeBgColor = const Color(0xFFD4EDDA);
      badgeTextColor = const Color(0xFF155724);
    } else if (isProcessing) {
      badgeBgColor = const Color(0xFFE8F5E9);
      badgeTextColor = const Color(0xFF2E7D32);
    } else if (isPending) {
      badgeBgColor = const Color(0xFFDDEAF2);
      badgeTextColor = const Color(0xFF356A86);
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF5D7E97),
        title: const Text(
          "Information of the Request",
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: fbTextColorWhite),
        ),
        leading: IconButton(
          key: const Key('request_detail_back_button'),
          tooltip: 'Back to requests',
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => Navigator.maybePop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(20.w),
        child: Column(
          children: [
            _buildSectionCard("Document Details", [
              if (request.requestId != null && request.requestId!.isNotEmpty)
                _buildInfoRow("Request ID:", request.requestId!),
              _buildInfoRow("Type of Document:", request.docName),
              _buildInfoRow("Purpose of Request:", request.purpose),
              _buildInfoRow("Date Requested:",
                  DateFormat('MMMM d, y').format(request.dateCreated)),
            ]),
            SizedBox(height: 15.h),
            _buildSectionCard("Request Status", [
              _buildInfoRow(
                  "Date:", DateFormat('MMMM d, y').format(request.dateCreated)),
              _buildInfoRow(
                  "Time:", DateFormat('h:mm a').format(request.dateCreated)),
              SizedBox(height: 10.h),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                decoration: BoxDecoration(
                    color: Colors.yellow.shade100,
                    borderRadius: BorderRadius.circular(5.r)),
                child: Text(request.status,
                    style: TextStyle(
                        color: Colors.yellow.shade800,
                        fontWeight: FontWeight.bold)),
                  color: badgeBgColor,
                  borderRadius: BorderRadius.circular(5.r),
                ),
                child: Text(
                  request.status,
                  style: TextStyle(
                    color: badgeTextColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              SizedBox(height: 10.h),
              Text(
                statusNote,
                style: TextStyle(
                  color: needsPayment ? Colors.red : Colors.black54,
                  fontSize: 11,
                ),
              ),
            ]),
            SizedBox(height: 15.h),
            _buildSectionCard("Payment Summary", [
              _buildInfoRow(
                "Document Price:",
                _amountLabel(request.documentPrice),
              ),
              const Divider(),
              _buildInfoRow(
                "Total Amount Due:",
                _amountLabel(request.totalAmount),
                isBold: true,
              ),
              SizedBox(height: 15.h),
              if (needsPayment && !canPay)
                const Text(
                  'The Registrar must set the payment amount before you can pay.',
                  style: TextStyle(color: Colors.redAccent),
                ),
              if (canPay)
                Align(
                  alignment: Alignment.centerRight,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) =>
                              PaymentDetailsScreen(request: request),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF233446)),
                    child: CustomFont(
                        text: "Pay now",
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 14.sp),
                  ),
                ),
              if (isReadyToClaim)
                Align(
                  alignment: Alignment.centerRight,
                  child: ElevatedButton.icon(
                    key: const Key('claim_document_button'),
                    onPressed: _isClaiming ? null : _handleClaim,
                    icon: _isClaiming
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.check_circle_outline, color: Colors.white),
                    label: CustomFont(
                      text: _isClaiming ? "Claiming..." : "Claim Document",
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14.sp,
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2E7D32),
                      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 10.h),
                    ),
                  ),
                ),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionCard(String title, List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(15.r),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10.r),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold)),
          const Divider(),
          ...children,
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 4.h),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(
              label,
              style: TextStyle(fontSize: 13.sp, color: Colors.black54),
            ),
          ),
          SizedBox(width: 12.w),
          Expanded(
            flex: 6,
            child: Text(
              value,
              textAlign: TextAlign.end,
              softWrap: true,
              style: TextStyle(
                fontSize: 13.sp,
                fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

import '../widgets/request_status_tracker.dart';
import 'payment_method_screen.dart';
import 'package:capstone_project/constants.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:intl/intl.dart';
import '../widgets/custom_font.dart';
import '../screens/payment_details_screen.dart';
import '../screens/pending_screen.dart';
import '../models/request_status.dart';

class RequestDetailsScreen extends StatelessWidget {
  final PendingRequest request;
  const RequestDetailsScreen({super.key, required this.request});

  String _amountLabel(double value) => 'PHP ${value.toStringAsFixed(2)}';

  @override
  Widget build(BuildContext context) {
    final statusUpper = request.status.toUpperCase();
    final needsPayment = requestNeedsPayment(request.status);
    final isPendingForPayment =
        statusUpper == 'PENDING FOR PAYMENT' || needsPayment;
    final canPay = isPendingForPayment && request.totalAmount > 0;
    final isReadyToClaim =
        statusUpper == 'READY TO CLAIM' || statusUpper == 'RELEASED';
    final isClaimed = statusUpper == 'CLAIMED';
    final isProcessing =
        statusUpper == 'PROCESSING' || statusUpper == 'IN PROCESS';
    final isPending =
        statusUpper == 'PENDING' || statusUpper == 'PENDING TO COMPLETE';
    final receiptPending = request.receiptStatus == 'Pending Verification';
    final receiptNeedsUpdate = request.correctionType == 'receipt' &&
        const ['Rejected', 'Needs Update'].contains(request.receiptStatus);

    String statusNote;
    if (isPendingForPayment) {
      statusNote =
          "Payment is required to continue processing your request. Please complete your payment to proceed.";
    } else if (isReadyToClaim) {
      statusNote =
          "Your document is ready to claim. Please proceed to the Registrar's Office to claim your document.";
    } else if (isClaimed) {
      statusNote = "This document has been claimed.";
    } else if (isProcessing) {
      statusNote = "Your request is currently being processed.";
    } else if (receiptNeedsUpdate) {
      statusNote = 'Your receipt needs to be updated before your request can continue.';
    } else if (receiptPending) {
      statusNote = 'Pending Verification: Your receipt is waiting for review.';
    } else if (isPending) {
      statusNote =
          "Your request has been received and is waiting for processing.";
    } else {
      statusNote = request.remarks.isNotEmpty ? request.remarks : "Current registrar status: ${request.status}.";
    }

    Color badgeBgColor = const Color(0xFFFEF9C3);
    Color badgeTextColor = const Color(0xFF854D0E);
    if (isPendingForPayment) {
      badgeBgColor = const Color(0xFFFEF3C7);
      badgeTextColor = const Color(0xFFB45309);
    } else if (isReadyToClaim || isClaimed) {
      badgeBgColor = const Color(0xFFD4EDDA);
      badgeTextColor = const Color(0xFF155724);
    } else if (isProcessing) {
      badgeBgColor = const Color(0xFFFFEDD5);
      badgeTextColor = const Color(0xFFC2410C);
    } else if (isPending) {
      badgeBgColor = const Color(0xFFFEF9C3);
      badgeTextColor = const Color(0xFF854D0E);
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
              _buildInfoRow("Processing:", request.processingOption.toUpperCase()),
              _buildInfoRow("Purpose of Request:", request.purpose),
              _buildInfoRow("Date Requested:",
                  DateFormat('MMMM d, y').format(request.dateCreated)),
              if (isProcessing) ...[
                const Divider(),
                if (request.processingStartedAt != null)
                  _buildInfoRow("Processing Started:",
                      DateFormat('MMMM d, y').format(request.processingStartedAt!)),
                if (request.estimatedProcessingStart != null)
                  _buildInfoRow("Estimated Processing Start:",
                      DateFormat('MMMM d, y').format(request.estimatedProcessingStart!)),
                if (request.processingDays != null)
                  _buildInfoRow("Processing Time:",
                      '${request.processingDays} business days'),
                _buildInfoRow("Estimated Completion:",
                    request.estimatedCompletionDate == null
                        ? 'Not yet available'
                        : DateFormat('MMMM d, y')
                            .format(request.estimatedCompletionDate!)),
              ],
            ]),
            SizedBox(height: 15.h),
            RequestStatusTracker(status: request.status, createdAt: request.dateCreated,
              history: request.statusHistory, remarks: request.remarks,
              processingStartedAt: request.processingStartedAt,
              estimatedProcessingStart: request.estimatedProcessingStart,
              estimatedCompletionDate: request.estimatedCompletionDate),
            if (receiptNeedsUpdate)
              Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: _buildSectionCard('Receipt Needs Update', [
                const Text('Your submitted receipt could not be verified. Please upload a clearer or valid receipt.'),
                const SizedBox(height: 8),
                Text('Reason: ${request.receiptRejectionReason.isNotEmpty ? request.receiptRejectionReason : request.remarks}'),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  icon: const Icon(Icons.upload_file), label: const Text('Resubmit Receipt'),
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PaymentMethodScreen(request: request))),
                ),
              ])),
            if (receiptPending)
              Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: _buildSectionCard('Pending Verification', [
                const Text('Your receipt has been submitted and is waiting for verification.'),
              ])),
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
                  color: isPendingForPayment ? const Color(0xFFB45309) : Colors.black54,
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
              if (request.totalAmount > request.documentPrice)
                _buildInfoRow("Processing Fee:", _amountLabel(request.totalAmount - request.documentPrice)),
              const Divider(),
              _buildInfoRow(
                "Total Amount Due:",
                _amountLabel(request.totalAmount),
                isBold: true,
              ),
              SizedBox(height: 15.h),
              if (isPendingForPayment && !canPay)
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

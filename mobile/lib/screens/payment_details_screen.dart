import '../widgets/payment_summary.dart';
import 'package:capstone_project/screens/pending_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../widgets/custom_font.dart';
import '../screens/payment_method_screen.dart';

class PaymentDetailsScreen extends StatefulWidget {
  final PendingRequest request;

  const PaymentDetailsScreen({super.key, required this.request});

  @override
  State<PaymentDetailsScreen> createState() => _PaymentDetailsScreenState();
}

class _PaymentDetailsScreenState extends State<PaymentDetailsScreen> {
  bool _isConfirmed = false;

  String _amountLabel(double value) => 'PHP ${value.toStringAsFixed(2)}';

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          backgroundColor: const Color(0xFF5D7E97),
          centerTitle: true,
          title: CustomFont(
              text: "Payment Details",
              fontSize: 22.sp,
              color: Colors.white,
              fontWeight: FontWeight.bold),
        ),
        body: SingleChildScrollView(
          padding: EdgeInsets.all(20.w),
          child: Column(
            children: [
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
              ]),
              SizedBox(height: 15.h),
              paymentSummaryCard("GCash QR", [
                Center(
                  child: Image.asset(
                    'assets/image/sample_qr.png',
                    width: 200.r,
                    height: 200.r,
                    fit: BoxFit.contain,
                  ),
                ),
                SizedBox(height: 8.h),
                Center(
                  child: CustomFont(
                    text: "Scan to pay ${_amountLabel(widget.request.totalAmount)}",
                    fontSize: 12.sp,
                    color: Colors.black54,
                  ),
                ),
              ]),
              SizedBox(height: 20.h),
              Row(
                children: [
                  Checkbox(
                    value: _isConfirmed,
                    activeColor: const Color(0xFF5D7E97),
                    onChanged: (val) => setState(() => _isConfirmed = val!),
                  ),
                  Expanded(
                    child: CustomFont(
                      text:
                          "I confirm that the billing details are correct and I agree to proceed to the payment page.",
                      fontSize: 11.sp,
                      color: Colors.black54,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 30.h),
              Align(
                alignment: Alignment.bottomRight,
                child: ElevatedButton(
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
                ),
              ),
            ],
          ),
        ),
      );
}

import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'custom_font.dart';

Widget paymentSummaryCard(String title, List<Widget> children) {
  return Container(
    width: double.infinity,
    padding: EdgeInsets.all(16.r),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12.r),
      border: Border.all(color: const Color(0xFFE2E8F0)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CustomFont(
            text: title,
            fontSize: 16.sp,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF233446)),
        SizedBox(height: 12.h),
        ...children,
      ],
    ),
  );
}

Widget paymentInfoRow(String label, String value, {bool isBold = false}) {
  return Padding(
    padding: EdgeInsets.symmetric(vertical: 4.h),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        CustomFont(text: label, fontSize: 13.sp, color: Colors.black54),
        CustomFont(
            text: value,
            fontSize: 13.sp,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
            color: isBold ? const Color(0xFF233446) : Colors.black87),
      ],
    ),
  );
}

import 'package:capstone_project/screens/history_detail_screen.dart';
import 'package:capstone_project/screens/history_screen.dart';
import 'package:capstone_project/widgets/request_status_tracker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

HistoryItem _item(String status) => HistoryItem(
      requestId: 'REQ-123',
      title: 'Certified True Copy (CTC)',
      date: DateTime(2026, 10, 6),
      purpose: 'Employment',
      status: status,
      isApproved: true,
      totalAmount: 200,
      paymentType: 'receipt',
    );

void main() {
  testWidgets('Claimed appears in tracking only after the request is claimed',
      (tester) async {
    Future<void> show(String status) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: RequestStatusTracker(
            status: status,
            createdAt: DateTime(2026, 10, 6),
          ),
        ),
      ));
    }

    await show('READY TO CLAIM');
    expect(find.text('CLAIMED'), findsNothing);
    await show('CLAIMED');
    expect(find.text('CLAIMED'), findsOneWidget);
  });

  testWidgets('ready requests offer a claim action in History details',
      (tester) async {
    Future<void> show(String status) async {
      await tester.pumpWidget(MaterialApp(
        home: HistoryDetailScreen(item: _item(status)),
      ));
    }

    await show('Released');
    expect(find.text('READY TO CLAIM'), findsWidgets);
    expect(find.byKey(const Key('claim_document_button')), findsOneWidget);
    await show('Ready to Claim');
    expect(find.byKey(const Key('claim_document_button')), findsOneWidget);
    await show('Claimed');
    expect(find.byKey(const Key('claim_document_button')), findsNothing);
  });

  testWidgets('History offers a direct claim action only while ready',
      (tester) async {
    Future<void> show(String status) async {
      await tester.pumpWidget(MaterialApp(
        home: HistoryScreen(historyList: [_item(status)]),
      ));
    }

    await show('Ready to Claim');
    expect(find.byKey(const Key('claim_history_REQ-123')), findsOneWidget);
    await show('Claimed');
    expect(find.byKey(const Key('claim_history_REQ-123')), findsNothing);
  });
}

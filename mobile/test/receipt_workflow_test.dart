import 'package:capstone_project/screens/pending_screen.dart';
import 'package:capstone_project/screens/request_detail_screen.dart';
import 'package:capstone_project/widgets/request_status_tracker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('processing shows when the API has no estimate yet', (tester) async {
    await tester.pumpWidget(MaterialApp(home: Scaffold(body:
      SingleChildScrollView(child: RequestStatusTracker(
        status: 'PROCESSING', createdAt: DateTime(2026, 6, 1),
      )),
    )));
    expect(find.text('Est. processing'), findsOneWidget);
    expect(find.text('Awaiting estimate'), findsOneWidget);
  });

  testWidgets('estimated processing is hidden outside Processing', (tester) async {
    for (final status in [
      'PENDING FOR PAYMENT', 'PENDING', 'READY TO CLAIM', 'CLAIMED',
      'COMPLETED', 'REJECTED', 'NEEDS UPDATE', 'REFUNDED',
    ]) {
      await tester.pumpWidget(MaterialApp(home: Scaffold(body:
        SingleChildScrollView(child: RequestStatusTracker(
          status: status, createdAt: DateTime(2026, 6, 1),
          estimatedProcessingStart: DateTime(2026, 6, 2),
          estimatedCompletionDate: DateTime(2026, 6, 3),
        )),
      )));
      await tester.pump();
      expect(find.text('Est. processing'), findsNothing, reason: status);
    }
  });

  testWidgets('processing estimate appears only while processing', (tester) async {
    tester.view.physicalSize = const Size(1000, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    Future<void> show(String status) async {
      await tester.pumpWidget(ScreenUtilInit(
        designSize: const Size(412, 715),
        builder: (_, __) => MaterialApp(
          home: RequestDetailsScreen(request: PendingRequest(
            requestId: 'REQ-123', docName: 'F-137 (SH)', purpose: 'School',
            dateCreated: DateTime(2026, 9, 1), status: status,
            processingStartedAt: DateTime(2026, 9, 11),
            estimatedCompletionDate: DateTime(2026, 9, 16),
            processingDays: 3,
          )),
        ),
      ));
      await tester.pumpAndSettle();
    }

    await show('PROCESSING');
    expect(find.text('Processing Started:'), findsOneWidget);
    expect(find.text('Processing Time:'), findsOneWidget);
    expect(find.text('Estimated Completion:'), findsOneWidget);
    expect(find.text('September 16, 2026'), findsOneWidget);
    expect(find.text('Est. processing'), findsOneWidget);
    expect(find.text('16 Sep 2026'), findsOneWidget);
    await show('READY TO CLAIM');
    expect(find.text('Estimated Completion:'), findsNothing);
    expect(find.text('Est. processing'), findsNothing);
    expect(find.text('16 Sep 2026'), findsNothing);
  });

  testWidgets('stored estimated period is shown without a calculated duration',
      (tester) async {
    tester.view.physicalSize = const Size(1000, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(ScreenUtilInit(
      designSize: const Size(412, 715),
      builder: (_, __) => MaterialApp(home: RequestDetailsScreen(
        request: PendingRequest(
          docName: 'Transcript of Records (TOR)', purpose: 'Transfer',
          dateCreated: DateTime(2026, 10, 1), status: 'PROCESSING',
          estimatedProcessingStart: DateTime(2026, 10, 1),
          estimatedCompletionDate: DateTime(2026, 10, 6),
        ),
      )),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Estimated Processing Start:'), findsOneWidget);
    expect(find.text('Estimated Completion:'), findsOneWidget);
    expect(find.text('October 6, 2026'), findsOneWidget);
    expect(find.text('Est. processing'), findsOneWidget);
    expect(find.text('1–6 Oct 2026'), findsOneWidget);
    expect(find.text('Not yet available'), findsNothing);
  });

  testWidgets(
      'receipt update shows reason and resubmission without rejecting the request',
      (tester) async {
    tester.view.physicalSize = const Size(1000, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    PendingRequest request(
            {required String receiptStatus, String correctionType = ''}) =>
        PendingRequest(
          requestId: 'REQ-123',
          docName: 'Transcript of Records (TOR)',
          purpose: 'Employment',
          dateCreated: DateTime(2026, 1, 1),
          status: 'PENDING',
          correctionType: correctionType,
          receiptStatus: receiptStatus,
          receiptRejectionReason: 'Receipt is blurry',
          documentPrice: 600,
          totalAmount: 600,
        );

    Future<void> show(PendingRequest value) async {
      await tester.pumpWidget(ScreenUtilInit(
        designSize: const Size(412, 715),
        builder: (_, __) => MaterialApp(
          home: RequestDetailsScreen(request: value),
        ),
      ));
      await tester.pumpAndSettle();
    }

    await show(
        request(receiptStatus: 'Needs Update', correctionType: 'receipt'));
    expect(find.text('Receipt Needs Update'), findsOneWidget);
    expect(find.text('Reason: Receipt is blurry'), findsOneWidget);
    expect(find.text('Resubmit Receipt'), findsOneWidget);
    expect(find.text('Request Refund'), findsNothing);

    await show(request(receiptStatus: 'Pending Verification'));
    expect(find.text('Pending Verification'), findsOneWidget);
    expect(find.text('Resubmit Receipt'), findsNothing);
  });
}

import 'package:capstone_project/screens/register_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('student selection requires ID, school email and name',
      (tester) async {
    tester.view.physicalSize = const Size(1000, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const MaterialApp(home: RegisterScreen()));
    expect(find.text('Check email availability'), findsNothing);
    await tester.tap(find.byKey(const Key('student_status_field')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Student').last);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('student_id_field')), findsOneWidget);
    expect(find.byKey(const Key('student_grade_level_field')), findsOneWidget);
    expect(find.text('School Email'), findsOneWidget);
    expect(
        find.byKey(const ValueKey('educational_level_student')), findsNothing);
    final form = tester.state<FormState>(find.byType(Form));
    expect(form.validate(), isFalse);
    await tester.pump();
    expect(find.text('Enter your student ID'), findsOneWidget);
    expect(find.text('Select your grade level'), findsOneWidget);
    expect(find.text('Enter your school email'), findsOneWidget);
    expect(find.text('Enter your first name'), findsOneWidget);
    expect(find.text('Enter your last name'), findsOneWidget);

    await tester
        .ensureVisible(find.byKey(const Key('student_grade_level_field')));
    await tester.tap(find.byKey(const Key('student_grade_level_field')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Grade 12').last);
    await tester.pumpAndSettle();
    form.validate();
    await tester.pump();
    expect(find.text('Select your grade level'), findsNothing);
    expect(find.text('Grade 12'), findsOneWidget);
    expect(find.byKey(const ValueKey('student_program_shs')), findsOneWidget);
    form.validate();
    await tester.pump();
    expect(find.text('Select your program'), findsOneWidget);

    await tester
        .ensureVisible(find.byKey(const ValueKey('student_program_shs')));
    await tester.tap(find.byKey(const ValueKey('student_program_shs')));
    await tester.pumpAndSettle();
    await tester
        .tap(find.textContaining('Science, Technology, Engineering').last);
    await tester.pumpAndSettle();
    form.validate();
    await tester.pump();
    expect(find.text('Select your program'), findsNothing);

    await tester
        .ensureVisible(find.byKey(const Key('student_grade_level_field')));
    await tester.tap(find.byKey(const Key('student_grade_level_field')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('3rd Year').last);
    await tester.pumpAndSettle();
    expect(
        find.byKey(const ValueKey('student_program_college')), findsOneWidget);
    form.validate();
    await tester.pump();
    expect(find.text('Select your program'), findsOneWidget);

    await tester.ensureVisible(find.byKey(const Key('student_status_field')));
    await tester.tap(find.byKey(const Key('student_status_field')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Alumni').last);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('student_id_field')), findsNothing);
    expect(find.byKey(const Key('student_grade_level_field')), findsNothing);
    expect(find.text('School Email'), findsNothing);
    expect(
        find.byKey(const ValueKey('educational_level_alumni')), findsOneWidget);
  });
}

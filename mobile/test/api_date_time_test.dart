import 'package:capstone_project/models/api_date_time.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('estimated Mongo dates retain their stored calendar day', () {
    expect(tryParseApiCalendarDate('2026-10-06T00:00:00.000Z'),
        DateTime(2026, 10, 6));
    expect(tryParseApiCalendarDate('2026-10-06'), DateTime(2026, 10, 6));
    expect(tryParseApiCalendarDate(null), isNull);
  });

  test('formats estimated processing as a range or a single date', () {
    expect(formatEstimatedProcessingRange(
      DateTime(2026, 6, 2), DateTime(2026, 6, 3)), '2–3 Jun 2026');
    expect(formatEstimatedProcessingRange(
      DateTime(2026, 6, 30), DateTime(2026, 7, 2)), '30 Jun–2 Jul 2026');
    expect(formatEstimatedProcessingRange(null, DateTime(2026, 6, 3)),
      '3 Jun 2026');
    expect(formatEstimatedProcessingRange(null, null), isNull);
  });
}

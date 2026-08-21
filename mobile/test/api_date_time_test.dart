import 'package:capstone_project/models/api_date_time.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('UTC API timestamps are converted to Philippine time', () {
    final parsed = parseApiDateTime('2026-08-19T06:28:00.000Z');
    final expected = DateTime(2026, 8, 19, 14, 28);

    expect(parsed, expected);
    expect(parsed.isUtc, isFalse);
  });

  test('epoch timestamps are converted to Philippine time', () {
    final epoch = DateTime.utc(2026, 8, 19, 6, 28).millisecondsSinceEpoch;
    expect(parseApiDateTime(epoch), DateTime(2026, 8, 19, 14, 28));
  });

  test('timezone-free timestamps keep their supplied wall-clock time', () {
    final parsed = parseApiDateTime('2026-08-19T14:28:00');
    expect(parsed, DateTime(2026, 8, 19, 14, 28));
  });
}

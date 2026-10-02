import 'package:intl/intl.dart';

const Duration _philippineUtcOffset = Duration(hours: 8);

DateTime _toPhilippineWallClock(DateTime value) {
  final utc = value.toUtc();
  final philippines = utc.add(_philippineUtcOffset);
  return DateTime(
    philippines.year,
    philippines.month,
    philippines.day,
    philippines.hour,
    philippines.minute,
    philippines.second,
    philippines.millisecond,
    philippines.microsecond,
  );
}

DateTime? tryParseApiDateTime(dynamic value) {
  if (value is DateTime) {
    return value.isUtc ? _toPhilippineWallClock(value) : value;
  }
  if (value is String) {
    final parsed = DateTime.tryParse(value.trim());
    if (parsed != null) {
      return parsed.isUtc ? _toPhilippineWallClock(parsed) : parsed;
    }
  }
  if (value is int) {
    return _toPhilippineWallClock(
      DateTime.fromMillisecondsSinceEpoch(value, isUtc: true),
    );
  }
  return null;
}

DateTime parseApiDateTime(dynamic value, {DateTime? fallback}) {
  return tryParseApiDateTime(value) ?? fallback ?? DateTime.now();
}

// Estimated processing dates represent calendar days, even when MongoDB
// serializes them as UTC midnight. Keep that day independent of device zone.
DateTime? tryParseApiCalendarDate(dynamic value) {
  final raw = value?.toString().trim() ?? '';
  if (raw.length < 10) return null;
  final day = raw.substring(0, 10);
  if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(day)) return null;
  return DateTime.tryParse(day);
}

String? formatEstimatedProcessingRange(DateTime? start, DateTime? end) {
  final date = end ?? start;
  if (date == null) return null;
  final formattedEnd = DateFormat('d MMM y').format(date);
  if (start == null || end == null ||
      !DateTime(start.year, start.month, start.day)
          .isBefore(DateTime(end.year, end.month, end.day))) {
    return formattedEnd;
  }
  if (start.year == end.year && start.month == end.month) {
    return '${start.day}–$formattedEnd';
  }
  if (start.year == end.year) {
    return '${DateFormat('d MMM').format(start)}–$formattedEnd';
  }
  return '${DateFormat('d MMM y').format(start)}–$formattedEnd';
}

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

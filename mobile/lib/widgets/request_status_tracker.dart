import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/api_date_time.dart';
import '../models/request_status.dart';

/// Recorded events are displayed in order. Legacy records show only the
/// current status; missing stages are never fabricated as completed events.
class RequestStatusTracker extends StatelessWidget {
  const RequestStatusTracker({super.key, required this.status,
    required this.createdAt, this.history = const [], this.remarks = '',
    this.processingStartedAt, this.estimatedProcessingStart,
    this.estimatedCompletionDate});
  final String status;
  final DateTime createdAt;
  final List<Map<String, dynamic>> history;
  final String remarks;
  final DateTime? processingStartedAt;
  final DateTime? estimatedProcessingStart;
  final DateTime? estimatedCompletionDate;

  @override
  Widget build(BuildContext context) {
    final current = displayRequestStatus(status);
    final estimateLabel = formatEstimatedProcessingRange(
      estimatedProcessingStart, estimatedCompletionDate,
    );
    final events = <Map<String, dynamic>>[
      {'status': 'Request submitted', 'at': createdAt.toIso8601String()},
      ...history.where((e) => (e['status']?.toString() ?? '').isNotEmpty),
    ];
    if (events.length == 1 || displayRequestStatus(events.last['status'].toString()) != current) {
      events.add({'status': status, 'remarks': remarks});
    } else if (remarks.isNotEmpty) {
      events[events.length - 1] = {...events.last, 'remarks': remarks};
    }
    final currentIndex = events.length - 1;
    const stages = ['PENDING FOR PAYMENT', 'PENDING', 'PROCESSING', 'READY TO CLAIM', 'CLAIMED'];
    final stage = stages.indexOf(current);
    if (stage >= 0) {
      for (final upcoming in stages.skip(stage + 1)) {
        events.add({'status': upcoming, 'upcoming': true});
      }
    }
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Tracking Status', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 18),
        ...events.asMap().entries.map((entry) {
          final event = entry.value;
          final upcoming = event['upcoming'] == true;
          final active = entry.key == currentIndex;
          final label = event['status'] == 'Request submitted' ? 'Request submitted'
              : displayRequestStatus(event['status'].toString());
          final exception = const {'NEEDS UPDATE','REJECTED','CANCELLED','REFUNDED','REFUND APPROVED'}.contains(label);
          final color = upcoming ? Colors.grey.shade400 : exception ? Colors.red.shade700 : const Color(0xFFEF7B20);
          final at = DateTime.tryParse(event['at']?.toString() ?? '')?.toLocal();
          final note = event['remarks']?.toString() ?? '';
          final activeProcessing = active && current == 'PROCESSING' &&
              label == 'PROCESSING';
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Column(children: [
                Container(width: 48, height: 48,
                  decoration: BoxDecoration(color: color.withValues(alpha: .1), borderRadius: BorderRadius.circular(16)),
                  child: Icon(exception ? Icons.info_outline : upcoming ? Icons.inventory_2_outlined : active ? Icons.location_on_outlined : Icons.check, color: color)),
                if (entry.key != events.length - 1)
                  Container(width: 2, height: 28, margin: const EdgeInsets.symmetric(vertical: 5), color: color),
              ]),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: TextStyle(fontSize: 14, fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                    color: upcoming ? Colors.grey : Colors.black87)),
                if (at != null) Padding(padding: const EdgeInsets.only(top: 4),
                  child: Text(DateFormat('dd MMM yyyy • h:mm a').format(at), style: const TextStyle(fontSize: 12, color: Colors.grey))),
                if (note.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 5),
                  child: Text(note, style: TextStyle(fontSize: 13, color: active ? color : Colors.black54))),
                if (activeProcessing && processingStartedAt != null && at == null)
                  Padding(padding: const EdgeInsets.only(top: 4),
                    child: Text('Started ${DateFormat('MMM d, y').format(processingStartedAt!)}',
                      style: const TextStyle(fontSize: 12, color: Colors.black54))),
                if (activeProcessing)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: .08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(children: [
                        const Expanded(child: Text('Est. processing',
                          style: TextStyle(fontSize: 12, color: Colors.black54))),
                        const SizedBox(width: 8),
                        Expanded(child: Text(estimateLabel ?? 'Awaiting estimate',
                          textAlign: TextAlign.end,
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                            color: color))),
                      ]),
                    ),
                  ),
                if (upcoming) const Text('Upcoming', style: TextStyle(color: Colors.grey, fontSize: 12)),
                if (active && !exception) Text('Current status', style: TextStyle(color: color, fontSize: 12)),
              ])),
            ]),
          );
        }),
      ]),
    );
  }
}

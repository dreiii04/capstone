String displayRequestStatus(
  String status, {
  bool hasSubmittedPayment = false,
}) {
  final normalized =
      status.trim().toLowerCase().replaceAll(RegExp(r'[\s-]+'), '_');

  if (normalized.isEmpty ||
      normalized == 'pending_payment' ||
      normalized == 'pending_for_payment') {
    return hasSubmittedPayment ? 'PENDING' : 'PENDING FOR PAYMENT';
  }
  if (normalized == 'pending' ||
      normalized == 'pending_completion' ||
      normalized == 'pending_to_complete' ||
      normalized == 'pending_verification') {
    return 'PENDING';
  }
  if (normalized == 'in_process' || normalized == 'processing') {
    return 'PROCESSING';
  }
  if (normalized == 'released' || normalized == 'ready_to_claim') {
    return 'READY TO CLAIM';
  }
  if (normalized == 'claimed') return 'CLAIMED';
  if (normalized == 'refund_approved') return 'REFUND APPROVED';
  if (normalized == 'complete') return 'COMPLETED';
  if (normalized == 'declined' || normalized == 'denied') return 'REJECTED';
  if (normalized == 'canceled') return 'CANCELLED';
  return normalized.replaceAll('_', ' ').toUpperCase();
}

bool requestNeedsPayment(
  String status, {
  bool hasSubmittedPayment = false,
}) {
  if (hasSubmittedPayment) return false;
  final normalized =
      status.trim().toLowerCase().replaceAll(RegExp(r'[\s-]+'), '_');
  return const {
    'pending_payment',
    'pending_for_payment',
  }.contains(normalized);
}

bool transactionIndicatesSubmittedPayment(String status) {
  final normalized =
      status.trim().toLowerCase().replaceAll(RegExp(r'[\s-]+'), '_');
  return !const {
    'rejected',
    'declined',
    'denied',
    'cancelled',
    'canceled',
    'failed',
  }.contains(normalized);
}

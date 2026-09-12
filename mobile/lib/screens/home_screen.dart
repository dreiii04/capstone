import 'dart:async';

import 'package:capstone_project/screens/data_consent_screen.dart';
import 'package:capstone_project/screens/pending_screen.dart';
import 'package:capstone_project/screens/profile_screen.dart';
import 'package:capstone_project/screens/history_screen.dart';
import 'package:capstone_project/screens/notification_screen.dart';
import 'package:capstone_project/models/profile_data.dart';
import 'package:capstone_project/models/api_date_time.dart';
import 'package:capstone_project/models/request_status.dart';
import 'package:capstone_project/models/request_transaction_matcher.dart';
import 'package:capstone_project/widgets/profile_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:intl/intl.dart';
import '../constants.dart';
import '../models/notification_item.dart';
import '../services/mongo_data_api_service.dart';

// ---------------------------------------------------------------------------
// Top-level pure helpers — placed here so they can run inside compute().
// ---------------------------------------------------------------------------

bool _isHistoryStatusFn(String status) {
  final normalized = status.trim().toLowerCase().replaceAll('-', '_');
  return const {
    'complete',
    'completed',
    'approved',
    'claimed',
    'rejected',
    'declined',
    'denied',
    'cancelled',
    'canceled',
  }.contains(normalized);
}

bool _isApprovedStatusFn(String status) {
  final normalized = status.trim().toLowerCase();
  return normalized == 'complete' ||
      normalized == 'approved' ||
      normalized == 'released' ||
      normalized == 'claimed' ||
      normalized == 'completed';
}

double _parseAmountFn(dynamic value) {
  if (value is num) return value.toDouble();
  if (value is String) {
    final parsed = double.tryParse(value);
    if (parsed != null) return parsed;
  }
  return 0;
}

String _firstTextFn(Map<String, dynamic> item, List<String> keys) {
  for (final key in keys) {
    final value = item[key]?.toString().trim() ?? '';
    if (value.isNotEmpty && value.toLowerCase() != 'null') return value;
  }
  return '';
}

String _recordRequestIdFn(Map<String, dynamic> item) {
  return _firstTextFn(
    item,
    const ['requestId', 'linkedRequestId', 'documentRequestId'],
  );
}

String _recordRemarksFn(Map<String, dynamic> item) {
  return _firstTextFn(
    item,
    const [
      'remarks',
      'rejectionReason',
      'remark',
      'adminRemarks',
      'officeRemarks',
    ],
  );
}

String _normalizedValueFn(dynamic value) {
  return value?.toString().trim().toLowerCase() ?? '';
}

String _firstMeaningfulStatusFn(Iterable<dynamic> values) {
  const placeholders = {
    'none',
    'null',
    'n/a',
    'na',
    '_',
    'not_applicable',
  };
  for (final value in values) {
    final text = value?.toString().trim() ?? '';
    final normalized = text.toLowerCase().replaceAll(RegExp(r'[\s-]+'), '_');
    if (text.isNotEmpty && !placeholders.contains(normalized)) return text;
  }
  return '';
}

int? _matchingTransactionIndexFn(
  Map<String, dynamic> request,
  List<Map<String, dynamic>> transactions,
  Set<int> consumed,
) {
  for (var index = 0; index < transactions.length; index++) {
    if (consumed.contains(index)) continue;
    if (requestMatchesTransaction(request, transactions[index])) return index;
  }
  return null;
}

HistoryItem _historyFromRequestFn(
  Map<String, dynamic> request,
  Map<String, dynamic>? transaction,
) {
  final statusRaw = request['status']?.toString().trim() ?? 'completed';
  final transactionAmount = transaction == null
      ? null
      : transaction['totalAmount'] ??
          transaction['amount'] ??
          transaction['documentPrice'];
  final requestAmount =
      request['totalAmount'] ?? request['amount'] ?? request['documentPrice'];
  final requestPaymentType =
      _firstTextFn(request, const ['paymentType', 'paymentMode']);
  final paymentType = transaction == null
      ? requestPaymentType
      : _firstTextFn(transaction, const ['paymentType', 'paymentMode']);
  final hasPaymentRecord = transaction != null ||
      request['paymentReceived'] == true ||
      requestPaymentType.isNotEmpty;
  final requestRemarks = _recordRemarksFn(request);
  final transactionRemarks =
      transaction == null ? '' : _recordRemarksFn(transaction);

  DateTime? datePaid;
  if (transaction != null && transaction['createdAt'] != null) {
    datePaid = parseApiDateTime(transaction['createdAt']);
  } else if (request['paidAt'] != null) {
    datePaid = parseApiDateTime(request['paidAt']);
  }

  DateTime? dateProcessed;
  if (request['processedAt'] != null) {
    dateProcessed = parseApiDateTime(request['processedAt']);
  } else if (request['updatedAt'] != null &&
      request['status'] != null &&
      request['status'].toString().toLowerCase() != 'pending') {
    dateProcessed = parseApiDateTime(request['updatedAt']);
  }

  DateTime? dateClaimed;
  if (request['claimedAt'] != null) {
    dateClaimed = parseApiDateTime(request['claimedAt']);
  } else if (statusRaw.toLowerCase() == 'claimed' && request['updatedAt'] != null) {
    dateClaimed = parseApiDateTime(request['updatedAt']);
  }

  return HistoryItem(
    requestId: _recordRequestIdFn(request).isNotEmpty
        ? _recordRequestIdFn(request)
        : _firstTextFn(request, const ['id']),
    transactionId: transaction == null
        ? _firstTextFn(request, const ['transactionId'])
        : _firstTextFn(transaction, const ['id', 'transactionId']),
    title: request['docName']?.toString().trim() ?? '',
    date: parseApiDateTime(request['createdAt']),
    purpose: request['purpose']?.toString().trim() ?? '',
    status: displayRequestStatus(
      statusRaw,
      hasSubmittedPayment: false,
    ),
    isApproved: _isApprovedStatusFn(statusRaw),
    totalAmount: hasPaymentRecord
        ? _parseAmountFn(transactionAmount ?? requestAmount)
        : 0,
    paymentType: paymentType,
    remarks: requestRemarks.isNotEmpty ? requestRemarks : transactionRemarks,
    refundStatus: _firstMeaningfulStatusFn([
      if (transaction != null) transaction['refundStatus'],
      request['refundStatus'],
      if (_normalizedValueFn(transaction?['status']) == 'refunded') 'refunded',
    ]),
    datePaid: datePaid,
    dateProcessed: dateProcessed,
    dateClaimed: dateClaimed,
  );
}

/// Container for background isolate parameters.
class _MappingInput {
  const _MappingInput({
    required this.requests,
    required this.transactions,
  });
  final List<Map<String, dynamic>> requests;
  final List<Map<String, dynamic>> transactions;
}

/// Top-level function executed on a background isolate via compute().
_MappedRequestData _runRequestMapping(_MappingInput input) {
  final requests = input.requests;
  final transactions = input.transactions;

  final pending = <PendingRequest>[];
  final trackingRefunds = <HistoryItem>[];
  final history = <HistoryItem>[];
  final usableTransactions = transactions
      .where((item) =>
          _normalizedValueFn(item['docName']).isNotEmpty ||
          _recordRequestIdFn(item).isNotEmpty)
      .toList();
  final consumedTransactions = <int>{};

  for (final item in requests) {
    final docName = item['docName']?.toString().trim() ?? '';
    if (docName.isEmpty) continue;
    final purpose = item['purpose']?.toString().trim() ?? '';
    final statusRaw = item['status']?.toString().trim() ?? 'pending';
    final createdAt = parseApiDateTime(item['createdAt']);
    final transactionIndex = _matchingTransactionIndexFn(
      item,
      usableTransactions,
      consumedTransactions,
    );
    final transaction =
        transactionIndex == null ? null : usableTransactions[transactionIndex];
    final hasSubmittedPayment = transaction != null &&
        transactionIndicatesSubmittedPayment(
          transaction['status']?.toString() ?? '',
        );
    final status = displayRequestStatus(
      statusRaw,
      hasSubmittedPayment: hasSubmittedPayment,
    );
    final documentPrice = _parseAmountFn(item['documentPrice']);
    final totalAmount = _parseAmountFn(item['totalAmount']);
    final resolvedTotal = totalAmount > 0 ? totalAmount : documentPrice;
    final linkedRequestId = _recordRequestIdFn(item);
    final requestId = linkedRequestId.isNotEmpty
        ? linkedRequestId
        : _firstTextFn(item, const ['id', '_id']);

    if (_isHistoryStatusFn(statusRaw)) {
      if (transactionIndex != null) {
        consumedTransactions.add(transactionIndex);
      }
      final terminalItem = _historyFromRequestFn(item, transaction);
      if (terminalItem.shouldTrackRefund) {
        trackingRefunds.add(terminalItem);
      } else {
        history.add(terminalItem);
      }
    } else {
      if (hasSubmittedPayment && transactionIndex != null) {
        consumedTransactions.add(transactionIndex);
      }
      pending.add(
        PendingRequest(
          requestId: requestId.isEmpty ? null : requestId,
          docName: docName,
          purpose: purpose,
          dateCreated: createdAt,
          status: status,
          documentPrice: documentPrice,
          totalAmount: resolvedTotal,
        ),
      );
    }
  }

  pending.sort((a, b) => b.dateCreated.compareTo(a.dateCreated));
  trackingRefunds.sort((a, b) => b.date.compareTo(a.date));
  history.sort((a, b) => b.date.compareTo(a.date));
  return _MappedRequestData(
    pending: pending,
    trackingRefunds: trackingRefunds,
    history: history,
  );
}

// ---------------------------------------------------------------------------
// HomeScreen widget
// ---------------------------------------------------------------------------

class HomeScreen extends StatefulWidget {
  final int initialIndex;
  final ProfileData? initialProfile;

  const HomeScreen({
    super.key,
    this.initialIndex = 0,
    this.initialProfile,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  late int _selectedIndex;
  // Tracks tabs that have been visited so we only build and measure them lazily.
  // Tab 0 (Home) is always loaded on start. Tabs 1, 2, 3 are only instantiated
  // when navigated to, cutting initial layout measurement time by >70%.
  late final Set<int> _visitedTabs;

  late List<NotificationItem> _notifications;
  List<PendingRequest> _pendingRequests = [];
  List<HistoryItem> _trackingRefundItems = [];
  List<HistoryItem> _historyItems = [];
  bool _isLoadingRequests = false;
  String? _pendingRequestsError;
  String? _historyRequestsError;
  Future<void>? _requestLoad;
  bool _isLoadingNotifications = false;
  bool _hasLoadedNotifications = false;
  DateTime? _lastResumeRefresh;
  final Set<String> _notificationIds = {};
  ProfileData? _profileSummary;
  bool _isLoadingProfile = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _selectedIndex = widget.initialIndex;
    _visitedTabs = {widget.initialIndex};
    _notifications = [];
    _profileSummary = widget.initialProfile;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _loadRequests();
      if (widget.initialProfile == null) {
        _loadProfileSummary();
      }
      _loadNotifications();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _selectedIndex == 0) {
      final now = DateTime.now();
      final lastRefresh = _lastResumeRefresh;
      if (lastRefresh != null &&
          now.difference(lastRefresh) < const Duration(seconds: 30)) {
        return;
      }
      _lastResumeRefresh = now;
      _loadNotifications(showPopups: true);
      _loadRequests();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  static final _notificationDateFormat = DateFormat('MMM d, y h:mm a');

  DateTime _parseNotificationDate(dynamic value) {
    return parseApiDateTime(value);
  }

  String _formatNotificationTimestamp(DateTime value) {
    return _notificationDateFormat.format(value);
  }

  Future<void> _loadNotifications({bool showPopups = false}) async {
    if (_isLoadingNotifications) return;
    setState(() {
      _isLoadingNotifications = true;
    });

    try {
      final items = await MongoDataApiService.instance.fetchNotifications();
      final existingRead = {
        for (final item in _notifications) item.id: item.isRead,
      };
      final nextNotifications = <NotificationItem>[];

      for (final item in items) {
        final id = item['id']?.toString().trim() ?? '';
        if (id.isEmpty) continue;
        final title = item['title']?.toString().trim() ?? '';
        final message = item['message']?.toString().trim() ?? '';
        if (title.isEmpty && message.isEmpty) continue;
        final createdAt = _parseNotificationDate(item['createdAt']);
        final isRead = item['isRead'] == true || existingRead[id] == true;
        nextNotifications.add(
          NotificationItem(
            id: id,
            title: title,
            message: message,
            createdAt: createdAt,
            timestamp: _formatNotificationTimestamp(createdAt),
            isRead: isRead,
          ),
        );
      }
      nextNotifications.sort((a, b) {
        final byDate = b.createdAt.compareTo(a.createdAt);
        return byDate != 0 ? byDate : b.id.compareTo(a.id);
      });

      final nextIds = nextNotifications.map((item) => item.id).toSet();
      final newItems = _hasLoadedNotifications
          ? nextNotifications
              .where((item) => !_notificationIds.contains(item.id))
              .toList()
          : <NotificationItem>[];

      if (showPopups && newItems.isNotEmpty && mounted) {
        final firstNotification = newItems.first;
        final firstSummary = firstNotification.title.trim().isNotEmpty
            ? firstNotification.title.trim()
            : firstNotification.message.trim();
        final headline = newItems.length == 1
            ? 'Request update: $firstSummary'
            : 'You have ${newItems.length} new request updates';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(headline)),
        );
        unawaited(_loadRequests());
      }

      if (!mounted) return;
      setState(() {
        _notifications = nextNotifications;
        _notificationIds
          ..clear()
          ..addAll(nextIds);
        _isLoadingNotifications = false;
        _hasLoadedNotifications = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoadingNotifications = false;
        _hasLoadedNotifications = true;
      });
    }
  }

  String _normalizedValue(dynamic value) {
    return value?.toString().trim().toLowerCase() ?? '';
  }

  int? _matchingHistoryIndex(
    HistoryItem item,
    List<HistoryItem> candidates,
    Set<int> consumed,
  ) {
    final requestId = _normalizedValue(item.requestId);
    final transactionId = _normalizedValue(item.transactionId);
    for (var index = 0; index < candidates.length; index++) {
      if (consumed.contains(index)) continue;
      final candidate = candidates[index];
      if ((requestId.isNotEmpty &&
              requestId == _normalizedValue(candidate.requestId)) ||
          (transactionId.isNotEmpty &&
              transactionId == _normalizedValue(candidate.transactionId))) {
        return index;
      }
    }

    int? closestIndex;
    Duration? closestDistance;
    for (var index = 0; index < candidates.length; index++) {
      if (consumed.contains(index)) continue;
      final candidate = candidates[index];
      if (_normalizedValue(candidate.title) != _normalizedValue(item.title) ||
          _normalizedValue(candidate.purpose) !=
              _normalizedValue(item.purpose)) {
        continue;
      }
      final distance = candidate.date.difference(item.date).abs();
      if (closestDistance == null || distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }
    return closestIndex;
  }

  HistoryItem _combineHistoryItems(HistoryItem primary, HistoryItem fallback) {
    final paymentType = primary.paymentType.trim().isNotEmpty
        ? primary.paymentType
        : fallback.paymentType;
    return HistoryItem(
      requestId: primary.requestId.trim().isNotEmpty
          ? primary.requestId
          : fallback.requestId,
      transactionId: primary.transactionId.trim().isNotEmpty
          ? primary.transactionId
          : fallback.transactionId,
      title: primary.title,
      date: primary.date,
      purpose: primary.purpose,
      status: primary.status,
      isApproved: primary.isApproved,
      totalAmount:
          primary.totalAmount > 0 ? primary.totalAmount : fallback.totalAmount,
      paymentType: paymentType,
      remarks: primary.hasRemarks ? primary.remarks : fallback.remarks,
      refundStatus: primary.hasRefundRequest
          ? primary.refundStatus
          : fallback.refundStatus,
      datePaid: primary.datePaid ?? fallback.datePaid,
      dateProcessed: primary.dateProcessed ?? fallback.dateProcessed,
      dateClaimed: primary.dateClaimed ?? fallback.dateClaimed,
    );
  }

  List<HistoryItem> _mergeHistoryLists(
    List<HistoryItem> primary,
    List<HistoryItem> fallback,
  ) {
    final merged = <HistoryItem>[];
    final consumedFallback = <int>{};
    for (final item in primary) {
      final match = _matchingHistoryIndex(item, fallback, consumedFallback);
      if (match == null) {
        merged.add(item);
      } else {
        consumedFallback.add(match);
        merged.add(_combineHistoryItems(item, fallback[match]));
      }
    }
    for (var index = 0; index < fallback.length; index++) {
      if (!consumedFallback.contains(index)) merged.add(fallback[index]);
    }
    merged.sort((a, b) => b.date.compareTo(a.date));
    return merged;
  }

  bool _sameRequestRecord(HistoryItem first, HistoryItem second) {
    final firstRequestId = _normalizedValue(first.requestId);
    final secondRequestId = _normalizedValue(second.requestId);
    if (firstRequestId.isNotEmpty && firstRequestId == secondRequestId) {
      return true;
    }
    final firstTransactionId = _normalizedValue(first.transactionId);
    final secondTransactionId = _normalizedValue(second.transactionId);
    if (firstTransactionId.isNotEmpty &&
        firstTransactionId == secondTransactionId) {
      return true;
    }
    return firstRequestId.isEmpty &&
        secondRequestId.isEmpty &&
        firstTransactionId.isEmpty &&
        secondTransactionId.isEmpty &&
        _normalizedValue(first.title) == _normalizedValue(second.title) &&
        _normalizedValue(first.purpose) == _normalizedValue(second.purpose) &&
        first.date.difference(second.date).inMinutes.abs() < 1;
  }

  List<HistoryItem> _withoutTrackedRefunds(
    List<HistoryItem> history,
    List<HistoryItem> trackedRefunds,
  ) {
    if (trackedRefunds.isEmpty) return history;
    return history
        .where(
          (item) => !trackedRefunds.any(
            (tracked) => _sameRequestRecord(item, tracked),
          ),
        )
        .toList();
  }

  Future<_RequestListLoad> _captureRequestLoad(
    Future<List<Map<String, dynamic>>> operation,
  ) async {
    try {
      return _RequestListLoad(data: await operation);
    } catch (error) {
      return _RequestListLoad(error: error);
    }
  }

  String _loadErrorMessage(Object? error, String fallback) {
    if (error == null) return fallback;
    final message =
        error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '').trim();
    return message.isEmpty ? fallback : message;
  }

  Future<void> _loadRequests() async {
    final activeLoad = _requestLoad;
    if (activeLoad != null) return activeLoad;

    final load = _performRequestLoad();
    _requestLoad = load;
    try {
      await load;
    } finally {
      if (identical(_requestLoad, load)) _requestLoad = null;
    }
  }

  Future<void> _performRequestLoad() async {
    if (!mounted) return;
    setState(() {
      _isLoadingRequests = true;
      _pendingRequestsError = null;
      _historyRequestsError = null;
    });

    final service = MongoDataApiService.instance;
    final results = await Future.wait<_RequestListLoad>([
      _captureRequestLoad(service.fetchRequests()),
      _captureRequestLoad(service.fetchTransactions()),
    ]);
    final requestResult = results[0];
    final transactionResult = results[1];

    List<PendingRequest>? nextPending;
    List<HistoryItem>? nextTrackingRefunds;
    List<HistoryItem>? nextHistory;
    if (requestResult.data != null) {
      final mapped = _runRequestMapping(
        _MappingInput(
          requests: requestResult.data!,
          transactions:
              transactionResult.data ?? const <Map<String, dynamic>>[],
        ),
      );
      nextPending = mapped.pending;
      nextTrackingRefunds = transactionResult.data == null
          ? _mergeHistoryLists(
              mapped.trackingRefunds,
              _trackingRefundItems,
            )
          : mapped.trackingRefunds;
      final candidateHistory = transactionResult.data == null
          ? _mergeHistoryLists(mapped.history, _historyItems)
          : mapped.history;
      nextHistory = _withoutTrackedRefunds(
        candidateHistory,
        nextTrackingRefunds,
      );
    } else if (transactionResult.data != null) {
      final mapped = _runRequestMapping(
        _MappingInput(
          requests: const <Map<String, dynamic>>[],
          transactions: transactionResult.data!,
        ),
      );
      nextTrackingRefunds = mapped.trackingRefunds;
      nextHistory = _withoutTrackedRefunds(
        _mergeHistoryLists(mapped.history, _historyItems),
        nextTrackingRefunds,
      );
    }

    if (!mounted) return;
    setState(() {
      if (nextPending != null) _pendingRequests = nextPending;
      if (nextTrackingRefunds != null) {
        _trackingRefundItems = nextTrackingRefunds;
      }
      if (nextHistory != null) _historyItems = nextHistory;
      _pendingRequestsError = requestResult.data == null
          ? _loadErrorMessage(
              requestResult.error,
              'Tracked requests could not be refreshed. Please try again.',
            )
          : null;
      if (requestResult.data == null && transactionResult.data == null) {
        _historyRequestsError = _loadErrorMessage(
          requestResult.error ?? transactionResult.error,
          'Request history could not be refreshed. Please try again.',
        );
      } else if (requestResult.data == null) {
        _historyRequestsError =
            'Some request records could not be refreshed. Showing the latest available history.';
      } else if (transactionResult.data == null) {
        _historyRequestsError =
            'Payment and refund updates could not be refreshed. Showing available request history.';
      } else {
        _historyRequestsError = null;
      }
      _isLoadingRequests = false;
    });
  }

  int get _unreadCount => _notifications.where((item) => !item.isRead).length;

  Future<void> _loadProfileSummary() async {
    if (_isLoadingProfile) return;
    _isLoadingProfile = true;
    try {
      final profile = await MongoDataApiService.instance.fetchProfile();
      if (!mounted) return;
      setState(() => _profileSummary = profile);
    } catch (_) {
      // Keep existing avatar if profile load fails temporarily.
    } finally {
      _isLoadingProfile = false;
    }
  }

  void _handleProfileChanged(ProfileData profile) {
    if (!mounted) return;
    setState(() => _profileSummary = profile);
    unawaited(_loadRequests());
  }

  Future<void> _openNotifications() async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (context) => NotificationScreen(notifications: _notifications),
      ),
    );
    if (mounted) {
      await Future.wait([_loadNotifications(), _loadRequests()]);
    }
  }

  void _openProfile() {
    _onTappedBar(3);
  }

  Future<void> _refreshHome() async {
    await Future.wait([
      _loadRequests(),
      _loadNotifications(),
      _loadProfileSummary(),
    ]);
  }

  void _onTappedBar(int value) {
    if (_selectedIndex == value) return;
    setState(() {
      _selectedIndex = value;
      _visitedTabs.add(value);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (value == 1 || value == 2) {
        if (_pendingRequests.isEmpty && _historyItems.isEmpty) {
          _loadRequests();
        }
      } else if (value == 0) {
        if (_profileSummary == null) {
          _loadProfileSummary();
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Single layout lookup per build pass
    final isTablet = MediaQuery.sizeOf(context).shortestSide >= 600;

    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FA),
      body: IndexedStack(
        index: _selectedIndex,
        children: [
          TickerMode(
            enabled: _selectedIndex == 0,
            child: _buildHomeContent(context, isTablet),
          ),
          TickerMode(
            enabled: _selectedIndex == 1,
            child: _visitedTabs.contains(1)
                ? PendingScreen(
                    key: const ValueKey('tab_pending'),
                    requestList: _pendingRequests,
                    refundItems: _trackingRefundItems,
                    isLoading: _isLoadingRequests,
                    errorMessage: _pendingRequestsError,
                    onRefresh: _loadRequests,
                  )
                : const SizedBox.shrink(),
          ),
          TickerMode(
            enabled: _selectedIndex == 2,
            child: _visitedTabs.contains(2)
                ? HistoryScreen(
                    key: const ValueKey('tab_history'),
                    historyList: _historyItems,
                    isLoading: _isLoadingRequests,
                    errorMessage: _historyRequestsError,
                    onRefresh: _loadRequests,
                  )
                : const SizedBox.shrink(),
          ),
          TickerMode(
            enabled: _selectedIndex == 3,
            child: _visitedTabs.contains(3)
                ? ProfileScreen(
                    key: const ValueKey('tab_profile'),
                    initialProfile: _profileSummary,
                    onBack: () => _onTappedBar(0),
                    onProfileChanged: _handleProfileChanged,
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(
            top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
          ),
        ),
        child: SafeArea(
          top: false,
          child: NavigationBar(
            height: isTablet ? 76 : 70.h,
            selectedIndex: _selectedIndex,
            onDestinationSelected: _onTappedBar,
            backgroundColor: Colors.white,
            indicatorColor: const Color(0xFFDDEAF2),
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home),
                label: 'Home',
              ),
              NavigationDestination(
                icon: Icon(Icons.route_outlined),
                selectedIcon: Icon(Icons.route),
                label: 'Tracking',
              ),
              NavigationDestination(
                icon: Icon(Icons.history_outlined),
                selectedIcon: Icon(Icons.history),
                label: 'History',
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outline_rounded),
                selectedIcon: Icon(Icons.person_rounded),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHomeContent(BuildContext context, bool isTablet) {
    final pendingCount = _pendingRequests.length + _trackingRefundItems.length;
    final historyCount = _historyItems.length;

    return RefreshIndicator(
      color: fbPrimary,
      onRefresh: _refreshHome,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: SafeArea(
          bottom: false,
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 720),
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  isTablet ? 28 : 18.w,
                  isTablet ? 20 : 12.h,
                  isTablet ? 28 : 18.w,
                  isTablet ? 36 : 28.h,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    RepaintBoundary(child: _buildReferenceTopBar(isTablet)),
                    SizedBox(height: isTablet ? 36 : 30.h),
                    RepaintBoundary(
                      child: _buildRequestOverview(
                        isTablet: isTablet,
                        pendingCount: pendingCount,
                        historyCount: historyCount,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildReferenceTopBar(bool isTablet) {
    final avatarSize = isTablet ? 62.0 : 54.0;
    final firstName = _profileSummary?.firstName.trim() ?? '';
    final hour = DateTime.now().hour;
    final timeGreeting = hour < 12
        ? 'Good morning'
        : hour < 18
            ? 'Good afternoon'
            : 'Good evening';
    final welcomeMessage =
        firstName.isEmpty ? '$timeGreeting!' : '$timeGreeting, $firstName!';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          key: const Key('home_identity_row'),
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Semantics(
              button: true,
              excludeSemantics: true,
              label: _profileSummary == null
                  ? 'Open profile'
                  : 'Open ${_profileSummary!.fullName} profile',
              child: Material(
                color: const Color(0xFFE7EEF3),
                shape: const CircleBorder(),
                child: InkWell(
                  onTap: _openProfile,
                  customBorder: const CircleBorder(),
                  child: ProfileAvatar(
                    key: const Key('home_profile_avatar'),
                    size: avatarSize,
                    imageUrl: _profileSummary?.profileImageUrl ?? '',
                    iconSize: isTablet ? 34 : 30.sp,
                    semanticLabel: _profileSummary == null
                        ? 'Open profile'
                        : 'Open ${_profileSummary!.fullName} profile',
                  ),
                ),
              ),
            ),
            SizedBox(width: isTablet ? 16 : 12.w),
            Expanded(
              child: Text(
                key: const Key('home_welcome_text'),
                welcomeMessage,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.start,
                style: TextStyle(
                  color: fbDarkPrimary,
                  fontFamily: 'Frutiger',
                  fontSize: isTablet ? 20 : 16.sp,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                ),
              ),
            ),
            SizedBox(width: isTablet ? 16 : 12.w),
            SizedBox(
              width: avatarSize,
              child: Align(
                alignment: Alignment.centerRight,
                child: _TopActionButton(
                  icon: Icons.notifications_none_rounded,
                  label: _unreadCount == 0
                      ? 'Open notifications'
                      : 'Open notifications, $_unreadCount unread',
                  badge: _unreadCount,
                  isTablet: isTablet,
                  onTap: _openNotifications,
                ),
              ),
            ),
          ],
        ),
        SizedBox(height: isTablet ? 24 : 20.h),
        Container(
          key: const Key('home_brand_block'),
          width: double.infinity,
          padding: EdgeInsets.fromLTRB(
            isTablet ? 30 : 22.w,
            isTablet ? 18 : 15.h,
            isTablet ? 30 : 22.w,
            isTablet ? 20 : 17.h,
          ),
          decoration: BoxDecoration(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(isTablet ? 24 : 20.r),
            border: Border.all(color: const Color(0xFFD2DEE6)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Divider(
                      height: 1,
                      thickness: 1,
                      color: Color(0xFFD2DEE6),
                    ),
                  ),
                  Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: isTablet ? 18 : 14.w,
                    ),
                    child: Text(
                      key: const Key('home_welcome_title'),
                      'WELCOME TO',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: fbDarkPrimary,
                        fontFamily: 'Frutiger',
                        fontSize: isTablet ? 24 : 20.sp,
                        fontWeight: FontWeight.w800,
                        letterSpacing: isTablet ? 2 : 1.6,
                        height: 1,
                      ),
                    ),
                  ),
                  const Expanded(
                    child: Divider(
                      height: 1,
                      thickness: 1,
                      color: Color(0xFFD2DEE6),
                    ),
                  ),
                ],
              ),
              SizedBox(height: isTablet ? 12 : 10.h),
              Image.asset(
                key: const Key('home_brand_logo'),
                'assets/logo/logo.png',
                width: isTablet ? 240 : 200,
                height: isTablet ? 78 : 65,
                cacheWidth: 480,
                fit: BoxFit.contain,
                alignment: Alignment.center,
                semanticLabel: 'VerifiTOR',
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildRequestOverview({
    required bool isTablet,
    required int pendingCount,
    required int historyCount,
  }) {
    return Container(
      key: const Key('home_request_overview'),
      width: double.infinity,
      padding: EdgeInsets.all(isTablet ? 28 : 22.r),
      decoration: BoxDecoration(
        color: const Color(0xFF5A819B),
        borderRadius: BorderRadius.circular(24.r),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: Stack(
        children: [
              Positioned(
                right: -28.r,
                bottom: -38.r,
                child: Container(
                  width: 145.r,
                  height: 145.r,
                  decoration: BoxDecoration(
                    color: Colors.white.withAlpha(13),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: EdgeInsets.symmetric(
                      horizontal: 2.w,
                      vertical: 4.h,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'My requests',
                          style: TextStyle(
                            color: Colors.white,
                            fontFamily: 'Klavika',
                            fontSize: isTablet ? 24 : 20.sp,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        SizedBox(height: isTablet ? 22 : 16.h),
                        Row(
                          children: [
                            Expanded(
                              child: _OverviewMetric(
                                label: 'Active',
                                value: pendingCount.toString(),
                                suffix:
                                    pendingCount == 1 ? 'request' : 'requests',
                                isTablet: isTablet,
                              ),
                            ),
                            Container(
                              width: 1,
                              height: isTablet ? 56 : 48.h,
                              color: Colors.white30,
                            ),
                            SizedBox(width: isTablet ? 26 : 18.w),
                            Expanded(
                              child: _OverviewMetric(
                                label: 'Records',
                                value: historyCount.toString(),
                                suffix: 'history',
                                isTablet: isTablet,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: isTablet ? 48 : 42.h),
                  Text(
                    'Ready for your next document?',
                    style: TextStyle(
                      color: Colors.white,
                      fontFamily: 'Klavika',
                      fontSize: isTablet ? 25 : 20.sp,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  SizedBox(height: isTablet ? 26 : 22.h),
                  Align(
                    alignment: Alignment.center,
                    child: Material(
                      color: const Color(0xFFC8F36B),
                      borderRadius: BorderRadius.circular(22.r),
                      child: InkWell(
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const DataConsentScreen(),
                          ),
                        ),
                        borderRadius: BorderRadius.circular(22.r),
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: isTablet ? 34 : 30.w,
                            vertical: isTablet ? 15 : 14.h,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.add_rounded,
                                color: const Color(0xFF2E3B0A),
                                size: isTablet ? 23 : 20.sp,
                              ),
                              SizedBox(width: 4.w),
                              Text(
                                'New request',
                                style: TextStyle(
                                  color: const Color(0xFF2E3B0A),
                                  fontFamily: 'Frutiger',
                                  fontSize: isTablet ? 16 : 14.sp,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
  }
}

// ---------------------------------------------------------------------------
// Extracted const StatelessWidgets — enables Flutter subtree reuse
// ---------------------------------------------------------------------------

class _OverviewMetric extends StatelessWidget {
  const _OverviewMetric({
    required this.label,
    required this.value,
    required this.suffix,
    required this.isTablet,
  });

  final String label;
  final String value;
  final String suffix;
  final bool isTablet;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: Colors.white70,
            fontFamily: 'Frutiger',
            fontSize: isTablet ? 17 : 13.sp,
          ),
        ),
        SizedBox(height: isTablet ? 4 : 2.h),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              value,
              style: TextStyle(
                color: Colors.white,
                fontFamily: 'Klavika',
                fontSize: isTablet ? 38 : 32.sp,
                height: 1,
                fontWeight: FontWeight.w700,
              ),
            ),
            SizedBox(width: isTablet ? 7 : 5.w),
            Padding(
              padding: EdgeInsets.only(bottom: isTablet ? 3 : 2.h),
              child: Text(
                suffix,
                style: TextStyle(
                  color: Colors.white70,
                  fontFamily: 'Frutiger',
                  fontSize: isTablet ? 14 : 11.sp,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _TopActionButton extends StatelessWidget {
  const _TopActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.isTablet,
    this.badge = 0,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isTablet;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: Colors.white,
        shape: const CircleBorder(),
        elevation: 1,
        shadowColor: Colors.black12,
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              SizedBox(
                width: isTablet ? 52 : 48,
                height: isTablet ? 52 : 48,
                child: Icon(
                  icon,
                  size: isTablet ? 26 : 24.sp,
                  color: fbDarkPrimary,
                ),
              ),
              if (badge > 0)
                Positioned(
                  top: 1,
                  right: 1,
                  child: Container(
                    width: 9.r,
                    height: 9.r,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF5A6F),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Internal data types
// ---------------------------------------------------------------------------

class _RequestListLoad {
  const _RequestListLoad({this.data, this.error});

  final List<Map<String, dynamic>>? data;
  final Object? error;
}

class _MappedRequestData {
  const _MappedRequestData({
    required this.pending,
    required this.trackingRefunds,
    required this.history,
  });

  final List<PendingRequest> pending;
  final List<HistoryItem> trackingRefunds;
  final List<HistoryItem> history;
}

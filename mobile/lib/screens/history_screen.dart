import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../screens/history_detail_screen.dart';

class HistoryItem {
  final String requestId;
  final String transactionId;
  final String title;
  final DateTime date;
  final String purpose;
  final String status;
  final bool isApproved;
  final double totalAmount;
  final String paymentType;
  final String remarks;
  String refundStatus;
  final DateTime? datePaid;
  final DateTime? dateProcessed;
  final DateTime? dateClaimed;

  HistoryItem({
    this.requestId = '',
    this.transactionId = '',
    required this.title,
    required this.date,
    required this.purpose,
    required this.status,
    required this.isApproved,
    required this.totalAmount,
    required this.paymentType,
    this.remarks = '',
    this.refundStatus = '',
    this.datePaid,
    this.dateProcessed,
    this.dateClaimed,
  });

  bool get isRejected {
    final normalized = status.trim().toLowerCase();
    return normalized == 'rejected' ||
        normalized == 'declined' ||
        normalized == 'denied';
  }

  bool _isPlaceholder(String value) {
    final normalized =
        value.trim().toLowerCase().replaceAll(RegExp(r'[\s-]+'), '_');
    return const {'none', 'null', 'n/a', 'na', '_', 'not_applicable'}
        .contains(normalized);
  }

  String get displayRemarks {
    final value = remarks.trim();
    return !hasRemarks
        ? "No remarks were supplied by the Registrar's Office."
        : value;
  }

  bool get hasRemarks {
    final value = remarks.trim();
    return value.isNotEmpty && !_isPlaceholder(value);
  }

  bool get canRequestRefund {
    return isRejected &&
        totalAmount > 0 &&
        paymentType.trim().isNotEmpty &&
        transactionId.trim().isNotEmpty &&
        !hasRefundRequest;
  }

  bool get hasRefundRequest {
    final value = refundStatus.trim();
    return value.isNotEmpty && !_isPlaceholder(value);
  }

  String get normalizedRefundStatus =>
      refundStatus.trim().toLowerCase().replaceAll(RegExp(r'[\s-]+'), '_');

  bool get isRefundFinal {
    final normalized = normalizedRefundStatus;
    if (normalized.isEmpty) return false;
    return normalized == 'refunded' ||
        normalized.contains('complete') ||
        normalized.contains('sent') ||
        normalized.contains('paid_out') ||
        normalized.contains('reject') ||
        normalized.contains('declin') ||
        normalized.contains('denied') ||
        normalized.contains('cancel') ||
        normalized.contains('failed');
  }

  bool get shouldTrackRefund {
    if (!isRejected) return false;
    if (canRequestRefund) return true;
    return hasRefundRequest && !isRefundFinal;
  }

  String get refundTrackingStatus {
    if (canRequestRefund) return 'REFUND AVAILABLE';
    final normalized = normalizedRefundStatus;
    if (normalized.contains('pending') || normalized.contains('review')) {
      return 'REFUND UNDER REVIEW';
    }
    if (normalized.contains('approv')) return 'REFUND APPROVED';
    if (normalized.contains('process')) return 'REFUND PROCESSING';
    final readable = normalized
        .split('_')
        .where((part) => part.isNotEmpty)
        .join(' ')
        .toUpperCase();
    return readable.isEmpty ? 'REFUND UPDATE' : 'REFUND $readable';
  }

  String get displayStatus => status.toUpperCase();

  Color get statusColor {
    final normalized = status.trim().toLowerCase();
    if (normalized.contains('complete') ||
        normalized.contains('approved') ||
        normalized.contains('released')) {
        normalized.contains('released') ||
        normalized.contains('claim')) {
      return const Color(0xFF2E7D32);
    }
    if (normalized.contains('reject') ||
        normalized.contains('declin') ||
        normalized.contains('cancel') ||
        normalized.contains('denied')) {
      return const Color(0xFFC62828);
    }
    if (normalized.contains('refund') || normalized.contains('payment')) {
      return const Color(0xFFE65100);
    }
    return const Color(0xFF1565C0);
  }
}

class HistoryScreen extends StatefulWidget {
  final List<HistoryItem> historyList;
  final bool isLoading;
  final String? errorMessage;
  final Future<void> Function()? onRefresh;

  const HistoryScreen({
    super.key,
    required this.historyList,
    this.isLoading = false,
    this.errorMessage,
    this.onRefresh,
  });

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  static const double _maxContentWidth = 760;
  static const Color _primaryBlue = Color(0xFF5D7E97);
  String _selectedFilter = 'All';
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  // Memoized lists to eliminate per-build allocations
  late List<String> _filters;
  late List<HistoryItem> _filteredList;

  @override
  void initState() {
    super.initState();
    _rebuildLists();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _rebuildLists() {
    _filters = <String>[
      'All',
      ...widget.historyList.map((item) => item.title).toSet(),
    ];
    _applyFilter();
  }

  void _applyFilter() {
    _filteredList = _selectedFilter == 'All'
        ? widget.historyList
        : widget.historyList
            .where((item) => item.title == _selectedFilter)
            .toList();
    final query = _searchQuery.trim().toLowerCase();
    _filteredList = widget.historyList.where((item) {
      final matchesFilter =
          _selectedFilter == 'All' || item.title == _selectedFilter;
      if (!matchesFilter) return false;
      if (query.isEmpty) return true;
      return item.title.toLowerCase().contains(query) ||
          item.requestId.toLowerCase().contains(query) ||
          item.purpose.toLowerCase().contains(query) ||
          item.status.toLowerCase().contains(query);
    }).toList();
  }

  bool get _hasError => widget.errorMessage?.trim().isNotEmpty == true;

  @override
  void didUpdateWidget(covariant HistoryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.historyList, widget.historyList)) {
      if (_selectedFilter != 'All' &&
          !widget.historyList.any((item) => item.title == _selectedFilter)) {
        _selectedFilter = 'All';
      }
      _rebuildLists();
    }
  }

  Future<void> _refresh() async {
    final callback = widget.onRefresh;
    if (callback != null) await callback();
  }

  Future<void> _openDetails(HistoryItem item) async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(builder: (context) => HistoryDetailScreen(item: item)),
    );
    if (mounted) await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final isTablet = MediaQuery.sizeOf(context).shortestSide >= 600;
    final horizontalPadding = isTablet ? 32.0 : 14.0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: _primaryBlue,
            child: SafeArea(
              bottom: false,
              child: SizedBox(height: isTablet ? 48 : 40),
            ),
          ),
          Expanded(
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: _maxContentWidth),
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(height: isTablet ? 26 : 18),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'History',
                              style: TextStyle(
                                color: const Color(0xFF1F252A),
                                fontSize: isTablet ? 36 : 30,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          _buildRefreshButton(isTablet),
                        ],
                      ),
                      SizedBox(height: isTablet ? 18 : 12),
                      TextField(
                        key: const Key('history_search_input'),
                        controller: _searchController,
                        decoration: InputDecoration(
                          hintText: 'Search document name or Request ID...',
                          prefixIcon: const Icon(Icons.search_rounded, size: 20),
                          suffixIcon: _searchQuery.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.clear_rounded, size: 18),
                                  onPressed: () {
                                    _searchController.clear();
                                    setState(() {
                                      _searchQuery = '';
                                      _applyFilter();
                                    });
                                  },
                                )
                              : null,
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: isTablet ? 20 : 15,
                            vertical: isTablet ? 14 : 10,
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFFE0E4E7),
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFF5A819B),
                              width: 1.5,
                            ),
                          ),
                        ),
                        onChanged: (value) {
                          setState(() {
                            _searchQuery = value;
                            _applyFilter();
                          });
                        },
                      ),
                      SizedBox(height: isTablet ? 12 : 8),
                      DropdownButtonFormField<String>(
                        key: const Key('history_filter'),
                        initialValue: _selectedFilter,
                        isExpanded: true,
                        icon: const Icon(Icons.keyboard_arrow_down_rounded),
                        decoration: InputDecoration(
                          labelText: 'Filter by document',
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: isTablet ? 20 : 15,
                            vertical: isTablet ? 17 : 13,
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFFE0E4E7),
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFF5A819B),
                              width: 1.5,
                            ),
                          ),
                        ),
                        items: _filters
                            .map(
                              (value) => DropdownMenuItem<String>(
                                value: value,
                                child: Text(
                                  value,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: isTablet ? 17 : 15,
                                  ),
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          if (value == null) return;
                          setState(() {
                            _selectedFilter = value;
                            _applyFilter();
                          });
                        },
                      ),
                      if (_hasError && widget.historyList.isNotEmpty) ...[
                        SizedBox(height: isTablet ? 14 : 10),
                        _buildErrorBanner(isTablet),
                      ],
                      if (widget.isLoading &&
                          widget.historyList.isNotEmpty) ...[
                        SizedBox(height: isTablet ? 14 : 10),
                        const LinearProgressIndicator(
                          key: Key('history_refresh_progress'),
                          color: _primaryBlue,
                          backgroundColor: Color(0xFFDDE7ED),
                        ),
                      ],
                      SizedBox(height: isTablet ? 20 : 14),
                      Expanded(
                        child: RefreshIndicator(
                          key: const Key('history_refresh_indicator'),
                          color: _primaryBlue,
                          onRefresh: _refresh,
                          child: _buildBody(_filteredList, isTablet),
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
    );
  }

  Widget _buildRefreshButton(bool isTablet) {
    return IconButton(
      key: const Key('history_refresh_button'),
      tooltip: 'Refresh request history',
      onPressed: widget.onRefresh == null || widget.isLoading ? null : _refresh,
      style: IconButton.styleFrom(
        minimumSize: Size.square(isTablet ? 50 : 44),
        backgroundColor: const Color(0xFFE3EDF3),
        foregroundColor: _primaryBlue,
      ),
      icon: widget.isLoading
          ? SizedBox.square(
              dimension: isTablet ? 22 : 19,
              child: const CircularProgressIndicator(strokeWidth: 2.3),
            )
          : const Icon(Icons.refresh_rounded),
    );
  }

  Widget _buildBody(List<HistoryItem> filteredList, bool isTablet) {
    if (widget.isLoading && widget.historyList.isEmpty) {
      return _buildScrollableState(
        key: const Key('history_loading_state'),
        icon: const SizedBox.square(
          dimension: 42,
          child: CircularProgressIndicator(color: _primaryBlue),
        ),
        title: 'Loading request history…',
        message: 'Please wait while we get your completed request records.',
        isTablet: isTablet,
      );
    }

    if (_hasError && widget.historyList.isEmpty) {
      return _buildScrollableState(
        key: const Key('history_error_state'),
        icon: Icon(
          Icons.cloud_off_rounded,
          size: isTablet ? 82 : 66,
          color: const Color(0xFF8A98A3),
        ),
        title: 'Request history could not be loaded',
        message: widget.errorMessage!.trim(),
        isTablet: isTablet,
        action: _buildRetryButton('Try again'),
      );
    }

    if (filteredList.isEmpty) {
      final filtered = widget.historyList.isNotEmpty;
      return _buildScrollableState(
        key: const Key('history_empty_state'),
        icon: Icon(
          filtered ? Icons.filter_alt_off_rounded : Icons.history_edu_rounded,
          size: isTablet ? 88 : 70,
          color: const Color(0xFFB5C1C8),
        ),
        title: filtered
            ? 'No history matches this filter'
            : 'No request history yet',
        message: filtered
            ? 'Choose All or another document type to see your records.'
            : 'Completed requests and finalized outcomes will appear here.',
        isTablet: isTablet,
        action: filtered
            ? OutlinedButton(
                key: const Key('history_clear_filter_button'),
                onPressed: () => setState(() {
                  _selectedFilter = 'All';
                  _applyFilter();
                }),
                child: const Text('Show all history'),
              )
            : _buildRetryButton('Refresh'),
      );
    }

    return ListView.separated(
      key: const Key('history_request_list'),
      physics: const AlwaysScrollableScrollPhysics(),
      cacheExtent: 350,
      padding: EdgeInsets.only(bottom: isTablet ? 32 : 22),
      itemCount: filteredList.length,
      separatorBuilder: (_, __) => SizedBox(height: isTablet ? 16 : 12),
      itemBuilder: (context, index) {
        final item = filteredList[index];
        return RepaintBoundary(
          child: _buildHistoryCard(
            item,
            isTablet: isTablet,
            onTap: () => _openDetails(item),
          ),
        );
      },
    );
  }

  Widget _buildScrollableState({
    required Key key,
    required Widget icon,
    required String title,
    required String message,
    required bool isTablet,
    Widget? action,
  }) {
    return CustomScrollView(
      key: key,
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Padding(
              padding: EdgeInsets.all(isTablet ? 36 : 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  icon,
                  SizedBox(height: isTablet ? 20 : 16),
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: const Color(0xFF2A343D),
                      fontSize: isTablet ? 23 : 19,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  SizedBox(height: isTablet ? 10 : 8),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: Text(
                      message,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: const Color(0xFF677784),
                        fontSize: isTablet ? 16 : 14,
                        height: 1.4,
                      ),
                    ),
                  ),
                  if (action != null) ...[
                    SizedBox(height: isTablet ? 22 : 18),
                    action,
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRetryButton(String label) {
    return ElevatedButton.icon(
      key: const Key('history_retry_button'),
      onPressed: widget.isLoading ? null : _refresh,
      style: ElevatedButton.styleFrom(
        backgroundColor: _primaryBlue,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      icon: const Icon(Icons.refresh_rounded, size: 18),
      label: Text(label),
    );
  }

  Widget _buildErrorBanner(bool isTablet) {
    return Container(
      key: const Key('history_error_banner'),
      width: double.infinity,
      padding: EdgeInsets.symmetric(
        horizontal: isTablet ? 18 : 14,
        vertical: isTablet ? 14 : 10,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF3F1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFFD5D0)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.info_outline_rounded,
            color: Color(0xFFC04B3E),
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              widget.errorMessage!.trim(),
              style: TextStyle(
                color: const Color(0xFF7A251B),
                fontSize: isTablet ? 15 : 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryCard(HistoryItem item, {
    required bool isTablet,
    required VoidCallback onTap,
  }) {
    final statusColor = item.statusColor;
    final displayDate = DateFormat('MMM d, y').format(item.date);
    final displayDate = item.dateClaimed != null
        ? 'Claimed: ${DateFormat('MMM d, y').format(item.dateClaimed!)}'
        : DateFormat('MMM d, y').format(item.date);

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      elevation: 0,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.all(isTablet ? 22 : 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5EAEE)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (item.requestId.isNotEmpty) ...[
                          Text(
                            'Request #${item.requestId}',
                            style: TextStyle(
                              color: const Color(0xFF5A819B),
                              fontSize: isTablet ? 14 : 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 3),
                        ],
                        Text(
                          item.title,
                          style: TextStyle(
                            color: const Color(0xFF1E2830),
                            fontSize: isTablet ? 19 : 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (item.purpose.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            item.purpose,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: const Color(0xFF677784),
                              fontSize: isTablet ? 15 : 13,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withAlpha(26),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      item.displayStatus,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: isTablet ? 13 : 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    displayDate,
                    style: TextStyle(
                      color: const Color(0xFF90A0AB),
                      fontSize: isTablet ? 14 : 12,
                    ),
                  ),
                  Row(
                    children: [
                      Text(
                        'View Details',
                        style: TextStyle(
                          color: _primaryBlue,
                          fontSize: isTablet ? 14 : 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(
                        Icons.arrow_forward_ios_rounded,
                        color: _primaryBlue,
                        size: 12,
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

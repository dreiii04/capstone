import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../constants.dart';
import '../models/notification_item.dart';
import '../services/mongo_data_api_service.dart';
import '../widgets/confirmation_dialog.dart';

typedef MarkNotificationRead = Future<void> Function(String notificationId);
typedef MarkAllNotificationsRead = Future<void> Function();
typedef DismissNotification = Future<void> Function(String notificationId);

class NotificationScreen extends StatefulWidget {
  const NotificationScreen({
    super.key,
    required this.notifications,
    this.onMarkRead,
    this.onMarkAllRead,
    this.onDismiss,
  });

  final List<NotificationItem> notifications;
  final MarkNotificationRead? onMarkRead;
  final MarkAllNotificationsRead? onMarkAllRead;
  final DismissNotification? onDismiss;

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  String _filterType = 'all'; // 'all' or 'unread'
  final Set<String> _updatingIds = {};
  bool _isMarkingAll = false;

  // Memoized sorted+filtered list. Rebuilt only inside setState() blocks so
  // build() never allocates a new list or runs a sort on every frame.
  late List<NotificationItem> _filteredNotifications;

  @override
  void initState() {
    super.initState();
    _filteredNotifications = _buildFilteredList();
  }

  @override
  void didUpdateWidget(covariant NotificationScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.notifications, widget.notifications)) {
      _filteredNotifications = _buildFilteredList();
    }
  }

  List<NotificationItem> _buildFilteredList() {
    final filtered = _filterType == 'unread'
        ? widget.notifications.where((item) => !item.isRead).toList()
        : List<NotificationItem>.from(widget.notifications);
    filtered.sort((a, b) {
      final byDate = b.createdAt.compareTo(a.createdAt);
      return byDate != 0 ? byDate : b.id.compareTo(a.id);
    });
    return filtered;
  }

  Future<void> _markAsRead(NotificationItem notification) async {
    if (notification.isRead || _updatingIds.contains(notification.id)) return;
    setState(() => _updatingIds.add(notification.id));
    try {
      await (widget.onMarkRead ??
          MongoDataApiService.instance.markNotificationRead)(notification.id);
      if (!mounted) return;
      setState(() {
        notification.isRead = true;
        _filteredNotifications = _buildFilteredList();
      });
    } catch (error) {
      if (!mounted) return;
      _showError(error, 'Could not mark this notification as read.');
    } finally {
      if (mounted) setState(() => _updatingIds.remove(notification.id));
    }
  }

  Future<void> _markAllAsRead() async {
    if (_isMarkingAll || !widget.notifications.any((item) => !item.isRead)) {
      return;
    }

    final confirmed = await showConfirmationDialog(
      context,
      title: 'Mark all as read?',
      message:
          'Are you sure you want to mark all unread notifications as read?',
      confirmLabel: 'Mark all as read',
      cancelLabel: 'Cancel',
      icon: Icons.done_all_rounded,
    );
    if (!confirmed || !mounted) return;

    setState(() => _isMarkingAll = true);
    try {
      await (widget.onMarkAllRead ??
          MongoDataApiService.instance.markAllNotificationsRead)();
      if (!mounted) return;
      setState(() {
        for (final notification in widget.notifications) {
          notification.isRead = true;
        }
        _filteredNotifications = _buildFilteredList();
      });
    } catch (error) {
      if (!mounted) return;
      _showError(error, 'Could not mark all notifications as read.');
    } finally {
      if (mounted) setState(() => _isMarkingAll = false);
    }
  }

  Future<void> _dismissNotification(NotificationItem notification) async {
    if (_updatingIds.contains(notification.id)) return;

    final itemTitle = notification.title.trim().isNotEmpty
        ? notification.title.trim()
        : 'this notification';
    final confirmed = await showConfirmationDialog(
      context,
      title: 'Dismiss Notification?',
      message: 'Are you sure you want to dismiss "$itemTitle"?',
      confirmLabel: 'Dismiss',
      cancelLabel: 'Cancel',
      isDestructive: true,
      icon: Icons.notifications_off_outlined,
    );
    if (!confirmed || !mounted) return;

    setState(() => _updatingIds.add(notification.id));
    try {
      await (widget.onDismiss ??
          MongoDataApiService.instance.dismissNotification)(notification.id);
      if (!mounted) return;
      setState(() {
        widget.notifications.remove(notification);
        _filteredNotifications = _buildFilteredList();
      });
    } catch (error) {
      if (!mounted) return;
      _showError(error, 'Could not dismiss this notification.');
    } finally {
      if (mounted) setState(() => _updatingIds.remove(notification.id));
    }
  }

  void _showError(Object error, String fallback) {
    final message = error.toString().replaceFirst('Exception: ', '').trim();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message.isEmpty ? fallback : message)),
    );
  }

  void _setFilter(String type) {
    if (_filterType == type) return;
    setState(() {
      _filterType = type;
      _filteredNotifications = _buildFilteredList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: fbPrimary,
        foregroundColor: Colors.white,
        title: const Text('Notifications'),
        elevation: 0,
      ),
      body: Column(
        children: [
          // Header with Mark All Read
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const SizedBox.shrink(),
                TextButton(
                  key: const Key('mark_all_notifications_read'),
                  onPressed: _isMarkingAll ||
                          !widget.notifications.any((item) => !item.isRead)
                      ? null
                      : _markAllAsRead,
                  child: _isMarkingAll
                      ? SizedBox.square(
                          dimension: 18.r,
                          child:
                              const CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(
                          'Mark All Read',
                          style: TextStyle(
                            color: fbPrimary,
                            fontSize: 14.sp,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ],
            ),
          ),
          // Filter Tabs
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 16.w),
            child: Row(
              children: [
                FilterTab(
                  label: 'All',
                  isActive: _filterType == 'all',
                  onTap: () => _setFilter('all'),
                ),
                SizedBox(width: 12.w),
                FilterTab(
                  label: 'Unread',
                  isActive: _filterType == 'unread',
                  onTap: () => _setFilter('unread'),
                ),
              ],
            ),
          ),
          SizedBox(height: 16.h),
          // Notification List — uses the pre-sorted memoized list
          Expanded(
            child: _filteredNotifications.isEmpty
                ? Center(
                    child: Text(
                      _filterType == 'unread'
                          ? 'No unread notifications.'
                          : 'No notifications yet.',
                      style:
                          TextStyle(fontSize: 16.sp, color: Colors.grey[600]),
                    ),
                  )
                : ListView.separated(
                    cacheExtent: 350,
                    padding:
                        EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
                    itemCount: _filteredNotifications.length,
                    separatorBuilder: (_, __) => SizedBox(height: 12.h),
                    itemBuilder: (context, index) {
                      final item = _filteredNotifications[index];
                      return RepaintBoundary(
                        child: NotificationItemCard(
                          key: Key('notification_${item.id}'),
                          item: item,
                          isUpdating: _updatingIds.contains(item.id),
                          onTap: () => _markAsRead(item),
                          onDismiss: () => _dismissNotification(item),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class FilterTab extends StatelessWidget {
  const FilterTab({
    super.key,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  final String label;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
        decoration: BoxDecoration(
          color: isActive ? fbPrimary : Colors.white,
          borderRadius: BorderRadius.circular(20.r),
          border: isActive
              ? null
              : Border.all(color: Colors.grey.shade300, width: 1),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isActive ? Colors.white : Colors.black87,
            fontSize: 13.sp,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class NotificationItemCard extends StatelessWidget {
  const NotificationItemCard({
    super.key,
    required this.item,
    required this.isUpdating,
    required this.onTap,
    required this.onDismiss,
  });

  final NotificationItem item;
  final bool isUpdating;
  final VoidCallback onTap;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: item.isRead ? Colors.white : const Color(0xFFF5F9FC),
      borderRadius: BorderRadius.circular(12.r),
      child: InkWell(
        borderRadius: BorderRadius.circular(12.r),
        onTap: item.isRead || isUpdating ? null : onTap,
        child: Container(
          padding: EdgeInsets.all(16.w),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12.r),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Unread indicator
                  Container(
                    width: 8.w,
                    height: 8.h,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: item.isRead ? Colors.transparent : fbPrimary,
                    ),
                  ),
                  SizedBox(width: 12.w),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14.sp,
                            color: Colors.black87,
                          ),
                        ),
                        SizedBox(height: 6.h),
                        Text(
                          item.message,
                          style: TextStyle(
                            fontSize: 13.sp,
                            color: Colors.grey[600],
                          ),
                        ),
                        SizedBox(height: 8.h),
                        Text(
                          item.timestamp,
                          style: TextStyle(
                            fontSize: 12.sp,
                            color: Colors.grey[500],
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(width: 8.w),
                  if (isUpdating)
                    SizedBox.square(
                      dimension: 18.r,
                      child: const CircularProgressIndicator(strokeWidth: 2),
                    )
                  else
                    IconButton(
                      key: Key('dismiss_notification_${item.id}'),
                      tooltip: 'Dismiss notification',
                      onPressed: onDismiss,
                      visualDensity: VisualDensity.compact,
                      icon: Icon(
                        Icons.close_rounded,
                        size: 19.sp,
                        color: Colors.grey[500],
                      ),
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

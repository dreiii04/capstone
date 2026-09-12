import 'package:cached_network_image/cached_network_image.dart';
import 'package:capstone_project/constants.dart';
import 'package:flutter/material.dart';

String resolveProfileImageUrl(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return '';

  final parsed = Uri.tryParse(trimmed);
  if (parsed != null && (parsed.scheme == 'http' || parsed.scheme == 'https')) {
    return trimmed;
  }

  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    final path = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return ApiConstants.originUri.resolve(path).toString();
  }

  return trimmed;
}

class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.size,
    this.imageUrl = '',
    this.imageProvider,
    this.backgroundColor = const Color(0xFFE7EEF3),
    this.iconColor = fbDarkPrimary,
    this.iconSize,
    this.semanticLabel = 'Profile photo',
  });

  final double size;
  final String imageUrl;
  final ImageProvider<Object>? imageProvider;
  final Color backgroundColor;
  final Color iconColor;
  final double? iconSize;
  final String semanticLabel;

  Widget _fallback() {
    return ColoredBox(
      color: backgroundColor,
      child: Center(
        child: Icon(
          Icons.person_outline_rounded,
          color: iconColor,
          size: iconSize ?? size * 0.52,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final resolvedUrl = resolveProfileImageUrl(imageUrl);
    // Prefer an explicitly provided ImageProvider (e.g. FileImage for local
    // picks), fall back to CachedNetworkImage for remote URLs so that the image
    // is persisted to disk and never re-downloaded on rebuild or navigation.
    final isRemote = resolvedUrl.startsWith('http://') ||
        resolvedUrl.startsWith('https://');

    return Semantics(
      image: imageProvider != null || isRemote,
      label: semanticLabel,
      child: SizedBox.square(
        dimension: size,
        child: ClipOval(
          child: imageProvider != null
              ? Image(
                  key: ValueKey(resolvedUrl),
                  image: imageProvider!,
                  width: size,
                  height: size,
                  fit: BoxFit.cover,
                  gaplessPlayback: true,
                  errorBuilder: (_, __, ___) => _fallback(),
                )
              : isRemote
                  ? CachedNetworkImage(
                      key: ValueKey(resolvedUrl),
                      imageUrl: resolvedUrl,
                      width: size,
                      height: size,
                      fit: BoxFit.cover,
                      // Cap in-memory and on-disk decoded bitmap resolution so large
                      // profile pictures never bloat app RAM or device storage.
                      memCacheWidth: 200,
                      memCacheHeight: 200,
                      maxWidthDiskCache: 300,
                      maxHeightDiskCache: 300,
                      // Use the previously cached image while a newer one loads
                      // so there is no flash of the fallback icon on rebuild.
                      fadeOutDuration: Duration.zero,
                      fadeInDuration: const Duration(milliseconds: 200),
                      placeholder: (_, __) => _fallback(),
                      errorWidget: (_, __, ___) => _fallback(),
                    )
                  : _fallback(),
        ),
      ),
    );
  }
}

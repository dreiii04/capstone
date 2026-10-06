import 'dart:async';

import 'package:capstone_project/screens/home_screen.dart';
import 'package:capstone_project/services/mongo_data_api_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

enum SplashMode {
  initial,
  login,
  logout,
  request,
}

class SplashScreen extends StatefulWidget {
  final SplashMode mode;
  final String? statusMessage;
  final int? targetIndex;
  final Duration? duration;

  const SplashScreen({
    super.key,
    this.mode = SplashMode.initial,
    this.statusMessage,
    this.targetIndex,
    this.duration,
  });

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _animationController;
  late final Animation<double> _fadeAnimation;
  late final Animation<double> _scaleAnimation;

  static const _darkNavy = Color(0xFF213448);
  static const _primaryBlue = Color(0xFF547792);

  @override
  void initState() {
    super.initState();

    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOut,
    );

    _scaleAnimation = Tween<double>(begin: 0.95, end: 1.0).animate(_fadeAnimation);

    _animationController.forward();
    _handleTransition();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _handleTransition() async {
    final timer = Future.delayed(widget.duration ?? const Duration(milliseconds: 250));
    switch (widget.mode) {
      case SplashMode.initial:
        try {
          await Future.wait([
            MongoDataApiService.instance.initialize().timeout(
                  const Duration(seconds: 3),
                ),
            timer,
          ]);
        } catch (_) {
          await timer;
        }
        if (!mounted) return;
        final hasSession = MongoDataApiService.instance.hasSession;
        final targetRoute = hasSession ? '/home' : '/login';
        Navigator.of(context).pushReplacementNamed(targetRoute);
        break;

      case SplashMode.login:
      case SplashMode.request:
        await timer;
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(
            builder: (_) => HomeScreen(
              initialIndex: widget.targetIndex ?? (widget.mode == SplashMode.login ? 0 : 1),
            ),
          ),
          (route) => false,
        );
        break;

      case SplashMode.logout:
        try {
          await Future.wait([
            MongoDataApiService.instance.logout(),
            timer,
          ]);
        } catch (_) {
          await timer;
        }
        if (!mounted) return;
        Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
        break;
    }
  }

  String get _subtitleText {
    if (widget.statusMessage != null && widget.statusMessage!.isNotEmpty) {
      return widget.statusMessage!;
    }
    switch (widget.mode) {
      case SplashMode.initial:
        return 'Document Request & Verification System';
      case SplashMode.login:
        return 'Signing you in...';
      case SplashMode.logout:
        return 'Logging you out...';
      case SplashMode.request:
        return 'Updating your requests...';
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: _darkNavy,
        body: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [_darkNavy, _primaryBlue],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: SafeArea(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(flex: 2),
                RepaintBoundary(
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: ScaleTransition(
                      scale: _scaleAnimation,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: EdgeInsets.all(20.r),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Colors.white.withAlpha(60),
                                width: 3,
                              ),
                            ),
                            child: Image.asset(
                              'assets/logo/logo.png',
                              width: 100.w,
                              height: 100.w,
                              cacheWidth: 300,
                              fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) => Icon(
                                Icons.school_rounded,
                                color: _darkNavy,
                                size: 64.r,
                              ),
                            ),
                          ),
                          SizedBox(height: 24.h),
                          Text(
                            'VerifiTOR',
                            style: TextStyle(
                              color: Colors.white,
                              fontFamily: 'Frutiger',
                              fontSize: 32.sp,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.5,
                            ),
                          ),
                          SizedBox(height: 8.h),
                          Padding(
                            padding: EdgeInsets.symmetric(horizontal: 24.w),
                            child: Text(
                              _subtitleText,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white.withAlpha(217),
                                fontSize: 13.sp,
                                fontWeight: FontWeight.w400,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const Spacer(flex: 2),
                RepaintBoundary(
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: SizedBox(
                      width: 24.r,
                      height: 24.r,
                      child: const CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white70),
                      ),
                    ),
                  ),
                ),
                SizedBox(height: 36.h),
              ],
            ),
          ),
        ),
      );
}

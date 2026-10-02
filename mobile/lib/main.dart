import 'package:capstone_project/screens/data_consent_screen.dart';
import 'package:capstone_project/screens/splash_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter/services.dart';

import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/home_screen.dart';
import 'screens/request_form_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/pending_screen.dart';
import 'screens/forgot_password_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Keep decoded texture cache within safe limits to prevent low memory killer SIGKILL.
  PaintingBinding.instance.imageCache.maximumSize = 100;
  PaintingBinding.instance.imageCache.maximumSizeBytes = 20 * 1024 * 1024;

  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);

  runApp(const Verifitor());
}

class NoOverscrollBehavior extends ScrollBehavior {
  const NoOverscrollBehavior();

  @override
  Widget buildOverscrollIndicator(
      BuildContext context, Widget child, ScrollableDetails details) {
    return child;
  }

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) {
    return const ClampingScrollPhysics();
  }
}

class Verifitor extends StatelessWidget {
  const Verifitor({super.key});

  @override
  Widget build(BuildContext context) {
    return ScreenUtilInit(
      designSize: const Size(412, 715),
      minTextAdapt: false,
      splitScreenMode: false,
      ensureScreenSize: false,
      builder: (_, child) => MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'Verifitor App',
        scrollBehavior: const NoOverscrollBehavior(),
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: InkRipple.splashFactory,
          pageTransitionsTheme: const PageTransitionsTheme(
            builders: {
              TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
              TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
            },
          ),
        ),
        initialRoute: '/splash',
        routes: {
          '/splash': (context) => const SplashScreen(),
          '/login': (context) => const LogInScreen(),
          '/register': (context) => const RegisterScreen(),
          '/home': (context) => const HomeScreen(),
          '/form': (context) => const RequestFormScreen(),
          '/consent': (context) => const DataConsentScreen(),
          '/profile': (context) => const ProfileScreen(),
          '/pending': (context) => const PendingScreen(
                requestList: [],
              ),
          '/tracking': (context) => const PendingScreen(
                requestList: [],
              ),
          '/forgot': (context) => const PasswordScreen(),
        },
      ),
    );
  }
}

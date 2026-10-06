# Flutter screen imports

## change_password_screen.dart

```dart
import '../widgets/form_ui.dart';
import '../models/password_rules.dart';
import 'package:capstone_project/services/mongo_data_api_service.dart';
import 'package:capstone_project/widgets/confirmation_dialog.dart';
import 'package:capstone_project/widgets/simple_message_dialog.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
```

## choose_actor_screen.dart

```dart
import 'package:capstone_project/screens/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../constants.dart';
import '../widgets/custom_inkwell_button.dart';
import '../widgets/custom_font.dart';
```

## data_consent_screen.dart

```dart
import 'package:capstone_project/models/profile_data.dart';
import 'package:capstone_project/screens/request_form_screen.dart';
import 'package:capstone_project/widgets/request_progress_indicator.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
```

## edit_profile_screen.dart

```dart
import '../widgets/form_ui.dart';
import 'dart:io';
import 'package:capstone_project/models/profile_data.dart';
import 'package:capstone_project/models/student_academic_options.dart';
import 'package:capstone_project/services/mongo_data_api_service.dart';
import 'package:capstone_project/widgets/confirmation_dialog.dart';
import 'package:capstone_project/widgets/profile_avatar.dart';
import 'package:capstone_project/widgets/simple_message_dialog.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
```

## forgot_password_screen.dart

```dart
import '../widgets/form_ui.dart';
import '../models/password_rules.dart';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/mongo_data_api_service.dart';
import '../widgets/simple_message_dialog.dart';
```

## history_detail_screen.dart

```dart
import '../widgets/form_ui.dart';
import '../widgets/request_status_tracker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/mongo_data_api_service.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/simple_message_dialog.dart';
import 'history_screen.dart';
import 'payment_refund_screen.dart';
```

## history_screen.dart

```dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/mongo_data_api_service.dart';
import '../screens/history_detail_screen.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/simple_message_dialog.dart';
```

## home_screen.dart

```dart
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
```

## login_screen.dart

```dart
import '../widgets/form_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../screens/home_screen.dart';
import '../services/mongo_data_api_service.dart';
import '../widgets/simple_message_dialog.dart';
```

## notification_screen.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../constants.dart';
import '../models/notification_item.dart';
import '../services/mongo_data_api_service.dart';
import '../widgets/confirmation_dialog.dart';
```

## payment_details_screen.dart

```dart
import '../widgets/payment_summary.dart';
import 'package:capstone_project/screens/pending_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../widgets/custom_font.dart';
import '../screens/payment_method_screen.dart';
```

## payment_method_screen.dart

```dart
import '../widgets/payment_summary.dart';
import '../widgets/confirmation_dialog.dart';
import 'dart:typed_data';
import 'package:capstone_project/screens/home_screen.dart';
import 'package:capstone_project/screens/pending_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:image_picker/image_picker.dart';
import '../services/mongo_data_api_service.dart';
import '../widgets/custom_font.dart';
import '../widgets/simple_message_dialog.dart';
```

## payment_refund_screen.dart

```dart
import '../widgets/form_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../services/mongo_data_api_service.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/simple_message_dialog.dart';
import 'history_screen.dart';
```

## pending_screen.dart

```dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../screens/history_detail_screen.dart';
import '../screens/history_screen.dart';
import '../screens/request_detail_screen.dart';
```

## profile_screen.dart

```dart
import 'package:capstone_project/models/profile_data.dart';
import 'package:capstone_project/screens/change_password_screen.dart';
import 'package:capstone_project/screens/edit_profile_screen.dart';
import 'package:capstone_project/screens/splash_screen.dart';
import 'package:capstone_project/services/mongo_data_api_service.dart';
import 'package:capstone_project/widgets/confirmation_dialog.dart';
import 'package:capstone_project/widgets/profile_avatar.dart';
import 'package:capstone_project/widgets/simple_message_dialog.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
```

## register_screen.dart

```dart
import '../widgets/form_ui.dart';
import '../models/password_rules.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/student_academic_options.dart';
import '../services/mongo_data_api_service.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/simple_message_dialog.dart';
```

## request_detail_screen.dart

```dart
import '../widgets/request_status_tracker.dart';
import 'payment_method_screen.dart';
import 'package:capstone_project/constants.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:intl/intl.dart';
import '../widgets/custom_font.dart';
import '../screens/payment_details_screen.dart';
import '../screens/pending_screen.dart';
import '../models/request_status.dart';
```

## request_form_screen.dart

```dart
import '../widgets/form_ui.dart';
import 'package:capstone_project/screens/home_screen.dart';
import 'package:capstone_project/screens/pending_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../models/api_date_time.dart';
import '../models/document_catalog.dart';
import '../models/profile_data.dart';
import '../widgets/custom_font.dart';
import '../services/mongo_data_api_service.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/simple_message_dialog.dart';
import '../widgets/request_progress_indicator.dart';
```

## splash_screen.dart

```dart
import 'dart:async';
import 'package:capstone_project/screens/home_screen.dart';
import 'package:capstone_project/services/mongo_data_api_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
```

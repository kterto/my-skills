import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

{{envImport}}

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if ({{projectId}}.isEmpty) {
      throw StateError(
        'This build is ENVLESS: pass --dart-define-from-file=env/<env>.json.',
      );
    }
    switch (kIsWeb ? null : defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('Firebase is set up for Android and iOS only.');
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: {{apiKeyAndroid}},
    appId: {{appIdAndroid}},
    messagingSenderId: {{messagingSenderId}},
    projectId: {{projectId}},
    storageBucket: {{storageBucket}},
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: {{apiKeyIos}},
    appId: {{appIdIos}},
    messagingSenderId: {{messagingSenderId}},
    projectId: {{projectId}},
    storageBucket: {{storageBucket}},
    iosBundleId: {{iosBundleId}},
  );
}

# Pocketbook Android

Native Android WebView shell for https://book-kepping-app.vercel.app. Requires Android 8 or newer and an internet connection. Supports receipt file selection, authenticated image/PDF viewing, and CSV export through Android's file picker. Website changes appear without rebuilding the APK.

Build with `bash android/build.sh`. Override `ANDROID_SDK_ROOT` and `POCKETBOOK_JDK` for other machines. Requires Android SDK platform 35, build tools 36.0.0, and a JDK. The build uses the Android SDK directly without Gradle downloads.

The output is `artifacts/pocketbook-android.apk`, signed with a local development key. It is suitable for sideload testing, not a Play Store release. The key is kept under ignored `android/keys/`; preserve it to update existing installations. Build intermediates remain in ignored `android/build-*` directories.

The live Vercel site must have `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` configured for accounts and transactions to work.

#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
SDK="${ANDROID_SDK_ROOT:-/Users/mychll/Library/Android/sdk}"
JDK="${POCKETBOOK_JDK:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
BUILD_TOOLS="$SDK/build-tools/36.0.0"
PLATFORM="$SDK/platforms/android-35/android.jar"
export JAVA_HOME="$JDK"
export PATH="$JDK/bin:$PATH"
BUILD_DIR="$(mktemp -d "$PWD/android/build-XXXXXX")"
mkdir -p "$BUILD_DIR/res/drawable" "$BUILD_DIR/classes" "$BUILD_DIR/generated" "$BUILD_DIR/dex" android/keys artifacts
cp public/images/kopi-logo.png "$BUILD_DIR/res/drawable/kopi.png"
"$BUILD_TOOLS/aapt2" compile --dir "$BUILD_DIR/res" -o "$BUILD_DIR/resources.zip"
"$BUILD_TOOLS/aapt2" link -o "$BUILD_DIR/base.apk" -I "$PLATFORM" --manifest android/AndroidManifest.xml --java "$BUILD_DIR/generated" "$BUILD_DIR/resources.zip"
"$JDK/bin/javac" -source 8 -target 8 -classpath "$PLATFORM" -d "$BUILD_DIR/classes" android/src/app/pocketbook/mobile/MainActivity.java
"$JDK/bin/jar" cf "$BUILD_DIR/classes.jar" -C "$BUILD_DIR/classes" .
"$BUILD_TOOLS/d8" --lib "$PLATFORM" --min-api 26 --output "$BUILD_DIR/dex" "$BUILD_DIR/classes.jar"
cp "$BUILD_DIR/base.apk" "$BUILD_DIR/unsigned.apk"
(cd "$BUILD_DIR/dex" && zip -q "$BUILD_DIR/unsigned.apk" classes.dex)
"$BUILD_TOOLS/zipalign" -f -p 4 "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk"
if [ ! -f android/keys/pocketbook-debug.keystore ]; then
  "$JDK/bin/keytool" -genkeypair -keystore android/keys/pocketbook-debug.keystore -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Pocketbook Development,O=Pocketbook,C=PH"
fi
"$BUILD_TOOLS/apksigner" sign --ks android/keys/pocketbook-debug.keystore --ks-pass pass:android --key-pass pass:android --out artifacts/pocketbook-android.apk "$BUILD_DIR/aligned.apk"
"$BUILD_TOOLS/apksigner" verify --verbose artifacts/pocketbook-android.apk
printf 'APK: %s/artifacts/pocketbook-android.apk\n' "$PWD"

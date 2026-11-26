#!/usr/bin/env bash
# Build, align, sign, and verify the Magpie release APK.
# Run from the repository root in a terminal the developer can type into: apksigner asks for the keystore password.
# Usage: .agents/skills/release-github-android/sign-apk.sh <version>   (example: 0.3.0)
set -euo pipefail

VERSION="${1:?usage: sign-apk.sh <version>}"
KEYSTORE="${MAGPIE_KEYSTORE:-$HOME/Documents/auth/dodotechhub-v1.jks}"
ALIAS="io.github.dodotechhub.magpie"
EXPECTED_CERT="165bcfbcb1a4f14c0aa3e2a6c078cab419b5d22db5e4606eeaf506d09a71ceff"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"
OUT="android/app/build/outputs/apk/release"

(cd android && ./gradlew assembleRelease -q)

BUILT="$("$BT/aapt2" dump badging "$OUT/app-release.apk" | head -1)"
echo "$BUILT"
[[ "$BUILT" == *"versionName='$VERSION'"* ]] || { echo "APK version is not $VERSION. Bump the version first." >&2; exit 1; }

"$BT/zipalign" -f -p 4 "$OUT/app-release.apk" "$OUT/aligned.apk"
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias "$ALIAS" --out "$OUT/magpie-$VERSION.apk" "$OUT/aligned.apk"

"$BT/apksigner" verify --print-certs "$OUT/magpie-$VERSION.apk" | grep -q "SHA-256 digest: $EXPECTED_CERT" || { echo "Signing certificate does not match the published fingerprint." >&2; exit 1; }

echo "Signed: $OUT/magpie-$VERSION.apk"
shasum -a 256 "$OUT/magpie-$VERSION.apk"

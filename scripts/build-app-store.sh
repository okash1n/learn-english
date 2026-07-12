#!/usr/bin/env bash
# Mac App Store専用appをSandboxでbuildし、必要に応じてpkg検証・uploadまで行う。
set -euo pipefail

MODE="${1:-sandbox}"
case "$MODE" in
  sandbox|package|upload) ;;
  *) echo "使い方: $0 [sandbox|package|upload]" >&2; exit 2 ;;
esac

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd -P)"
SRC_TAURI_DIR="$REPO_DIR/desktop/src-tauri"
TARGET_DIR="$SRC_TAURI_DIR/target/app-store"
BASE_CONFIG="$SRC_TAURI_DIR/tauri.appstore.conf.json"
BASE_ENTITLEMENTS="$SRC_TAURI_DIR/AppStoreEntitlements.plist"
HELPER_ENTITLEMENTS="$SRC_TAURI_DIR/AppStoreHelperEntitlements.plist"
RUNTIME_ENTITLEMENTS="$SRC_TAURI_DIR/AppStoreRuntimeEntitlements.plist"
GENERATED_CONFIG="$TARGET_DIR/generated.conf.json"
GENERATED_ENTITLEMENTS="$TARGET_DIR/AppStoreEntitlements.plist"
APP="$SRC_TAURI_DIR/target/release/bundle/macos/solo-eikaiwa.app"
PKG="$TARGET_DIR/solo-eikaiwa.pkg"
DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export DEVELOPER_DIR

log() { echo "== app-store: $* =="; }
required() {
  local name="$1"
  [[ -n "${!name:-}" ]] || { echo "ERROR: $name が必要です" >&2; exit 1; }
}
codesign_with_retry() {
  local attempt
  for attempt in 1 2 3; do
    if codesign "$@"; then
      return 0
    fi
    [[ "$attempt" -lt 3 ]] || return 1
    log "codesign再試行 ($((attempt + 1))/3)"
    sleep "$attempt"
  done
}

if [[ "$MODE" != "sandbox" ]]; then
  RELEASE_ENV="$HOME/.config/solo-eikaiwa/release.env"
  APP_STORE_ENV="$HOME/.config/solo-eikaiwa/app-store.env"
  [[ -f "$RELEASE_ENV" ]] || { echo "ERROR: release.env がありません" >&2; exit 1; }
  [[ -f "$APP_STORE_ENV" ]] || { echo "ERROR: app-store.env がありません" >&2; exit 1; }
  set -a
  # shellcheck disable=SC1090
  source "$RELEASE_ENV"
  # shellcheck disable=SC1090
  source "$APP_STORE_ENV"
  set +a
  for name in APP_STORE_BUNDLE_ID APP_STORE_BUILD_NUMBER APPLE_TEAM_ID \
    APPLE_APP_DISTRIBUTION_IDENTITY APPLE_INSTALLER_DISTRIBUTION_IDENTITY \
    APPLE_APPSTORE_PROFILE_PATH APPLE_API_KEY APPLE_API_ISSUER APPLE_API_KEY_PATH; do
    required "$name"
  done
  [[ -f "$APPLE_APPSTORE_PROFILE_PATH" ]] || { echo "ERROR: provisioning profile がありません" >&2; exit 1; }
  [[ -f "$APPLE_API_KEY_PATH" ]] || { echo "ERROR: App Store Connect API key がありません" >&2; exit 1; }
else
  APP_STORE_BUNDLE_ID="${APP_STORE_BUNDLE_ID:-org.btajp.solo-eikaiwa.preview}"
  APP_STORE_BUILD_NUMBER="${APP_STORE_BUILD_NUMBER:-1}"
  APPLE_TEAM_ID=""
  APPLE_APP_DISTRIBUTION_IDENTITY="-"
fi

[[ "$APP_STORE_BUNDLE_ID" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "ERROR: Bundle ID が不正です" >&2; exit 1; }
[[ "$APP_STORE_BUILD_NUMBER" =~ ^[1-9][0-9]*$ ]] || { echo "ERROR: build number は正の整数にしてください" >&2; exit 1; }

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cp "$BASE_ENTITLEMENTS" "$GENERATED_ENTITLEMENTS"

if [[ "$MODE" != "sandbox" ]]; then
  /usr/libexec/PlistBuddy -c "Add :com.apple.application-identifier string $APPLE_TEAM_ID.$APP_STORE_BUNDLE_ID" "$GENERATED_ENTITLEMENTS"
  /usr/libexec/PlistBuddy -c "Add :com.apple.developer.team-identifier string $APPLE_TEAM_ID" "$GENERATED_ENTITLEMENTS"
  /usr/libexec/PlistBuddy -c "Add :keychain-access-groups array" "$GENERATED_ENTITLEMENTS"
  /usr/libexec/PlistBuddy -c "Add :keychain-access-groups:0 string $APPLE_TEAM_ID.$APP_STORE_BUNDLE_ID" "$GENERATED_ENTITLEMENTS"
  security cms -D -i "$APPLE_APPSTORE_PROFILE_PATH" > "$TARGET_DIR/profile.plist"
  profile_app_id="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:com.apple.application-identifier' "$TARGET_DIR/profile.plist")"
  [[ "$profile_app_id" == "$APPLE_TEAM_ID.$APP_STORE_BUNDLE_ID" ]] || {
    echo "ERROR: provisioning profile とBundle ID/Team IDが一致しません" >&2
    exit 1
  }
fi

jq -n \
  --arg identifier "$APP_STORE_BUNDLE_ID" \
  --arg bundleVersion "$APP_STORE_BUILD_NUMBER" \
  --arg entitlements "$GENERATED_ENTITLEMENTS" \
  --arg profile "${APPLE_APPSTORE_PROFILE_PATH:-}" \
  '{identifier:$identifier,bundle:{macOS:{bundleVersion:$bundleVersion,entitlements:$entitlements}}}
   | if $profile == "" then . else .bundle.macOS.files={"embedded.provisionprofile":$profile} end' \
  > "$GENERATED_CONFIG"

log "共通検証"
"$REPO_DIR/scripts/verify.sh" release
log "Store専用sidecar/resources build"
"$REPO_DIR/desktop/build-sidecar.sh" --app-store
log "Tauri app bundle build（自己更新なし）"
(cd "$SRC_TAURI_DIR" && cargo tauri build \
  --bundles app \
  --features app-store \
  --no-sign \
  --config "$BASE_CONFIG" \
  --config "$GENERATED_CONFIG")

[[ -d "$APP" ]] || { echo "ERROR: app bundle が生成されませんでした" >&2; exit 1; }
rm -f "$APP/Contents/MacOS/verify-updater-signature"
if [[ "$MODE" != "sandbox" ]]; then
  chmod 0644 "$APP/Contents/embedded.provisionprofile"
fi

unreadable_path="$(find "$APP" -type f ! -perm -004 -print -quit)"
untraversable_path="$(find "$APP" -type d \( ! -perm -004 -o ! -perm -001 \) -print -quit)"
[[ -z "$unreadable_path" && -z "$untraversable_path" ]] || {
  echo "ERROR: app bundle に一般ユーザーが読み取れない項目があります" >&2
  exit 1
}

runtime_sign_args=(--force --options runtime --entitlements "$RUNTIME_ENTITLEMENTS" --sign "$APPLE_APP_DISTRIBUTION_IDENTITY")
helper_sign_args=(--force --options runtime --entitlements "$HELPER_ENTITLEMENTS" --sign "$APPLE_APP_DISTRIBUTION_IDENTITY")
if [[ "$APPLE_APP_DISTRIBUTION_IDENTITY" != "-" ]]; then
  runtime_sign_args+=(--timestamp)
  helper_sign_args+=(--timestamp)
fi
[[ -x "$APP/Contents/MacOS/solo-server" ]] || { echo "ERROR: 必須runtimeがありません" >&2; exit 1; }
codesign_with_retry "${runtime_sign_args[@]}" "$APP/Contents/MacOS/solo-server"
for helper in \
  "$APP/Contents/MacOS/solo-keychain" \
  "$APP/Contents/Resources/whisper-bin/whisper-cli"; do
  [[ -x "$helper" ]] || { echo "ERROR: 必須helperがありません" >&2; exit 1; }
  codesign_with_retry "${helper_sign_args[@]}" "$helper"
done

app_sign_args=(--force --options runtime --entitlements "$GENERATED_ENTITLEMENTS" --sign "$APPLE_APP_DISTRIBUTION_IDENTITY")
if [[ "$APPLE_APP_DISTRIBUTION_IDENTITY" != "-" ]]; then app_sign_args+=(--timestamp); fi
codesign_with_retry "${app_sign_args[@]}" "$APP"
codesign --verify --deep --strict "$APP"

actual_identifier="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Contents/Info.plist")"
actual_build="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Contents/Info.plist")"
[[ "$actual_identifier" == "$APP_STORE_BUNDLE_ID" && "$actual_build" == "$APP_STORE_BUILD_NUMBER" ]]
[[ ! -e "$APP/Contents/MacOS/verify-updater-signature" ]]

if [[ "$MODE" == "sandbox" ]]; then
  log "Sandbox app build完了: $APP"
  exit 0
fi

log "Mac App Store pkg作成"
xcrun productbuild \
  --sign "$APPLE_INSTALLER_DISTRIBUTION_IDENTITY" \
  --component "$APP" /Applications \
  "$PKG"
/usr/sbin/pkgutil --check-signature "$PKG" >/dev/null

log "App Store Connect検証"
xcrun altool --validate-app "$PKG" \
  --api-key "$APPLE_API_KEY" --api-issuer "$APPLE_API_ISSUER" \
  --p8-file-path "$APPLE_API_KEY_PATH"

if [[ "$MODE" == "upload" ]]; then
  log "App Store Connectへupload"
  xcrun altool --upload-package "$PKG" \
    --api-key "$APPLE_API_KEY" --api-issuer "$APPLE_API_ISSUER" \
    --p8-file-path "$APPLE_API_KEY_PATH"
fi

log "$MODE 完了: $PKG"

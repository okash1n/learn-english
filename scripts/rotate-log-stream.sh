#!/usr/bin/env bash
# stdinの診断ログを行単位でsanitizationし、size-based rotationしながら保存する。
# ロガー側の失敗で呼び出し元を止めないため、書込み失敗時もstdinを最後まで読み続ける。
set -uo pipefail

LOG_PATH="${1:?使い方: $0 <log-path>}"
LOG_MAX_BYTES="${SOLO_EIKAIWA_LOG_MAX_BYTES:-5242880}"
LOG_GENERATIONS="${SOLO_EIKAIWA_LOG_GENERATIONS:-3}"
LOG_MAX_LINE_BYTES="${SOLO_EIKAIWA_LOG_MAX_LINE_BYTES:-65536}"
REDACTED="[redacted sensitive diagnostic line]"
TRUNCATED="...[truncated]"

if ! [[ "$LOG_MAX_BYTES" =~ ^[1-9][0-9]*$ ]] || ((LOG_MAX_BYTES < 64)); then
  LOG_MAX_BYTES=5242880
fi
if ! [[ "$LOG_GENERATIONS" =~ ^[1-9][0-9]*$ ]] || ((LOG_GENERATIONS > 20)); then
  LOG_GENERATIONS=3
fi
if ! [[ "$LOG_MAX_LINE_BYTES" =~ ^[1-9][0-9]*$ ]]; then
  LOG_MAX_LINE_BYTES=65536
fi

export LC_ALL=C
shopt -s nocasematch
umask 077
mkdir -p "$(dirname -- "$LOG_PATH")" || true
if ! : >>"$LOG_PATH"; then
  echo "WARN: diagnostic logを作成できません: $LOG_PATH" >&2
fi
chmod 600 "$LOG_PATH" 2>/dev/null || true

file_size() {
  local file="$1" size
  [[ -f "$file" ]] || { printf '0'; return; }
  size="$(wc -c <"$file" 2>/dev/null)" || size=0
  printf '%s' "${size//[[:space:]]/}"
}

trim_to_limit() {
  local file="$1" size temp
  size="$(file_size "$file")"
  ((size <= LOG_MAX_BYTES)) && return 0
  temp="${file}.trim.$$"
  if tail -c "$LOG_MAX_BYTES" "$file" >"$temp" 2>/dev/null && mv -f "$temp" "$file"; then
    chmod 600 "$file" 2>/dev/null || true
    return 0
  fi
  rm -f "$temp"
  return 1
}

rotate_files() {
  local generation source target
  rm -f "${LOG_PATH}.${LOG_GENERATIONS}" || return 1
  for ((generation = LOG_GENERATIONS - 1; generation >= 1; generation--)); do
    source="${LOG_PATH}.${generation}"
    target="${LOG_PATH}.$((generation + 1))"
    [[ ! -e "$source" ]] || mv -f "$source" "$target" || return 1
  done
  [[ ! -e "$LOG_PATH" ]] || mv -f "$LOG_PATH" "${LOG_PATH}.1" || return 1
  : >"$LOG_PATH" || return 1
  chmod 600 "$LOG_PATH" 2>/dev/null || true
}

sanitize_line() {
  local line="$1"
  case "$line" in
    *Authorization*|*authorization*|*AUTHORIZATION*|\
    *Bearer\ *|*bearer\ *|*BEARER\ *|\
    *api_key*|*apikey*|*api-key*|*api\ key*|\
    github_pat_*|*" github_pat_"*|sk-*|*" sk-"*|*"=sk-"*|*"\"sk-"*|\
    utterance=*|*" utterance="*|*"\"utterance\""*|\
    transcript=*|*" transcript="*|*"\"transcript\""*|\
    text=*|*" text="*|*"\"text\""*|\
    body=*|*" body="*|*"\"body\""*|\
    prompt=*|*" prompt="*|*"\"prompt\""*|\
    messages=*|*" messages="*|*"\"messages\""*)
      printf '%s' "$REDACTED"
      ;;
    *)
      printf '%s' "$line"
      ;;
  esac
}

for ((generation = 0; generation <= LOG_GENERATIONS; generation++)); do
  file="$LOG_PATH"
  ((generation == 0)) || file="${LOG_PATH}.${generation}"
  trim_to_limit "$file" || echo "WARN: diagnostic logの既存世代を縮小できません: $file" >&2
  [[ ! -e "$file" ]] || chmod 600 "$file" 2>/dev/null || true
done

while IFS= read -r line || [[ -n "$line" ]]; do
  line="$(sanitize_line "$line")"
  line_limit=$((LOG_MAX_BYTES - 1))
  ((line_limit <= LOG_MAX_LINE_BYTES)) || line_limit="$LOG_MAX_LINE_BYTES"
  if ((${#line} > line_limit)); then
    keep=$((line_limit - ${#TRUNCATED}))
    ((keep > 0)) || keep=0
    line="${line:0:keep}${TRUNCATED}"
  fi
  entry_bytes=$((${#line} + 1))
  current_bytes="$(file_size "$LOG_PATH")"
  if ((current_bytes + entry_bytes > LOG_MAX_BYTES)); then
    rotate_files || echo "WARN: diagnostic log rotationに失敗しました: $LOG_PATH" >&2
  fi
  if ! printf '%s\n' "$line" >>"$LOG_PATH"; then
    echo "WARN: diagnostic log書込みに失敗しました: $LOG_PATH" >&2
  fi
done

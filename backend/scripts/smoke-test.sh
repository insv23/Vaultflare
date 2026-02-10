#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8787}"
HTTP_TIMEOUT="${HTTP_TIMEOUT:-15}"
EMAIL="${EMAIL:-smoke.$(date +%s).$RANDOM@example.com}"
AUTH_KEY="${AUTH_KEY:-0123456789abcdef0123456789abcdef}"
KDF_SALT="${KDF_SALT:-abcdefghijklmnop}"
KDF_PARAMS="${KDF_PARAMS:-{\"iterations\":600000,\"memory\":19456,\"parallelism\":1}}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

json_post() {
  local url="$1"
  shift
  http --ignore-stdin --timeout="$HTTP_TIMEOUT" --print=b POST "$url" "$@"
}

json_get() {
  local url="$1"
  shift
  http --ignore-stdin --timeout="$HTTP_TIMEOUT" --print=b GET "$url" "$@"
}

json_put() {
  local url="$1"
  shift
  http --ignore-stdin --timeout="$HTTP_TIMEOUT" --print=b PUT "$url" "$@"
}

json_delete() {
  local url="$1"
  shift
  http --ignore-stdin --timeout="$HTTP_TIMEOUT" --print=b DELETE "$url" "$@"
}

status_get() {
  local url="$1"
  shift
  http --ignore-stdin --timeout="$HTTP_TIMEOUT" --print=h GET "$url" "$@" \
    | awk 'NR==1 {print $2}'
}

print_step() {
  echo
  echo "==> $1"
}

require_cmd http
require_cmd jq

print_step "health check"
HEALTH_JSON="$(json_get "$BASE_URL/health")"
echo "$HEALTH_JSON" | jq -e '.status == "ok"' >/dev/null
echo "health ok"

print_step "register"
REGISTER_JSON="$(
  json_post "$BASE_URL/api/auth/register" \
    email="$EMAIL" \
    auth_key="$AUTH_KEY" \
    kdf_salt="$KDF_SALT" \
    kdf_params:="$KDF_PARAMS"
)"
USER_ID="$(echo "$REGISTER_JSON" | jq -r '.user_id')"
echo "$REGISTER_JSON" | jq -e --arg e "$EMAIL" '.email == $e' >/dev/null
echo "$REGISTER_JSON" | jq -e '.vault_version == 0' >/dev/null
echo "registered user_id=$USER_ID"

print_step "login challenge"
CHALLENGE_JSON="$(
  json_post "$BASE_URL/api/auth/login/challenge" \
    email="$EMAIL"
)"
echo "$CHALLENGE_JSON" | jq -e --arg uid "$USER_ID" '.user_id == $uid' >/dev/null
echo "$CHALLENGE_JSON" | jq -e '.kdf_salt | length > 0' >/dev/null
echo "challenge ok"

print_step "login verify"
VERIFY_JSON="$(
  json_post "$BASE_URL/api/auth/login/verify" \
    email="$EMAIL" \
    auth_key="$AUTH_KEY"
)"
TOKEN="$(echo "$VERIFY_JSON" | jq -r '.access_token')"
echo "$VERIFY_JSON" | jq -e '.token_type == "Bearer"' >/dev/null
echo "$VERIFY_JSON" | jq -e --arg uid "$USER_ID" '.user_id == $uid' >/dev/null
echo "token issued"

print_step "create cipher"
CREATE_JSON="$(
  json_post "$BASE_URL/api/ciphers" \
    Authorization:"Bearer $TOKEN" \
    encrypted_dek="dek-v1" \
    encrypted_data="ciphertext-v1"
)"
CIPHER_ID="$(echo "$CREATE_JSON" | jq -r '.cipher_id')"
ITEM_VERSION="$(echo "$CREATE_JSON" | jq -r '.item_version')"
echo "$CREATE_JSON" | jq -e '.item_version == 1' >/dev/null
echo "created cipher_id=$CIPHER_ID item_version=$ITEM_VERSION"

print_step "list ciphers"
LIST_JSON="$(
  json_get "$BASE_URL/api/ciphers" \
    Authorization:"Bearer $TOKEN"
)"
echo "$LIST_JSON" | jq -e --arg cid "$CIPHER_ID" '.ciphers | any(.cipher_id == $cid)' >/dev/null
echo "list ok"

print_step "sync ciphers"
SYNC_JSON="$(
  json_get "$BASE_URL/api/ciphers/sync" \
    Authorization:"Bearer $TOKEN" \
    since_version=="0"
)"
echo "$SYNC_JSON" | jq -e --arg cid "$CIPHER_ID" '.ciphers | any(.cipher_id == $cid)' >/dev/null
echo "sync ok"

print_step "get cipher"
GET_JSON="$(
  json_get "$BASE_URL/api/ciphers/$CIPHER_ID" \
    Authorization:"Bearer $TOKEN"
)"
echo "$GET_JSON" | jq -e --arg cid "$CIPHER_ID" '.cipher_id == $cid' >/dev/null
echo "get ok"

print_step "update cipher"
UPDATE_JSON="$(
  json_put "$BASE_URL/api/ciphers/$CIPHER_ID" \
    Authorization:"Bearer $TOKEN" \
    encrypted_dek="dek-v2" \
    encrypted_data="ciphertext-v2" \
    expected_version:=1
)"
echo "$UPDATE_JSON" | jq -e '.item_version == 2' >/dev/null
echo "update ok"

print_step "delete cipher"
DELETE_JSON="$(
  json_delete "$BASE_URL/api/ciphers/$CIPHER_ID" \
    Authorization:"Bearer $TOKEN" \
    expected_version=="2"
)"
echo "$DELETE_JSON" | jq -e '.item_version == 3' >/dev/null
echo "$DELETE_JSON" | jq -e '.deleted_at > 0' >/dev/null
echo "delete ok"

print_step "logout"
LOGOUT_JSON="$(
  json_post "$BASE_URL/api/auth/logout" \
    Authorization:"Bearer $TOKEN"
)"
echo "$LOGOUT_JSON" | jq -e '.logged_out == true' >/dev/null
echo "logout ok"

print_step "verify token revoked"
POST_LOGOUT_STATUS="$(
  status_get "$BASE_URL/api/ciphers" \
    Authorization:"Bearer $TOKEN"
)"
if [[ "$POST_LOGOUT_STATUS" != "401" ]]; then
  echo "expected 401 after logout, got $POST_LOGOUT_STATUS" >&2
  exit 1
fi
echo "revocation check ok (401)"

echo
echo "smoke test passed"
echo "BASE_URL=$BASE_URL"
echo "EMAIL=$EMAIL"
echo "USER_ID=$USER_ID"
echo "CIPHER_ID=$CIPHER_ID"

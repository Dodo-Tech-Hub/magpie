#!/usr/bin/env bash
# Checks what a GitHub App (or classic OAuth app) user token can do, for research R1.
# It signs in with the device flow, then tries one star, one follow, one gist star, and one star list.
# Run it with a TEST account: it stars octocat/Hello-World, follows octocat, stars one gist, and creates a list named "magpie-test".
#
# Usage:   ./verify-access.sh <client_id> [scope]
# Example: ./verify-access.sh Iv23abc...                              (GitHub App: no scope)
#          ./verify-access.sh Ov23abc... "public_repo user:follow user gist"   (classic OAuth app)
# The token is never printed. Paste the output into the pull request or the chat.
set -euo pipefail

CLIENT_ID="${1:?Usage: $0 <client_id> [scope]}"
SCOPE="${2:-}"
GIST_ID="${GIST_ID:-6cad326836d38bd3a7ae}" # a public gist. If line 6 says 404, run again with GIST_ID=<id of any public gist>
field() { sed -n "s/.*\"$1\":\"\{0,1\}\([^\",}]*\).*/\1/p"; }

start=$(curl -sS -X POST https://github.com/login/device/code -H 'Accept: application/json' \
  --data-urlencode "client_id=$CLIENT_ID" ${SCOPE:+--data-urlencode "scope=$SCOPE"})
device_code=$(printf '%s' "$start" | field device_code)
interval=$(printf '%s' "$start" | field interval)
if [ -z "$device_code" ]; then echo "No code. GitHub said: $start"; exit 1; fi
echo "Open $(printf '%s' "$start" | field verification_uri) and enter: $(printf '%s' "$start" | field user_code)"

token=""
while [ -z "$token" ]; do
  sleep "${interval:-5}"
  poll=$(curl -sS -X POST https://github.com/login/oauth/access_token -H 'Accept: application/json' \
    --data-urlencode "client_id=$CLIENT_ID" --data-urlencode "device_code=$device_code" \
    --data-urlencode 'grant_type=urn:ietf:params:oauth:grant-type:device_code')
  token=$(printf '%s' "$poll" | field access_token)
  err=$(printf '%s' "$poll" | field error)
  case "$err" in
    ''|authorization_pending) ;;
    slow_down) interval=$(( ${interval:-5} + 5 )) ;;
    *) echo "Sign-in stopped: $err"; exit 1 ;;
  esac
done
echo "Signed in. Token fields: $(printf '%s' "$poll" | tr ',' '\n' | sed -n 's/^[{ ]*"\([a-z_]*\)".*/\1/p' | tr '\n' ' ')"
echo "Expires in (seconds): $(printf '%s' "$poll" | field expires_in)"

api() { # method path [json body]; prints status and the permission header GitHub wanted
  local out
  out=$(curl -sS -o /dev/null -D - -X "$1" "https://api.github.com$2" -H "Authorization: Bearer $token" \
    -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' ${3:+-d "$3"})
  printf '%s' "$out" | sed -n '1p; /^x-accepted-github-permissions/Ip; /^x-oauth-scopes/Ip' | tr -d '\r' | tr '\n' ' '
  echo
}
gql() { curl -sS -X POST https://api.github.com/graphql -H "Authorization: Bearer $token" -d "$1" | cut -c1-400; echo; }

echo "1. Who am I:            $(api GET /user)"
echo "2. Star a public repo:  $(api PUT /user/starred/octocat/Hello-World)"
echo "3. Read my stars:       $(api GET '/user/starred?per_page=1')"
echo "4. Follow a person:     $(api PUT /user/following/octocat)"
echo "5. Read my follows:     $(api GET '/user/following?per_page=1')"
echo "6. Star a gist:         $(api PUT "/gists/$GIST_ID/star")"
echo "7. Read starred gists:  $(api GET '/gists/starred?per_page=1')"
echo "8. Read my star lists:"
gql '{"query":"{ viewer { lists(first: 5) { nodes { id name } } } }"}'
echo "9. Create a star list:"
gql '{"query":"mutation { createUserList(input: {name: \"magpie-test\"}) { list { id name } } }"}'
echo "Done. 204 or 200 means it works. 403 or 404 on line 2 means a GitHub App token cannot star (research R1)."

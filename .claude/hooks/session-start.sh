#!/bin/bash
# 1batch.cy: start-up check for Claude Code cloud sessions.
#
# At the start of each cloud session, this check tells Claude and the user:
#   - if the site test (node tests/smoke.js) can run
#   - if the session can use the Cloudflare API for the deploy, and what is missing
#
# The check changes nothing and never shows the token. It always stops with
# exit code 0, so the session starts also when a part is missing.

set -uo pipefail

# On your computer, the check does nothing.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

API=https://api.cloudflare.com/client/v4
ZONE=1batch.cy
PROJECT=1batch
SETUP_HELP="See \"Cloudflare work later\" in CLAUDE.md."

echo "1batch.cy start-up check:"

# ---------- Site test ----------

if ! command -v node >/dev/null 2>&1; then
  echo "- Site test: Node.js is not installed, so the test cannot run."
elif node -e "require.resolve('playwright')" >/dev/null 2>&1; then
  echo "- Site test: ready. Run: node tests/smoke.js"
else
  echo "- Site test: Playwright is not available, so the test cannot run."
fi

# ---------- Cloudflare API ----------

body=$(mktemp)
trap 'rm -f "$body"' EXIT

# The token comes from the environment variable CLOUDFLARE_API_TOKEN.
# Without the variable, the agent proxy adds the network secret of the environment, if there is one.
auth=()
token_source="network secret"
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  auth=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")
  token_source="environment variable CLOUDFLARE_API_TOKEN"
fi

# Sends a GET request to the Cloudflare API. Writes the HTTP status code (000: no connection).
cf_get() {
  curl -s --connect-timeout 5 --max-time 10 ${auth[@]+"${auth[@]}"} -o "$body" -w '%{http_code}' "$API$1" 2>/dev/null || true
}

# Reads one value from the JSON response. The argument is a JavaScript expression on "d".
json() {
  node -e 'const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); const v = eval(process.argv[2]); process.stdout.write(v == null ? "" : String(v));' "$body" "$1" 2>/dev/null
}

status=$(cf_get /user/tokens/verify)
if [ "$status" = "000" ]; then
  echo "- Cloudflare API: BLOCKED. The network settings of this environment do not allow api.cloudflare.com. $SETUP_HELP"
  exit 0
fi
echo "- Cloudflare API: reachable."

if [ "$status" != "200" ] || [ "$(json 'd.result && d.result.status')" != "active" ]; then
  if [ ${#auth[@]} -eq 0 ]; then
    echo "- Cloudflare token: none found (HTTP $status). Add a network secret for api.cloudflare.com, or the environment variable CLOUDFLARE_API_TOKEN. $SETUP_HELP"
  else
    echo "- Cloudflare token: NOT VALID (HTTP $status, $token_source). Make a new token. $SETUP_HELP"
  fi
  exit 0
fi
echo "- Cloudflare token: active ($token_source)."

status=$(cf_get "/zones?name=$ZONE")
zone_status=$(json 'd.result && d.result[0] && d.result[0].status')
account=$(json 'd.result && d.result[0] && d.result[0].account.id')
if [ "$status" != "200" ] || [ -z "$zone_status" ]; then
  echo "- Zone $ZONE: not found (HTTP $status). The token has no access to the zone, or the zone is not in this account."
  exit 0
fi
if [ "$zone_status" = "active" ]; then
  echo "- Zone $ZONE: active."
else
  echo "- Zone $ZONE: $zone_status. At the .cy registrar, set the name servers to: $(json 'd.result[0].name_servers.join(", ")')."
fi

status=$(cf_get "/accounts/$account/pages/projects/$PROJECT")
case "$status" in
  200)
    echo "- Pages project $PROJECT: exists ($(json 'd.result.subdomain'))." \
      "Custom domains: $(json '(d.result.domains || []).join(", ") || "none"')." \
      "Each push to main deploys the site."
    ;;
  404)
    echo "- Pages project $PROJECT: not made yet. Do the steps in \"Deploy: Cloudflare Pages\" in CLAUDE.md."
    ;;
  *)
    echo "- Pages project $PROJECT: unknown (HTTP $status). Make sure that the token has the permission \"Cloudflare Pages: Edit\"."
    ;;
esac

exit 0

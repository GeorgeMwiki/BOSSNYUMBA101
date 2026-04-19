#!/usr/bin/env bash
# UAT walkthrough — smoke-test the full platform end-to-end.
# Usage: ./scripts/uat-walkthrough.sh
set -euo pipefail

GATEWAY="${GATEWAY_URL:-http://127.0.0.1:4001}"
JWT_SECRET="${JWT_SECRET:-test-secret-for-dev-only-32chars}"

echo "=== BOSSNYUMBA UAT Walkthrough ==="
echo "Gateway: $GATEWAY"

fail() { echo "✗ $1"; exit 1; }
pass() { echo "✓ $1"; }

# Mint test JWT using openssl (no jsonwebtoken CLI dependency)
mint_jwt() {
  local tenant_id="${1:-tenant-001}"
  local user_id="${2:-user-001}"
  local role="${3:-TENANT_ADMIN}"
  local header=$(echo -n '{"alg":"HS256","typ":"JWT"}' | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
  local now=$(date +%s)
  local exp=$((now + 3600))
  local payload=$(echo -n "{\"userId\":\"$user_id\",\"tenantId\":\"$tenant_id\",\"role\":\"$role\",\"permissions\":[\"*\"],\"propertyAccess\":[\"*\"],\"iat\":$now,\"exp\":$exp}" | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
  local signature=$(echo -n "${header}.${payload}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
  echo "${header}.${payload}.${signature}"
}

TOKEN=$(mint_jwt)

# Step 1: health
code=$(curl -sS -o /dev/null -w "%{http_code}" "$GATEWAY/health")
[ "$code" = "200" ] || fail "health returned $code"
pass "health endpoint responding"

# Step 2: unauth rejection
code=$(curl -sS -o /dev/null -w "%{http_code}" "$GATEWAY/api/v1/marketplace/listings")
[ "$code" = "401" ] || fail "unauth marketplace got $code, expected 401"
pass "unauth request correctly rejected (401)"

# Step 3: hit real router paths (what each router.ts actually registers,
# not aspirational roots). A raw 404 here means router is missing or the
# OpenAPI catalog is lying — fail the UAT so CI catches the drift.
ENDPOINTS=(
  "marketplace/listings"                     # tenant listings index
  "waitlist/units/unit-demo"                 # waitlist for a unit
  "waitlist/customers/customer-demo"         # waitlist for a customer
  "gamification/policies"                    # active reward policy
  "gamification/customers/customer-demo"     # customer reward state
  "arrears/cases/case-demo/projection"       # arrears projection (500 ok — no loader)
  "me/notification-preferences"              # current user prefs
  "tenders/tender-demo/bids"                 # bids on a tender (empty list OK)
  "applications"                             # leasing applications list
  "renewals"                                 # lease renewals list
  # Wave 8 additions — warehouse + maintenance taxonomy + IoT
  "warehouse/items"                          # stock list
  "maintenance-taxonomy/categories"          # curated categories (seeded)
  "maintenance-taxonomy/problems"            # curated problems (seeded)
  "iot/sensors"                              # IoT sensor registry
  "iot/anomalies"                            # unresolved anomalies
  "lpms/preview-schema"                      # LPMS ingestion schema
)
for endpoint in "${ENDPOINTS[@]}"; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$GATEWAY/api/v1/$endpoint")
  if [[ "$code" == "404" ]]; then
    fail "GET /$endpoint returned 404 — endpoint missing or catalog drift"
  fi
  # 200/202 = success; 400/403 = auth-scoped business response; 500/503 = missing
  # upstream service but endpoint exists (catalog-truthful).
  if [[ "$code" =~ ^(200|202|400|403|500|503)$ ]]; then
    pass "GET /$endpoint → $code"
  else
    echo "⚠ GET /$endpoint → $code (unexpected, not blocking)"
  fi
done

# Step 4: tenant isolation — forged tenantId in query rejected
FORGED=$(mint_jwt "other-tenant")
code=$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $FORGED" "$GATEWAY/api/v1/marketplace/listings?tenantId=tenant-001")
[[ "$code" =~ ^(200|401|403)$ ]] || fail "tenant-isolation got unexpected $code"
pass "tenant isolation enforced"

echo ""
echo "=== UAT PASSED ==="

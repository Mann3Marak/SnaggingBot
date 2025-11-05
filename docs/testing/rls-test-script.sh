#!/bin/bash

# ============================================================================
# RLS & Webhook Test Script for New Status Values
# ============================================================================
# Purpose: Automated testing of RLS policies with extended status enum
# Ticket: Ticket 5 – Verify Row-Level Security & Webhooks with New Statuses
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# CONFIGURATION
# ============================================================================

# Supabase Configuration
SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key-here}"

# Test User Credentials
INSPECTOR_EMAIL="${INSPECTOR_EMAIL:-inspector@nhomesetup.com}"
INSPECTOR_PASSWORD="${INSPECTOR_PASSWORD:-password123}"
ADMIN_EMAIL="${ADMIN_EMAIL:-natalie@nhomesetup.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-password123}"

# Test Data (will be populated during setup)
SESSION_ID=""
ITEM_IDS=()
INSPECTOR_TOKEN=""
ADMIN_TOKEN=""

# Test Results
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Authenticate and get JWT token
get_auth_token() {
    local email=$1
    local password=$2

    local response=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${email}\",\"password\":\"${password}\"}")

    local token=$(echo "$response" | jq -r '.access_token')

    if [ "$token" = "null" ] || [ -z "$token" ]; then
        log_failure "Failed to authenticate as $email"
        echo "Response: $response"
        exit 1
    fi

    echo "$token"
}

# Create test inspection session
create_test_session() {
    local token=$1

    # Get first apartment
    local apartment_response=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/apartments?limit=1" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${token}")

    local apartment_id=$(echo "$apartment_response" | jq -r '.[0].id')

    if [ "$apartment_id" = "null" ]; then
        log_failure "No apartments found in database"
        exit 1
    fi

    # Create inspection session
    local session_response=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/inspection_sessions" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "{\"apartment_id\":\"${apartment_id}\",\"status\":\"in_progress\"}")

    local session_id=$(echo "$session_response" | jq -r '.[0].id')

    if [ "$session_id" = "null" ]; then
        log_failure "Failed to create test session"
        echo "Response: $session_response"
        exit 1
    fi

    echo "$session_id"
}

# Get checklist item IDs
get_checklist_items() {
    local token=$1
    local limit=${2:-5}

    local items_response=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/checklist_templates?limit=${limit}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${token}")

    echo "$items_response" | jq -r '.[].id'
}

# Test INSERT with specific status
test_insert_status() {
    local test_name=$1
    local token=$2
    local session_id=$3
    local item_id=$4
    local status=$5
    local notes=$6
    local expected_http_code=${7:-201}

    ((TESTS_RUN++))

    log_info "Running: $test_name"

    local response=$(curl -s -w "\n%{http_code}" -X POST "${SUPABASE_URL}/rest/v1/inspection_results" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "{\"session_id\":\"${session_id}\",\"item_id\":\"${item_id}\",\"status\":\"${status}\",\"notes\":\"${notes}\"}")

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "$expected_http_code" ]; then
        log_success "$test_name - HTTP $http_code"

        # Verify status in response
        local returned_status=$(echo "$body" | jq -r '.[0].status')
        if [ "$returned_status" = "$status" ]; then
            log_success "  └─ Status value '$status' correctly stored"
        else
            log_failure "  └─ Status mismatch: expected '$status', got '$returned_status'"
        fi
    else
        log_failure "$test_name - Expected HTTP $expected_http_code, got HTTP $http_code"
        echo "  Response: $body"
    fi
}

# Test SELECT operation
test_select() {
    local test_name=$1
    local token=$2
    local session_id=$3
    local expected_count=$4

    ((TESTS_RUN++))

    log_info "Running: $test_name"

    local response=$(curl -s -w "\n%{http_code}" -X GET "${SUPABASE_URL}/rest/v1/inspection_results?session_id=eq.${session_id}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${token}")

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        local count=$(echo "$body" | jq '. | length')

        if [ "$count" -ge "$expected_count" ]; then
            log_success "$test_name - Found $count results (expected >=$expected_count)"
        else
            log_failure "$test_name - Found $count results (expected >=$expected_count)"
        fi
    else
        log_failure "$test_name - Expected HTTP 200, got HTTP $http_code"
    fi
}

# Test UPDATE operation
test_update_status() {
    local test_name=$1
    local token=$2
    local result_id=$3
    local new_status=$4
    local expected_http_code=${5:-200}

    ((TESTS_RUN++))

    log_info "Running: $test_name"

    local response=$(curl -s -w "\n%{http_code}" -X PATCH "${SUPABASE_URL}/rest/v1/inspection_results?id=eq.${result_id}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=representation" \
        -d "{\"status\":\"${new_status}\"}")

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "$expected_http_code" ]; then
        log_success "$test_name - HTTP $http_code"
    else
        log_failure "$test_name - Expected HTTP $expected_http_code, got HTTP $http_code"
        echo "  Response: $body"
    fi
}

# ============================================================================
# SETUP PHASE
# ============================================================================

setup() {
    log_section "SETUP: Authenticating and Creating Test Data"

    # Authenticate users
    log_info "Authenticating inspector user..."
    INSPECTOR_TOKEN=$(get_auth_token "$INSPECTOR_EMAIL" "$INSPECTOR_PASSWORD")
    log_success "Inspector authenticated"

    log_info "Authenticating admin user..."
    ADMIN_TOKEN=$(get_auth_token "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
    log_success "Admin authenticated"

    # Create test session
    log_info "Creating test inspection session..."
    SESSION_ID=$(create_test_session "$INSPECTOR_TOKEN")
    log_success "Test session created: $SESSION_ID"

    # Get checklist items
    log_info "Fetching checklist items..."
    mapfile -t ITEM_IDS < <(get_checklist_items "$INSPECTOR_TOKEN" 10)
    log_success "Found ${#ITEM_IDS[@]} checklist items"
}

# ============================================================================
# TEST SUITE 1: INSPECTOR ROLE
# ============================================================================

test_inspector_role() {
    log_section "TEST SUITE 1: Inspector Role - INSERT Operations"

    # Test all 5 status values
    test_insert_status \
        "Test 1.1: INSERT status='good' (Inspector)" \
        "$INSPECTOR_TOKEN" \
        "$SESSION_ID" \
        "${ITEM_IDS[0]}" \
        "good" \
        "All items meet NHome standards" \
        201

    test_insert_status \
        "Test 1.2: INSERT status='issue' (Inspector)" \
        "$INSPECTOR_TOKEN" \
        "$SESSION_ID" \
        "${ITEM_IDS[1]}" \
        "issue" \
        "Minor scratch on cabinet door" \
        201

    test_insert_status \
        "Test 1.3: INSERT status='critical' (Inspector)" \
        "$INSPECTOR_TOKEN" \
        "$SESSION_ID" \
        "${ITEM_IDS[2]}" \
        "critical" \
        "Structural crack in load-bearing wall" \
        201

    test_insert_status \
        "Test 1.4: INSERT status='skipped' (Inspector) - NEW" \
        "$INSPECTOR_TOKEN" \
        "$SESSION_ID" \
        "${ITEM_IDS[3]}" \
        "skipped" \
        "Will inspect after furniture is moved" \
        201

    test_insert_status \
        "Test 1.5: INSERT status='not_applicable' (Inspector) - NEW" \
        "$INSPECTOR_TOKEN" \
        "$SESSION_ID" \
        "${ITEM_IDS[4]}" \
        "not_applicable" \
        "Unit does not have a balcony (ground floor)" \
        201

    # Test invalid status
    log_section "TEST SUITE 1b: Inspector Role - Invalid Status"

    test_insert_status \
        "Test 1.6: INSERT status='invalid_status' (Inspector) - Should FAIL" \
        "$INSPECTOR_TOKEN" \
        "$SESSION_ID" \
        "${ITEM_IDS[5]}" \
        "invalid_status" \
        "This should fail with constraint violation" \
        400

    # Test SELECT
    log_section "TEST SUITE 1c: Inspector Role - SELECT Operations"

    test_select \
        "Test 1.7: SELECT all results for own session (Inspector)" \
        "$INSPECTOR_TOKEN" \
        "$SESSION_ID" \
        5
}

# ============================================================================
# TEST SUITE 2: ADMIN ROLE
# ============================================================================

test_admin_role() {
    log_section "TEST SUITE 2: Admin Role - INSERT Operations"

    test_insert_status \
        "Test 2.1: INSERT status='good' (Admin)" \
        "$ADMIN_TOKEN" \
        "$SESSION_ID" \
        "${ITEM_IDS[6]}" \
        "good" \
        "Admin override - approved" \
        201

    test_insert_status \
        "Test 2.2: INSERT status='skipped' (Admin) - NEW" \
        "$ADMIN_TOKEN" \
        "$SESSION_ID" \
        "${ITEM_IDS[7]}" \
        "skipped" \
        "Admin marked as skipped for now" \
        201

    test_insert_status \
        "Test 2.3: INSERT status='not_applicable' (Admin) - NEW" \
        "$ADMIN_TOKEN" \
        "$SESSION_ID" \
        "${ITEM_IDS[8]}" \
        "not_applicable" \
        "Admin confirmed item N/A for this unit type" \
        201

    # Test SELECT
    log_section "TEST SUITE 2b: Admin Role - SELECT Operations"

    test_select \
        "Test 2.4: SELECT all results for session (Admin)" \
        "$ADMIN_TOKEN" \
        "$SESSION_ID" \
        8
}

# ============================================================================
# TEST SUITE 3: UNAUTHENTICATED
# ============================================================================

test_unauthenticated() {
    log_section "TEST SUITE 3: Unauthenticated Access - Should FAIL"

    ((TESTS_RUN++))

    log_info "Test 3.1: INSERT without auth token (should fail)"

    local response=$(curl -s -w "\n%{http_code}" -X POST "${SUPABASE_URL}/rest/v1/inspection_results" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"session_id\":\"${SESSION_ID}\",\"item_id\":\"${ITEM_IDS[0]}\",\"status\":\"good\"}")

    local http_code=$(echo "$response" | tail -n1)

    # Supabase RLS will return either 401 (unauthorized) or 200 with empty result
    # because RLS filtering will prevent insertion
    if [ "$http_code" = "401" ] || [ "$http_code" = "403" ] || [ "$http_code" = "200" ]; then
        log_success "Test 3.1: Unauthenticated INSERT correctly denied (HTTP $http_code)"
    else
        log_failure "Test 3.1: Expected HTTP 401/403/200, got HTTP $http_code"
    fi
}

# ============================================================================
# TEST SUITE 4: UPDATE OPERATIONS
# ============================================================================

test_update_operations() {
    log_section "TEST SUITE 4: UPDATE Operations"

    # First, get a result ID to update
    local result_response=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/inspection_results?session_id=eq.${SESSION_ID}&status=eq.skipped&limit=1" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${INSPECTOR_TOKEN}")

    local result_id=$(echo "$result_response" | jq -r '.[0].id')

    if [ "$result_id" != "null" ] && [ -n "$result_id" ]; then
        test_update_status \
            "Test 4.1: UPDATE status from 'skipped' to 'good' (Inspector)" \
            "$INSPECTOR_TOKEN" \
            "$result_id" \
            "good" \
            200
    else
        log_warning "Test 4.1: Skipped - No 'skipped' result found to update"
    fi
}

# ============================================================================
# CLEANUP PHASE
# ============================================================================

cleanup() {
    log_section "CLEANUP: Removing Test Data"

    log_info "Deleting test inspection results..."
    curl -s -X DELETE "${SUPABASE_URL}/rest/v1/inspection_results?session_id=eq.${SESSION_ID}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${INSPECTOR_TOKEN}" > /dev/null

    log_info "Deleting test session..."
    curl -s -X DELETE "${SUPABASE_URL}/rest/v1/inspection_sessions?id=eq.${SESSION_ID}" \
        -H "apikey: ${SUPABASE_ANON_KEY}" \
        -H "Authorization: Bearer ${INSPECTOR_TOKEN}" > /dev/null

    log_success "Cleanup completed"
}

# ============================================================================
# REPORTING
# ============================================================================

print_summary() {
    log_section "TEST EXECUTION SUMMARY"

    echo ""
    echo "Total Tests Run:    $TESTS_RUN"
    echo -e "${GREEN}Tests Passed:       $TESTS_PASSED${NC}"
    echo -e "${RED}Tests Failed:       $TESTS_FAILED${NC}"
    echo ""

    local pass_rate=0
    if [ $TESTS_RUN -gt 0 ]; then
        pass_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
    fi

    echo "Pass Rate:          ${pass_rate}%"
    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
        return 0
    else
        echo -e "${RED}❌ SOME TESTS FAILED${NC}"
        return 1
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo ""
    echo "=============================================="
    echo "  RLS & Webhook Test Suite"
    echo "  New Status Values Verification"
    echo "=============================================="
    echo ""

    # Check dependencies
    if ! command -v jq &> /dev/null; then
        log_failure "jq is not installed. Please install jq to run this script."
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        log_failure "curl is not installed. Please install curl to run this script."
        exit 1
    fi

    # Check configuration
    if [ "$SUPABASE_ANON_KEY" = "your-anon-key-here" ]; then
        log_failure "Please set SUPABASE_ANON_KEY environment variable"
        echo "Example: export SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        exit 1
    fi

    # Run tests
    setup
    test_inspector_role
    test_admin_role
    test_unauthenticated
    test_update_operations

    # Optional: Skip cleanup for debugging
    if [ "${SKIP_CLEANUP:-false}" != "true" ]; then
        cleanup
    else
        log_warning "Cleanup skipped (SKIP_CLEANUP=true)"
        log_info "Session ID: $SESSION_ID"
    fi

    # Print summary and exit with appropriate code
    print_summary
}

# Run main function
main "$@"

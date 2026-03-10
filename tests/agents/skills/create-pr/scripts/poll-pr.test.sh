#!/usr/bin/env bash
# Tests for poll-pr.sh
# Shell script tests for PR polling script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="/home/jailuser/git/.agents/skills/create-pr/scripts/poll-pr.sh"

# Test counter
tests_run=0
tests_passed=0

# Test helper functions
assert_equals() {
  local expected="$1"
  local actual="$2"
  local message="${3:-}"

  tests_run=$((tests_run + 1))

  if [[ "$expected" == "$actual" ]]; then
    tests_passed=$((tests_passed + 1))
    echo "✓ PASS: $message"
    return 0
  else
    echo "✗ FAIL: $message"
    echo "  Expected: $expected"
    echo "  Actual:   $actual"
    return 1
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local message="${3:-}"

  tests_run=$((tests_run + 1))

  if [[ "$haystack" == *"$needle"* ]]; then
    tests_passed=$((tests_passed + 1))
    echo "✓ PASS: $message"
    return 0
  else
    echo "✗ FAIL: $message"
    echo "  Expected substring: $needle"
    echo "  In: $haystack"
    return 1
  fi
}

assert_file_exists() {
  local file="$1"
  local message="${2:-File should exist: $file}"

  tests_run=$((tests_run + 1))

  if [[ -f "$file" ]]; then
    tests_passed=$((tests_passed + 1))
    echo "✓ PASS: $message"
    return 0
  else
    echo "✗ FAIL: $message"
    return 1
  fi
}

assert_exit_code() {
  local expected="$1"
  local actual="$2"
  local message="${3:-}"

  tests_run=$((tests_run + 1))

  if [[ "$expected" -eq "$actual" ]]; then
    tests_passed=$((tests_passed + 1))
    echo "✓ PASS: $message"
    return 0
  else
    echo "✗ FAIL: $message"
    echo "  Expected exit code: $expected"
    echo "  Actual exit code:   $actual"
    return 1
  fi
}

# Test suite
echo "Running tests for poll-pr.sh"
echo "================================"

# Test 1: Script exists and is executable
assert_file_exists "$SCRIPT_UNDER_TEST" "Script file exists"

# Test 2: Usage message
usage_output=$(bash "$SCRIPT_UNDER_TEST" --help 2>&1 || true)
assert_contains "$usage_output" "Usage: poll-pr.sh" "Usage message displayed"
assert_contains "$usage_output" "--pr" "Usage mentions --pr flag"
assert_contains "$usage_output" "--interval" "Usage mentions --interval flag"

# Test 3: Help flag returns success
bash "$SCRIPT_UNDER_TEST" --help >/dev/null 2>&1 || exit_code=$?
assert_exit_code 0 "${exit_code:-0}" "Help flag exits with 0"

# Test 4: Unknown argument handling
unknown_arg_output=$(bash "$SCRIPT_UNDER_TEST" --unknown-flag 2>&1 || true)
assert_contains "$unknown_arg_output" "Unknown arg" "Unknown arguments detected"

# Test 5: Check for required environment variables check
# The script checks for gh auth and tokens
script_content=$(cat "$SCRIPT_UNDER_TEST")
assert_contains "$script_content" "gh auth status" "Script checks gh authentication"
assert_contains "$script_content" "GITHUB_TOKEN" "Script mentions GITHUB_TOKEN"
assert_contains "$script_content" "GH_TOKEN" "Script mentions GH_TOKEN"

# Test 6: Polling interval validation
assert_contains "$script_content" '^[0-9]+$' "Validates interval is numeric"
assert_contains "$script_content" '^[0-9]+$' "Validates minutes is numeric"

# Test 7: Default values
assert_contains "$script_content" 'interval="${POLL_INTERVAL:-30}"' "Default interval is 30 seconds"
assert_contains "$script_content" 'minutes="${POLL_MINUTES:-10}"' "Default minutes is 10"

# Test 8: Exit when green flag
assert_contains "$script_content" "--exit-when-green" "Supports --exit-when-green flag"
assert_contains "$script_content" "exit_when_green" "exit_when_green variable exists"

# Test 9: Triage on change flag
assert_contains "$script_content" "--triage-on-change" "Supports --triage-on-change flag"
assert_contains "$script_content" "triage_on_change" "triage_on_change variable exists"

# Test 10: Checks status polling
assert_contains "$script_content" "gh pr checks" "Polls PR checks"
assert_contains "$script_content" "status" "Checks status field"
assert_contains "$script_content" "conclusion" "Checks conclusion field"

# Test 11: Failed checks detection
assert_contains "$script_content" '"SUCCESS"' "Detects failed checks"
assert_contains "$script_content" "Failed checks:" "Reports failed checks"

# Test 12: Comments polling
assert_contains "$script_content" "repos/\$repo/issues/\$pr/comments" "Polls issue comments"
assert_contains "$script_content" "repos/\$repo/pulls/\$pr/comments" "Polls review comments"

# Test 13: Reviews polling
assert_contains "$script_content" "repos/\$repo/pulls/\$pr/reviews" "Polls PR reviews"
assert_contains "$script_content" "submitted_at" "Checks review submission time"

# Test 14: New comment detection
assert_contains "$script_content" "last_issue_comment_id" "Tracks last issue comment ID"
assert_contains "$script_content" "last_review_comment_id" "Tracks last review comment ID"
assert_contains "$script_content" "last_review_id" "Tracks last review ID"

# Test 15: Triage script integration
assert_contains "$script_content" "triage-pr.sh" "Calls triage script"
assert_contains "$script_content" 'triage_on_change' "Calls triage on change"

# Test 16: Repo and PR number detection
assert_contains "$script_content" 'gh pr view' "Detects PR number from current branch"
assert_contains "$script_content" 'gh repo view' "Detects repo from git config"

# Test 17: Iteration control
assert_contains "$script_content" "seq 1" "Iterates for specified duration"
assert_contains "$script_content" "iterations" "Calculates iterations correctly"

# Test 18: Sleep between polls
assert_contains "$script_content" 'sleep' "Sleeps between polls"
assert_contains "$script_content" 'iterations' "Doesn't sleep after last iteration"

# Test 19: Early exit when green
assert_contains "$script_content" "Checks green; exiting early" "Can exit early when checks pass"
assert_contains "$script_content" 'pending' "Detects all checks passed"

# Test 20: JSON parsing
assert_contains "$script_content" "jq" "Uses jq for JSON parsing"
assert_contains "$script_content" "--jq" "Uses --jq flag"

# Test 21: Timestamp logging
assert_contains "$script_content" "date -u" "Logs timestamps"
assert_contains "$script_content" 'Poll' "Shows poll progress"

# Test 22: Check counts display
assert_contains "$script_content" "total=" "Shows total checks count"
assert_contains "$script_content" "pending=" "Shows pending checks count"
assert_contains "$script_content" "failed=" "Shows failed checks count"
assert_contains "$script_content" "success=" "Shows successful checks count"

# Summary
echo ""
echo "================================"
echo "Test Results: $tests_passed/$tests_run passed"

if [[ $tests_passed -eq $tests_run ]]; then
  echo "All tests passed! ✓"
  exit 0
else
  echo "Some tests failed."
  exit 1
fi
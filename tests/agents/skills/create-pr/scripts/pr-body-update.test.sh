#!/usr/bin/env bash
# Tests for pr-body-update.sh
# Shell script tests for PR body update script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="/home/jailuser/git/.agents/skills/create-pr/scripts/pr-body-update.sh"

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
echo "Running tests for pr-body-update.sh"
echo "===================================="

# Test 1: Script exists and is executable
assert_file_exists "$SCRIPT_UNDER_TEST" "Script file exists"

# Test 2: Usage message
usage_output=$(bash "$SCRIPT_UNDER_TEST" --help 2>&1 || true)
assert_contains "$usage_output" "Usage: pr-body-update.sh" "Usage message displayed"
assert_contains "$usage_output" "--file" "Usage mentions --file flag"
assert_contains "$usage_output" "--pr" "Usage mentions --pr flag"
assert_contains "$usage_output" "--repo" "Usage mentions --repo flag"

# Test 3: Help flag returns success
bash "$SCRIPT_UNDER_TEST" --help >/dev/null 2>&1 || exit_code=$?
assert_exit_code 0 "${exit_code:-0}" "Help flag exits with 0"

# Test 4: Missing --file parameter
no_file_output=$(bash "$SCRIPT_UNDER_TEST" 2>&1 || true)
assert_contains "$no_file_output" "--file is required" "Error when --file is missing"

# Test 5: Script content validation
script_content=$(cat "$SCRIPT_UNDER_TEST")

# Test 6: File existence check
assert_contains "$script_content" '[ ! -f "$body_file" ]' "Checks if body file exists"
assert_contains "$script_content" "Body file not found" "Error message for missing file"

# Test 7: Empty file check
assert_contains "$script_content" '[ ! -s "$body_file" ]' "Checks if body file is empty"
assert_contains "$script_content" "Body file is empty" "Error message for empty file"

# Test 8: PR number detection
assert_contains "$script_content" 'gh pr view' "Detects PR number from current branch"
assert_contains "$script_content" "Could not determine PR number" "Error for missing PR number"

# Test 9: Repo detection
assert_contains "$script_content" 'gh repo view' "Detects repo from git config"
assert_contains "$script_content" "Could not determine repo" "Error for missing repo"

# Test 10: PR ID fetching
assert_contains "$script_content" '--json id' "Fetches PR global ID"
assert_contains "$script_content" "Could not determine PR id" "Error for missing PR ID"

# Test 11: GraphQL mutation
assert_contains "$script_content" "gh api graphql" "Uses GraphQL API"
assert_contains "$script_content" "updatePullRequest" "Uses updatePullRequest mutation"
assert_contains "$script_content" "pullRequestId" "Passes pullRequestId parameter"

# Test 12: Reading body file
assert_contains "$script_content" 'cat "$body_file"' "Reads body file content"

# Test 13: Variables
assert_contains "$script_content" 'body_file=""' "Initializes body_file variable"
assert_contains "$script_content" 'pr=""' "Initializes pr variable"
assert_contains "$script_content" 'repo=""' "Initializes repo variable"

# Test 14: Argument parsing
assert_contains "$script_content" 'while' "Parses command line arguments"
assert_contains "$script_content" 'case' "Uses case statement for arg parsing"

# Test 15: Unknown argument handling
assert_contains "$script_content" "Unknown arg" "Handles unknown arguments"

# Test 16: Verification after update
assert_contains "$script_content" '--json body' "Fetches updated body for verification"
assert_contains "$script_content" "Failed to fetch updated PR body" "Error for verification failure"

# Test 17: Body comparison
assert_contains "$script_content" 'updated_body' "Compares updated body with file"
assert_contains "$script_content" "PR body mismatch after update" "Error for body mismatch"

# Test 18: Success message
assert_contains "$script_content" "Updated PR" "Success message on completion"

# Test 19: Uses set -euo pipefail
assert_contains "$script_content" "set -euo pipefail" "Uses strict error handling"

# Test 20: Shebang
first_line=$(head -n 1 "$SCRIPT_UNDER_TEST")
assert_equals "#!/usr/bin/env bash" "$first_line" "Has correct shebang"

# Test 21: Shift arguments
assert_contains "$script_content" "shift 2" "Shifts arguments after parsing flags with values"

# Test 22: Exit codes
assert_contains "$script_content" "exit 0" "Uses exit 0 for success"
assert_contains "$script_content" "exit 1" "Uses exit 1 for errors"

# Test 23: Query parameter construction
assert_contains "$script_content" "-f query=" "Constructs GraphQL query"
assert_contains "$script_content" "-f id=" "Passes ID parameter"
assert_contains "$script_content" "-f body=" "Passes body parameter"

# Test 24: Redirect to null
assert_contains "$script_content" ">/dev/null" "Redirects GraphQL mutation output"

# Summary
echo ""
echo "===================================="
echo "Test Results: $tests_passed/$tests_run passed"

if [[ $tests_passed -eq $tests_run ]]; then
  echo "All tests passed! ✓"
  exit 0
else
  echo "Some tests failed."
  exit 1
fi
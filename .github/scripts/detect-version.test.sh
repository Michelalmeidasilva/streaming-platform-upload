#!/bin/bash

# Test suite for detect-version.sh script
# Source the script under test
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/detect-version.sh"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0
CURRENT_TEST=""

# Helper function to run test
run_test() {
  local test_name="$1"
  local test_func="$2"
  CURRENT_TEST="$test_name"

  echo -n "Testing: $test_name ... "

  if $test_func; then
    echo -e "${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}FAIL${NC}"
    ((TESTS_FAILED++))
  fi
}

# Helper function for assertions
assert_equals() {
  local expected="$1"
  local actual="$2"
  local message="${3:-Values should be equal}"

  if [ "$expected" = "$actual" ]; then
    return 0
  else
    echo -e "\n  ${RED}Assertion failed:${NC} $message"
    echo "  Expected: '$expected'"
    echo "  Actual:   '$actual'"
    return 1
  fi
}

# Helper function to extract version number
increment_version() {
  local version=$1
  local bump=$2

  # Split version into parts
  IFS='.' read -r major minor patch <<< "$version"

  case $bump in
    major)
      ((major++))
      minor=0
      patch=0
      ;;
    minor)
      ((minor++))
      patch=0
      ;;
    patch)
      ((patch++))
      ;;
  esac

  echo "${major}.${minor}.${patch}"
}

# TEST 1: Test major version bump increment
test_major_version_bump() {
  local result=$(increment_version "1.0.0" "major")
  assert_equals "2.0.0" "$result" "Major version bump should increment major and reset minor/patch"
}

# TEST 2: Test minor version bump increment
test_minor_version_bump() {
  local result=$(increment_version "1.0.0" "minor")
  assert_equals "1.1.0" "$result" "Minor version bump should increment minor and reset patch"
}

# TEST 3: Test patch version bump increment
test_patch_version_bump() {
  local result=$(increment_version "1.0.0" "patch")
  assert_equals "1.0.1" "$result" "Patch version bump should increment patch only"
}

# TEST 4: Test major bump with existing minor and patch
test_major_version_bump_complex() {
  local result=$(increment_version "1.5.7" "major")
  assert_equals "2.0.0" "$result" "Major version bump should reset minor and patch even when non-zero"
}

# TEST 5: Test minor bump with existing patch
test_minor_version_bump_complex() {
  local result=$(increment_version "1.5.7" "minor")
  assert_equals "1.6.0" "$result" "Minor version bump should reset patch"
}

# TEST 6: Test patch bump doesn't affect major/minor
test_patch_version_bump_complex() {
  local result=$(increment_version "1.5.7" "patch")
  assert_equals "1.5.8" "$result" "Patch version bump should only increment patch"
}

# TEST 7: Test detection of major (BREAKING CHANGE)
test_detect_major_breaking_change() {
  # We'll create a temporary git repo to test this
  local tmpdir=$(mktemp -d)
  cd "$tmpdir"

  git init > /dev/null 2>&1
  git config user.email "test@example.com"
  git config user.name "Test User"

  # Create initial commit and tag
  echo "test" > file.txt
  git add file.txt
  git commit -m "initial commit" > /dev/null 2>&1
  git tag v1.0.0 > /dev/null 2>&1

  # Create commit with BREAKING CHANGE
  echo "test2" > file.txt
  git add file.txt
  git commit -m "feat: breaking change

BREAKING CHANGE: API endpoint changed" > /dev/null 2>&1

  # Extract commits and detect type
  COMMITS=$(git log v1.0.0..HEAD --format=%B)
  local bump_type="patch"

  if echo "$COMMITS" | grep -q "BREAKING CHANGE:"; then
    bump_type="major"
  fi

  cd - > /dev/null
  rm -rf "$tmpdir"

  assert_equals "major" "$bump_type" "Should detect major bump from BREAKING CHANGE in commit message"
}

# TEST 8: Test detection of minor (feat:)
test_detect_minor_feature() {
  local tmpdir=$(mktemp -d)
  cd "$tmpdir"

  git init > /dev/null 2>&1
  git config user.email "test@example.com"
  git config user.name "Test User"

  # Create initial commit and tag
  echo "test" > file.txt
  git add file.txt
  git commit -m "initial commit" > /dev/null 2>&1
  git tag v1.0.0 > /dev/null 2>&1

  # Create commit with feat:
  echo "test2" > file.txt
  git add file.txt
  git commit -m "feat: new feature" > /dev/null 2>&1

  # Extract commits and detect type
  COMMITS=$(git log v1.0.0..HEAD --format=%B)
  local bump_type="patch"

  if echo "$COMMITS" | grep -q "BREAKING CHANGE:"; then
    bump_type="major"
  elif echo "$COMMITS" | grep -q "^feat:"; then
    bump_type="minor"
  fi

  cd - > /dev/null
  rm -rf "$tmpdir"

  assert_equals "minor" "$bump_type" "Should detect minor bump from 'feat:' commit message"
}

# TEST 9: Test detection of patch (fix:)
test_detect_patch_fix() {
  local tmpdir=$(mktemp -d)
  cd "$tmpdir"

  git init > /dev/null 2>&1
  git config user.email "test@example.com"
  git config user.name "Test User"

  # Create initial commit and tag
  echo "test" > file.txt
  git add file.txt
  git commit -m "initial commit" > /dev/null 2>&1
  git tag v1.0.0 > /dev/null 2>&1

  # Create commit with fix:
  echo "test2" > file.txt
  git add file.txt
  git commit -m "fix: bug fix" > /dev/null 2>&1

  # Extract commits and detect type
  COMMITS=$(git log v1.0.0..HEAD --format=%B)
  local bump_type="patch"

  if echo "$COMMITS" | grep -q "BREAKING CHANGE:"; then
    bump_type="major"
  elif echo "$COMMITS" | grep -q "^feat:"; then
    bump_type="minor"
  elif echo "$COMMITS" | grep -q "^fix:"; then
    bump_type="patch"
  fi

  cd - > /dev/null
  rm -rf "$tmpdir"

  assert_equals "patch" "$bump_type" "Should detect patch bump from 'fix:' commit message"
}

# TEST 10: Test that BREAKING CHANGE takes precedence over feat:
test_breaking_change_precedence() {
  local tmpdir=$(mktemp -d)
  cd "$tmpdir"

  git init > /dev/null 2>&1
  git config user.email "test@example.com"
  git config user.name "Test User"

  # Create initial commit and tag
  echo "test" > file.txt
  git add file.txt
  git commit -m "initial commit" > /dev/null 2>&1
  git tag v1.0.0 > /dev/null 2>&1

  # Create feat with BREAKING CHANGE
  echo "test2" > file.txt
  git add file.txt
  git commit -m "feat: new feature

BREAKING CHANGE: API changed" > /dev/null 2>&1

  # Extract commits and detect type
  COMMITS=$(git log v1.0.0..HEAD --format=%B)
  local bump_type="patch"

  if echo "$COMMITS" | grep -q "BREAKING CHANGE:"; then
    bump_type="major"
  elif echo "$COMMITS" | grep -q "^feat:"; then
    bump_type="minor"
  fi

  cd - > /dev/null
  rm -rf "$tmpdir"

  assert_equals "major" "$bump_type" "BREAKING CHANGE should take precedence over feat:"
}

# Run all tests
echo -e "\n${YELLOW}Running Version Detection Script Tests${NC}\n"

run_test "Major version bump increment" test_major_version_bump
run_test "Minor version bump increment" test_minor_version_bump
run_test "Patch version bump increment" test_patch_version_bump
run_test "Major version bump with complex version" test_major_version_bump_complex
run_test "Minor version bump with complex version" test_minor_version_bump_complex
run_test "Patch version bump with complex version" test_patch_version_bump_complex
run_test "Detect major from BREAKING CHANGE" test_detect_major_breaking_change
run_test "Detect minor from feat:" test_detect_minor_feature
run_test "Detect patch from fix:" test_detect_patch_fix
run_test "BREAKING CHANGE takes precedence" test_breaking_change_precedence

# Print summary
echo -e "\n${YELLOW}Test Summary${NC}"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}\n"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}\n"
  exit 1
fi

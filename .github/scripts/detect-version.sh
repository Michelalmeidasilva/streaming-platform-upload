#!/bin/bash

# Version Detection Script for Release Automation
# Detects the version bump type from conventional commits since the last tag
# Outputs version information as GitHub Actions outputs

# Get the last tag (if none exists, use v0.0.0)
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")

# Get current version from package.json
CURRENT_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

# Get commits since last tag
COMMITS=$(git log $LAST_TAG..HEAD --format=%B 2>/dev/null || git log --format=%B)

# Detect bump type based on conventional commits
BUMP_TYPE="patch"  # default

if echo "$COMMITS" | grep -q "BREAKING CHANGE:"; then
  BUMP_TYPE="major"
elif echo "$COMMITS" | grep -q "^feat:"; then
  BUMP_TYPE="minor"
elif echo "$COMMITS" | grep -q "^fix:"; then
  BUMP_TYPE="patch"
fi

# Function to increment version
increment_version() {
  local version=$1
  local bump=$2
  local IFS='.'

  # Strip pre-release and build metadata
  version="${version%%[-+]*}"

  # Split version into parts
  read -r major minor patch <<< "$version"

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
    *)
      echo "Error: invalid bump type '$bump'" >&2
      return 1
      ;;
  esac

  echo "${major}.${minor}.${patch}"
  return 0
}

# Calculate next version
NEXT_VERSION=$(increment_version "$CURRENT_VERSION" "$BUMP_TYPE") || {
  echo "Error: Failed to calculate next version from $CURRENT_VERSION with bump type $BUMP_TYPE" >&2
  exit 1
}

# Output as JSON for GitHub Actions
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "bump_type=$BUMP_TYPE" >> "${GITHUB_OUTPUT}"
  echo "current_version=$CURRENT_VERSION" >> "${GITHUB_OUTPUT}"
  echo "next_version=$NEXT_VERSION" >> "${GITHUB_OUTPUT}"
  echo "last_tag=$LAST_TAG" >> "${GITHUB_OUTPUT}"
fi

# Also output to stdout for manual execution/testing
echo "bump_type=$BUMP_TYPE"
echo "current_version=$CURRENT_VERSION"
echo "next_version=$NEXT_VERSION"
echo "last_tag=$LAST_TAG"

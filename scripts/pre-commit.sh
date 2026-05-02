#!/bin/bash

# Pre-commit hook for streaming-platform-upload
# Runs tests, linting, and type-checking before allowing commits
# Install with: ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔍 Running pre-commit checks..."
echo ""

# Run Jest unit tests
echo "🧪 Running unit tests..."
cd "$PROJECT_ROOT"
if ! npm test -- --forceExit 2>&1; then
    echo "❌ Tests failed. Commit aborted."
    exit 1
fi
echo "✅ Unit tests passed"
echo ""

# Run ESLint
echo "🔍 Running ESLint..."
if ! npm run lint 2>&1; then
    echo "❌ ESLint found issues. Commit aborted."
    exit 1
fi
echo "✅ ESLint passed (0 issues)"
echo ""

# Run TypeScript type-checking
echo "✔️  Running TypeScript type-checking..."
if ! npx tsc --noEmit 2>&1; then
    echo "❌ TypeScript check failed. Commit aborted."
    exit 1
fi
echo "✅ TypeScript check passed"
echo ""

echo "✅ All pre-commit checks passed!"
exit 0

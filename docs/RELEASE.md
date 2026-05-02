# Release Process

## Overview

This project uses **automated semantic versioning** with GitHub Actions. Every push to `main` triggers version detection based on Conventional Commits, automatic changelog generation, and GitHub Release creation.

## How Releases Work

### Automated Release Flow

1. **Push to main** triggers the `.github/workflows/release.yml` workflow
2. **Version detection** scans commits since the last tag for Conventional Commits prefixes
3. **Version bump** is calculated:
   - `BREAKING CHANGE:` footer → Major version bump (1.0.0 → 2.0.0)
   - `feat:` prefix → Minor version bump (1.0.0 → 1.1.0)
   - `fix:` prefix → Patch version bump (1.0.0 → 1.0.1)
4. **package.json** is updated with the new version
5. **CHANGELOG.md** is updated with commit messages since the last release
6. **Git tag** is created (e.g., `v1.0.3`)
7. **GitHub Release** is created with auto-generated release notes

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/) to trigger automatic versioning:

```
feat: add multipart upload support
fix: resolve timeout on large files
docs: update upload API documentation
chore: update dependencies
refactor: simplify upload logic
test: add integration tests
```

#### Breaking Changes

For breaking changes, add a `BREAKING CHANGE:` footer in the commit body:

```
feat: redesign upload API

The /upload/initiate endpoint now requires authentication tokens.
Old endpoint /api/v1/upload/legacy is deprecated.

BREAKING CHANGE: /api/v1/upload/legacy removed in favor of /upload/initiate
```

#### Examples

- `fix: enable variable expansion in changelog generation` → Patch bump (1.0.1 → 1.0.2)
- `feat: add thumbnail generation` → Minor bump (1.0.2 → 1.1.0)
- `feat: redesign storage adapter interface\n\nBREAKING CHANGE: old adapter interface removed` → Major bump (1.1.0 → 2.0.0)

### No Changes?

If a push to `main` contains **no feat, fix, or BREAKING CHANGE** commits (e.g., only docs or chore commits), the release workflow **does not trigger a version bump**. The workflow still runs but exits without creating a release.

## Viewing Releases

### GitHub Releases Page

View all releases with their auto-generated notes:

```
https://github.com/[org]/streaming-platform-upload/releases
```

### Git Tags

List all version tags locally:

```bash
git tag -l
git tag -l | sort -V  # Sort numerically
```

View a specific tag:

```bash
git show v1.0.2
```

### Changelog

The `CHANGELOG.md` file at the project root contains all release notes in reverse chronological order (newest first).

## Manual Release (Advanced)

If you need to create a release manually (not recommended):

```bash
# Create a tag and push it
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3

# The release workflow will automatically detect the new tag
# and create a GitHub Release (if it hasn't run yet)
```

## Rollback

If a release has issues and needs to be rolled back:

### Option 1: Revert the Release Commit

```bash
# Find the release commit (typically "chore: release vX.Y.Z")
git log --oneline | grep "chore: release"

# Revert it
git revert <commit-hash>
git push origin main
```

This will:
- Restore `package.json` to the previous version
- Restore `CHANGELOG.md` to its previous state
- The release tag will still exist but future releases will supersede it

### Option 2: Delete the Tag and Release (if release was created moments ago)

```bash
# Delete locally
git tag -d v1.2.3

# Delete on GitHub
git push origin --delete v1.2.3

# Delete the GitHub Release manually from the releases page
# Then fix the code and push to main again
```

After the fix is merged to `main`, a new release will be created automatically.

## How Version Detection Works

The version detection script (`.github/scripts/detect-version.sh`) performs these steps:

1. Retrieves the last git tag (or `v0.0.0` if none exist)
2. Reads the current version from `package.json`
3. Scans all commits since the last tag using `git log $LAST_TAG..HEAD`
4. Detects the highest-priority change type:
   - `BREAKING CHANGE:` in commit body → major
   - `feat:` prefix in commit message → minor
   - `fix:` prefix in commit message → patch
5. Increments the version accordingly
6. Outputs version info for the GitHub Actions workflow

## Workflow Files

### Release Workflow

**File**: `.github/workflows/release.yml`

- Triggers on: Every push to `main`
- Runs version detection
- Updates `package.json` and `CHANGELOG.md`
- Creates git tag and GitHub Release
- Permissions: `contents: write` (to create releases and push tags)

### Version Detection Script

**File**: `.github/scripts/detect-version.sh`

- Scans commits for Conventional Commits prefixes
- Calculates semantic version bump
- Outputs version info to GitHub Actions environment
- Can be run locally for testing (outputs to stdout)

### Example Output (Local Testing)

```bash
$ bash .github/scripts/detect-version.sh
bump_type=minor
current_version=1.0.2
next_version=1.1.0
last_tag=v1.0.2
```

## Best Practices

1. **Use Conventional Commits** for every commit to `main`
   - Enables automatic versioning
   - Makes release notes meaningful
   - Helps developers understand what changed

2. **Keep commits atomic**
   - One feature/fix per commit
   - Makes history easier to read
   - Simplifies reverts if needed

3. **Test before pushing to main**
   - Ensure CI passes (`npm test`, `npm lint`)
   - Test locally in the environment matching production
   - Don't push broken commits to main

4. **Review the auto-generated CHANGELOG.md**
   - Check the GitHub Actions log after a release
   - Ensure version bump was correct
   - Verify release notes are meaningful

5. **Tag your releases for milestones**
   - Keep important versions as git references
   - Tags are immutable; helpful for debugging

## FAQ

### Q: How do I skip a release?

**A**: Merge commits without `feat:`, `fix:`, or `BREAKING CHANGE:`. The workflow runs but doesn't create a release. Examples:
- `docs: update README`
- `chore: clean up comments`
- `style: fix formatting`

### Q: Can I manually set the version?

**A**: Not recommended. The automated system ensures consistency. If you must, edit `package.json` manually, commit it, and push. On the next push with a `feat:` or `fix:` commit, the system will auto-bump from whatever version is in `package.json`.

### Q: What if the version detection fails?

**A**: The workflow has validation steps. If version detection returns empty, the workflow stops with an error message visible in the GitHub Actions log. Check recent commits for proper Conventional Commits format.

### Q: Can I backport a fix to an older version?

**A**: Not with this system. The automated releases only target `main`. For patch releases on older versions, you would need:
1. A separate `release/X.Y.Z` branch
2. Manual version bumping
3. Manual tag creation

This is an advanced scenario not covered by the current automation.

### Q: How do I create a pre-release (alpha, beta, rc)?

**A**: Not supported by the current automation. All releases are production releases. To create a pre-release:
1. Manually tag it: `git tag -a v1.0.0-rc.1 -m "Release v1.0.0-rc.1"`
2. Push the tag: `git push origin v1.0.0-rc.1`
3. Create the GitHub Release manually from the releases page

## Troubleshooting

### Release workflow fails with "No changes detected"

**Cause**: No commits on main since the last release contained `feat:`, `fix:`, or `BREAKING CHANGE:`.

**Solution**: This is expected behavior. The workflow doesn't create a release if there are no version-bumping commits. Push a `feat:` or `fix:` commit if you want a release.

### Version bump is wrong

**Cause**: Commit message doesn't follow Conventional Commits format, or `BREAKING CHANGE:` is in the wrong place.

**Solution**: 
- Commit messages must start with `feat:`, `fix:`, etc. (not just contain it)
- `BREAKING CHANGE:` must be in the commit body (footer), not the subject line
- Example: `git log <last-tag>..HEAD` to inspect messages

### CHANGELOG.md looks wrong

**Cause**: Release notes are generated from raw commit messages. Complex commits or multi-line messages may look odd.

**Solution**: The automation is simple by design. For complex changelogs, manually edit `CHANGELOG.md` after a release. Future releases will prepend new entries above your manual edits.

### Tag already exists error

**Cause**: A tag was created but the workflow failed before pushing.

**Solution**:
```bash
git tag -d v1.2.3          # Delete locally
git push origin --delete v1.2.3  # Delete on GitHub
# Fix the issue and try again
```

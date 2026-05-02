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
4. **package.json and package-lock.json** are updated with the new version
5. **CHANGELOG.md** is updated with commit messages from `git log` since the last release
6. **Git tag** is created (e.g., `v1.0.3`)
7. **GitHub Release** is created with release notes containing commit history

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

### Default Patch Bumps

Every push to `main` creates a release. The workflow defaults to a **patch version bump** for commits that don't include `feat:` or `BREAKING CHANGE:` prefixes:

- `BREAKING CHANGE:` footer → Major version bump (1.0.0 → 2.0.0)
- `feat:` prefix → Minor version bump (1.0.0 → 1.1.0)
- All other commits (`fix:`, `docs:`, `chore:`, `style:`, etc.) → Patch version bump (1.0.0 → 1.0.1)

This means documentation-only or chore-only pushes will trigger a patch release. If you want to avoid automatic releases for documentation changes, use feature branches and only merge to `main` when code is ready for release.

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

#### How CHANGELOG.md is Generated

The automated release workflow generates `CHANGELOG.md` entries from commit messages since the last tag:
- Uses `git log` to extract commits since the last tag (format: `--oneline` showing commit hash and message)
- The exact format may vary, but the result is a list of commits extracted from the repository history
- These entries are prepended to the top of `CHANGELOG.md` with a version header and date

#### Manual Changelog Organization

The organized `CHANGELOG.md` file (with Added/Changed/Fixed/Removed sections visible in the file) is **manually maintained by developers** as part of the Feature Development Checklist. This happens separately from the automated release workflow:
- Developers create `CHANGELOG.md` entries during feature development
- The automated workflow generates release notes from raw git commits
- When a release is created, the workflow prepends the git-derived entries to the manually-organized sections
- Future releases will continue to add entries above your manual edits

**Note on changelog structure**: The workflow skips the first 8 lines when appending old changelog content (using `tail -n +9`). This preserves existing changelog structure and avoids duplicating headers during the merge of new and old entries.

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

The version detection script (`.github/scripts/detect-version.sh`) scans commits to calculate semantic versioning:

1. Retrieves the last git tag (or `v0.0.0` if none exist)
2. Reads the current version from `package.json`
3. Scans all commits since the last tag using `git log $LAST_TAG..HEAD`
4. Detects the highest-priority change type:
   - `BREAKING CHANGE:` in commit body → major bump
   - `feat:` prefix in commit message → minor bump
   - `fix:` prefix in commit message → patch bump
5. Increments the version accordingly
6. Outputs version info (bump type, next version, last tag) for the GitHub Actions workflow

The workflow then uses these outputs to update `package.json`, generate changelog entries from `git log`, create a git tag, and publish a GitHub Release.

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

4. **Follow the Feature Development Checklist**
   - Manually maintain organized CHANGELOG.md entries with Added/Changed/Fixed sections (see editor.md)
   - These manual entries are distinct from the automated commit-based entries prepended by the release workflow
   - The automated workflow adds raw git commit messages at the top; your manual entries remain organized below

5. **Tag your releases for milestones**
   - Keep important versions as git references
   - Tags are immutable; helpful for debugging

## Release Strategy

This project uses **automatic releases on every push to main**. Understanding this strategy helps you decide when to commit directly to main vs. use feature branches:

### Every Push Creates a Release

- **Every commit to main** → one release (minimum patch bump)
- **Documentation changes** → patch release (e.g., 1.0.0 → 1.0.1)
- **Feature additions** → minor release (e.g., 1.0.0 → 1.1.0)
- **Breaking changes** → major release (e.g., 1.0.0 → 2.0.0)

### When to Use Feature Branches

If you want to avoid patch releases for certain types of changes:

1. **Documentation-only updates**: Commit to a feature branch, don't push directly to main
2. **Chore-only changes**: Use a feature branch if you don't want a release for minor housekeeping
3. **Multiple related changes**: Group them in a feature branch, then merge with a single meaningful `feat:` or `fix:` commit to main

### When to Commit Directly to Main

- **Code changes ready for production**: Every commit to main is a deployable release
- **Bug fixes**: Patch releases (ideal for hotfixes)
- **New features**: Minor releases (clear version bump for feature tracking)
- **Breaking changes**: Major releases (clear signal to users to review migration guide)

### Release Version Examples

Given the current version is `1.0.2`:

| Commit Type | Message | Result | Reason |
|---|---|---|---|
| `feat:` | `feat: add multipart resumption` | 1.0.2 → 1.1.0 | Minor bump (new feature) |
| `fix:` | `fix: handle network timeout` | 1.0.2 → 1.0.3 | Patch bump (bug fix) |
| `BREAKING CHANGE:` | `feat: redesign API\n\nBREAKING CHANGE: old endpoint removed` | 1.0.2 → 2.0.0 | Major bump (breaking change) |
| `docs:` | `docs: update API guide` | 1.0.2 → 1.0.3 | Patch bump (documentation) |
| `chore:` | `chore: update deps` | 1.0.2 → 1.0.3 | Patch bump (maintenance) |

This ensures releases are always tied to a version bump and remain meaningful for tracking changes.

## FAQ

### Q: How do I skip a release?

**A**: Every push to `main` creates a release—there is no way to skip releases when committing directly to `main`. However, commits without `feat:` or `BREAKING CHANGE:` triggers a **patch release** (e.g., 1.0.0 → 1.0.1) for documentation and chore changes.

If you want to avoid patch releases for documentation-only changes, commit to a **feature branch instead of main**, and only merge to main when you have actual code changes to release. Examples of commits that trigger patch releases:
- `docs: update README` → Patch release
- `chore: clean up comments` → Patch release
- `style: fix formatting` → Patch release

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

**A**: Pre-releases are not supported by the current automation. All automated releases are production releases (prerelease is hardcoded in `.github/workflows/release.yml`).

To create a pre-release without modifying the workflow:
1. Manually tag it: `git tag -a v1.0.0-rc.1 -m "Release v1.0.0-rc.1"`
2. Push the tag: `git push origin v1.0.0-rc.1`
3. Create the GitHub Release manually from the releases page and mark it as a pre-release

To enable pre-releases in the automated workflow, modify `.github/workflows/release.yml` line 116:

```yaml
# Change this line in .github/workflows/release.yml (line 116):
prerelease: false  # Change to: prerelease: true
```

This will mark all future automated releases as pre-releases. Alternatively, add logic to detect `-rc`, `-beta`, or `-alpha` suffixes in the version string and conditionally set `prerelease: true`.

## Troubleshooting

### Release workflow fails with "No changes detected"

**Cause**: No new commits on main since the last release (or the branch is out of sync with the last tag).

**Solution**: This typically means the workflow ran for an empty changeset. Push new commits (any commit type) to main to trigger a new release. Note: Even `docs:` or `chore:` commits will create a patch release, so ensure you want a release before pushing to main.

### Version bump is wrong

**Cause**: Commit message doesn't follow Conventional Commits format, or `BREAKING CHANGE:` is in the wrong place.

**Solution**:
- Commit messages must start with `feat:`, `fix:`, etc. (not just contain it)
- `BREAKING CHANGE:` must be in the commit body (footer), not the subject line
- Example: `git log <last-tag>..HEAD` to inspect messages

### CHANGELOG.md looks wrong

**Cause**: The automated release workflow generates entries from raw commit messages via `git log`. If commits don't have well-structured messages or detailed descriptions, the generated entries will appear sparse.

**Solution**: The automation is simple by design — it extracts commit history, nothing more. The organized sections (Added/Changed/Fixed) in `CHANGELOG.md` are maintained manually during development (see Feature Development Checklist in editor.md). If you need more polished release notes:
1. Ensure commit messages follow Conventional Commits format and include context
2. Manually edit the generated entries in `CHANGELOG.md` after a release to add context
3. Future releases will prepend new entries above your manual edits

### Tag already exists error

**Cause**: A tag was created but the workflow failed before pushing.

**Solution**:
```bash
git tag -d v1.2.3          # Delete locally
git push origin --delete v1.2.3  # Delete on GitHub
# Fix the issue and try again
```

### Workflow failed with error

If the "Automated Release" workflow fails in GitHub Actions:

1. Click the failed workflow run in the **Actions** tab of your GitHub repository
2. Check which step failed (usually "Detect version bump", "Generate Changelog", or "Update package.json version")
3. Review the error message — common issues and fixes:
   - **`Failed to detect next version`**: Check that `package.json` has a valid `"version"` field in the correct format (e.g., `"1.0.2"`)
   - **`No changes to commit`**: The workflow detected no changes to `package.json` or `CHANGELOG.md`. Ensure your commit was properly formatted with Conventional Commits prefix
   - **`Tag already exists`**: The version was already released; check recent tags with `git tag -l | sort -V` and verify the last tag matches the detected version
   - **`Failed to generate changelog`**: The `git log` command failed, possibly due to missing tags or commit history issues
4. Fix the issue locally (update `package.json`, check commit format, clean up duplicate tags)
5. Push again to `main` to trigger a new workflow run

For debugging, you can run the version detection script locally:
```bash
bash .github/scripts/detect-version.sh
```
This outputs version detection results to stdout without modifying files.

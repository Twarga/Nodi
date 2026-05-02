# Branch Protection Rules

The `main` branch is protected. All changes must go through a Pull Request.

## Required Settings

Enable these rules in **GitHub → Settings → Branches → Add rule**:

| Setting | Value | Reason |
|---------|-------|--------|
| Branch name pattern | `main` | Protect the default branch |
| Require a pull request before merging | ✅ | Enforce code review |
| Require approvals | `1` | At least one review required |
| Dismiss stale PR approvals | ✅ | Re-review after new pushes |
| Require status checks to pass | ✅ | Block merge on CI failure |
| Required checks | `test` (from Go CI) | Ensure tests pass |
| Require branches to be up to date | ✅ | Prevent merge conflicts |
| Include administrators | ✅ | Rules apply to everyone |

## Why This Matters

- **PR reviews** catch bugs and share knowledge
- **CI checks** prevent broken code from reaching production
- **Up-to-date branches** reduce merge conflicts and ensure the latest tests run

## Bypassing (Emergencies Only)

Repository admins can bypass these rules. Use sparingly — only for critical security fixes or outage recovery. Always open a follow-up PR to document the bypass.
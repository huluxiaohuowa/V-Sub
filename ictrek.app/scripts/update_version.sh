#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
version_file="$root/ictrek.app/VERSION"
part="${1:-patch}"
current="$(tr -d '[:space:]' < "$version_file")"
[[ "$current" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "invalid VERSION: $current" >&2; exit 1; }
IFS=. read -r major minor patch <<< "$current"
case "$part" in
  patch) patch=$((patch + 1)) ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  major) major=$((major + 1)); minor=0; patch=0 ;;
  *) echo "Usage: $0 [patch|minor|major]" >&2; exit 1 ;;
esac
version="${major}.${minor}.${patch}"
trigger="vos-v-sub-v${version}"
public_tag="v${version}"
cd "$root"
[[ -n "$(git branch --show-current)" ]] || { echo "release requires a branch" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "worktree is not clean" >&2; exit 1; }
git ls-remote --exit-code --tags origin "refs/tags/${trigger}" >/dev/null 2>&1 && { echo "tag exists: $trigger" >&2; exit 1; }
git ls-remote --exit-code --tags origin "refs/tags/${public_tag}" >/dev/null 2>&1 && { echo "tag exists: $public_tag" >&2; exit 1; }
printf '%s\n' "$version" > "$version_file"
git add ictrek.app/VERSION
git commit -m "chore: release VOS v-sub ${version}"
git tag "$trigger"
git push origin "$(git branch --show-current)"
git push origin "$trigger"
echo "Pushed ${trigger}"

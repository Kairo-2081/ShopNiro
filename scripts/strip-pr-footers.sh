#!/usr/bin/env bash
# Removes the "Generated with Claude Code" footer and the claude.ai session link from the bodies of
# existing pull requests. Dry run by default; pass --apply to write. Needs `gh` signed in as the repo
# owner, run from your own machine (a proxy that re-adds the footer on edits defeats it elsewhere).
set -euo pipefail
repo="${REPO:-Kairo-2081/ShopNiro}"
apply=0; [ "${1:-}" = "--apply" ] && apply=1
for n in $(gh api --paginate "repos/$repo/pulls?state=all&per_page=100" --jq '.[].number'); do
  body=$(gh api "repos/$repo/pulls/$n" --jq '.body // ""')
  clean=$(printf '%s\n' "$body" | grep -viE 'generated with.*claude|^https://claude\.ai/code/session_' | cat -s)
  [ "$clean" = "$body" ] && continue
  echo "PR #$n has a footer"
  if [ "$apply" = 1 ]; then
    gh api -X PATCH "repos/$repo/pulls/$n" -f body="$clean" >/dev/null && echo "  cleaned"
  fi
done

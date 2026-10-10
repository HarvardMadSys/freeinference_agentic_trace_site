#!/usr/bin/env bash
# Publish site/, with its generated data, as the only commit of a branch on a remote.
#
#   ./deploy.sh <remote> <branch>      (make deploy runs it with origin gh-pages)
#
# Needs git 2.42 or later, for `git worktree add --orphan`.
#
# The site is copied into a temporary worktree of a new orphan branch, committed
# once and force-pushed, so the remote branch never keeps earlier copies of the
# data. The worktree and the orphan branch are removed afterwards, also on failure.
# Paths, including a relative remote, are read from the repository's root.
set -euo pipefail

remote=$1
branch=$2
staging_branch="deploy-staging"  # the local orphan branch that exists only while a deploy runs
oldest_minor_version=42          # git 2.42 added `worktree add --orphan`

cd "$(dirname "${BASH_SOURCE[0]}")"

git_version=$(git --version | cut -d " " -f 3)
git_major=$(echo "$git_version" | cut -d . -f 1)
git_minor=$(echo "$git_version" | cut -d . -f 2)
if [ "$git_major" -lt 2 ] || { [ "$git_major" -eq 2 ] && [ "$git_minor" -lt "$oldest_minor_version" ]; }; then
    echo "make deploy needs git 2.$oldest_minor_version or later; this is git $git_version" >&2
    exit 1
fi

if [ ! -f site/data/weeks.json ]; then
    echo "run make data first" >&2
    exit 1
fi

# A branch of this name is left by an interrupted deploy or is someone's own; never touch it.
if git show-ref --verify --quiet "refs/heads/$staging_branch"; then
    echo "a branch named $staging_branch already exists: delete it (git branch -D $staging_branch)" \
         "or, if a deploy was interrupted, run git worktree prune first" >&2
    exit 1
fi

source_commit=$(git rev-parse --short HEAD)
worktree=$(mktemp -d)
created_branch=false

remove_worktree_and_branch() {
    rm -rf "$worktree"
    git worktree prune
    if [ "$created_branch" = true ]; then
        git branch --delete --force --quiet "$staging_branch"
    fi
}
trap remove_worktree_and_branch EXIT

git worktree add --quiet --orphan -b "$staging_branch" "$worktree"
created_branch=true

# -L copies the files site/data links to, not the link itself.
cp -R -L site/. "$worktree/"
# GitHub Pages would otherwise run Jekyll, which hides files and folders starting with _ or .
touch "$worktree/.nojekyll"

# --force: this machine's ignore rules are for the source tree, not for the published copy.
git -C "$worktree" add --all --force
git -C "$worktree" commit --quiet --message "Deploy the site from $source_commit"
git push --force "$remote" "$staging_branch:$branch"

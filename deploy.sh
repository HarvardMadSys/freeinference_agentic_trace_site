#!/usr/bin/env bash
# Publish site/, with its generated data, as the only commit of a branch on a remote.
#
#   ./deploy.sh <remote> <branch>      (make deploy runs it with origin gh-pages)
#
# The site is copied into a temporary worktree of a new orphan branch, committed
# once and force-pushed, so the remote branch never keeps earlier copies of the
# data. The worktree and the orphan branch are removed afterwards, also on failure.
set -euo pipefail

remote=$1
branch=$2
staging_branch="deploy-staging"  # the local orphan branch that exists only while a deploy runs

if [ ! -f site/data/weeks.json ]; then
    echo "run make data first" >&2
    exit 1
fi

source_commit=$(git rev-parse --short HEAD)
worktree=$(mktemp -d)

remove_worktree_and_branch() {
    rm -rf "$worktree"
    git worktree prune
    if git show-ref --verify --quiet "refs/heads/$staging_branch"; then
        git branch --delete --force --quiet "$staging_branch"
    fi
}
trap remove_worktree_and_branch EXIT

git worktree add --quiet --orphan -b "$staging_branch" "$worktree"

# -L copies the files site/data links to, not the link itself.
cp -R -L site/. "$worktree/"
# GitHub Pages would otherwise run Jekyll, which hides files and folders starting with _ or .
touch "$worktree/.nojekyll"

# --force: this machine's ignore rules are for the source tree, not for the published copy.
git -C "$worktree" add --all --force
git -C "$worktree" commit --quiet --message "Deploy the site from $source_commit"
git -C "$worktree" push --force "$remote" "$staging_branch:$branch"

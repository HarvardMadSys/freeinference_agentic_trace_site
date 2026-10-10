"""make deploy, run against a local bare repository: the hosting branch holds one commit with the site's files, and nothing is left behind."""

import os
import pathlib
import shutil
import subprocess

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
HOSTING_BRANCH = "gh-pages"


def git(repository: pathlib.Path, *arguments: str) -> str:
    """The standard output of a git command run in `repository`."""
    result = subprocess.run(["git", *arguments], cwd=repository, capture_output=True, text=True, check=True)
    return result.stdout


def write_fake_site(site: pathlib.Path, data_home: pathlib.Path) -> None:
    """A small site folder whose `data` is a link to another folder, as `site/data` is on a maintainer's machine."""
    (site / "js").mkdir(parents=True)
    (site / "index.html").write_text("<!doctype html><title>Explore</title>\n")
    (site / "js" / "page.js").write_text("export const page = 'explore';\n")
    data_home.mkdir()
    (data_home / "weeks.json").write_text('[{"week": "2026-05-31"}]\n')
    (site / "data").symlink_to(data_home)


@pytest.fixture
def repository(tmp_path: pathlib.Path) -> pathlib.Path:
    """A new repository holding this repository's Makefile and deploy.sh, and a fake site, with one commit."""
    repository = tmp_path / "repository"
    repository.mkdir()
    git(repository, "init", "--quiet", "--initial-branch=main")
    git(repository, "config", "user.name", "Test")
    git(repository, "config", "user.email", "test@example.com")
    shutil.copy2(ROOT / "Makefile", repository / "Makefile")
    shutil.copy2(ROOT / "deploy.sh", repository / "deploy.sh")
    write_fake_site(repository / "site", tmp_path / "data_home")
    git(repository, "add", "Makefile", "deploy.sh", "site/index.html", "site/js")
    git(repository, "commit", "--quiet", "--message", "A site")
    return repository


@pytest.fixture
def remote(tmp_path: pathlib.Path) -> pathlib.Path:
    """An empty bare repository standing in for the host."""
    remote = tmp_path / "remote.git"
    subprocess.run(["git", "init", "--quiet", "--bare", str(remote)], check=True)
    return remote


def deploy(repository: pathlib.Path, remote: pathlib.Path, temporary: pathlib.Path) -> subprocess.CompletedProcess:
    """Run `make deploy` in `repository` towards `remote`, with temporary folders made under `temporary`."""
    temporary.mkdir(exist_ok=True)
    environment = {**os.environ, "TMPDIR": str(temporary)}
    command = ["make", "--no-print-directory", "-C", str(repository), "deploy",
               f"DEPLOY_REMOTE={remote}", f"DEPLOY_BRANCH={HOSTING_BRANCH}"]
    return subprocess.run(command, env=environment, capture_output=True, text=True)


def test_each_deploy_leaves_one_commit_on_the_hosting_branch(repository, remote, tmp_path) -> None:
    for _ in range(2):
        result = deploy(repository, remote, tmp_path / "temporary")
        assert result.returncode == 0, result.stderr
        assert git(remote, "rev-list", "--count", HOSTING_BRANCH).strip() == "1"


def test_the_commit_names_the_source_commit(repository, remote, tmp_path) -> None:
    assert deploy(repository, remote, tmp_path / "temporary").returncode == 0
    source_commit = git(repository, "rev-parse", "--short", "HEAD").strip()
    assert source_commit in git(remote, "log", "-1", "--format=%s", HOSTING_BRANCH)


def test_the_hosting_branch_holds_the_site_and_its_data_as_files(repository, remote, tmp_path) -> None:
    assert deploy(repository, remote, tmp_path / "temporary").returncode == 0
    # Each line is "<mode> <type> <object>\t<path>"; mode 100644 is a regular file, 120000 a link.
    modes = {}
    for line in git(remote, "ls-tree", "-r", HOSTING_BRANCH).splitlines():
        description, path = line.split("\t")
        modes[path] = description.split()[0]
    assert modes == {"index.html": "100644", "js/page.js": "100644", ".nojekyll": "100644",
                     "data/weeks.json": "100644"}


def test_a_deploy_leaves_no_worktree_branch_or_folder_behind(repository, remote, tmp_path) -> None:
    for _ in range(2):
        deploy(repository, remote, tmp_path / "temporary")
    assert len(git(repository, "worktree", "list").splitlines()) == 1
    assert git(repository, "branch", "--format=%(refname:short)").split() == ["main"]
    assert list((tmp_path / "temporary").iterdir()) == []


def test_a_failed_push_still_removes_the_worktree_and_branch(repository, tmp_path) -> None:
    result = deploy(repository, tmp_path / "no_such_remote.git", tmp_path / "temporary")
    assert result.returncode != 0
    assert len(git(repository, "worktree", "list").splitlines()) == 1
    assert git(repository, "branch", "--format=%(refname:short)").split() == ["main"]
    assert list((tmp_path / "temporary").iterdir()) == []


def test_without_data_the_script_refuses_and_says_what_to_run(repository, remote) -> None:
    (repository / "site" / "data").unlink()
    result = subprocess.run(["./deploy.sh", str(remote), HOSTING_BRANCH], cwd=repository,
                            capture_output=True, text=True)
    assert result.returncode == 1
    assert "run make data first" in result.stderr
    assert git(remote, "branch") == ""


def test_without_data_make_deploy_fails_with_the_same_message(repository, remote, tmp_path) -> None:
    (repository / "site" / "data").unlink()
    result = deploy(repository, remote, tmp_path / "temporary")
    assert result.returncode != 0  # make reports a failed recipe as 2
    assert "run make data first" in result.stderr

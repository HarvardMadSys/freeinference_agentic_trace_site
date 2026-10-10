PYTHON = .venv/bin/python

# The pipeline repository, a sibling folder: the package the data step imports,
# and the release and simulation it built. Override to build from a downloaded
# copy of the dataset:  make data RELEASE=~/freeinference_agentic_trace/release
PIPELINE ?= ../freeinference-agentic-pipeline
RELEASE ?= $(PIPELINE)/data/v1/release
SIMULATION ?= $(PIPELINE)/data/v1/simulation

# Where make deploy publishes the site: a remote of this repository and a branch on it.
DEPLOY_REMOTE ?= origin
DEPLOY_BRANCH ?= gh-pages

.PHONY: setup setup-browser data serve test deploy

# Create the virtual environment; install the pipeline's package from its
# repository, then this package with its test tools.
setup:
	python3.12 -m venv .venv
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -e $(PIPELINE)
	$(PYTHON) -m pip install -e '.[test]'

# A headless Chromium for checking pages: used by hand and by browser checks, not by make test.
setup-browser:
	$(PYTHON) -m pip install -e '.[browser]'
	$(PYTHON) -m playwright install chromium

# Build site/data from the release.
data:
	$(PYTHON) -m site_data --release $(RELEASE) --simulation $(SIMULATION) --out site/data

# Serve the site locally at http://localhost:8000
serve:
	cd site && python3 -m http.server 8000

test:
	$(PYTHON) -m pytest
	node --test "tests/*.test.js"

# Publish site/, with its data, as the only commit of $(DEPLOY_BRANCH) on $(DEPLOY_REMOTE), force-pushed.
deploy:
	./deploy.sh $(DEPLOY_REMOTE) $(DEPLOY_BRANCH)

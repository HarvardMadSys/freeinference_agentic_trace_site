PYTHON = .venv/bin/python

# The pipeline repository, a sibling folder: the package the data step imports,
# and the release and simulation it built. Override to build from a downloaded
# copy of the dataset:  make data RELEASE=~/freeinference_agentic_trace/release
PIPELINE ?= ../freeinference-agentic-pipeline
RELEASE ?= $(PIPELINE)/data/v1/release
SIMULATION ?= $(PIPELINE)/data/v1/simulation

.PHONY: setup setup-browser data serve test snapshots deploy

# Create the virtual environment; install the pipeline's package from its
# repository, then this package with its test tools.
setup:
	python3.12 -m venv .venv
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -e $(PIPELINE)
	$(PYTHON) -m pip install -e '.[test]'

# The headless Chromium the snapshot test opens the pages in, also for checking pages by hand; without it make test
# skips the snapshots, saying so.
setup-browser:
	$(PYTHON) -m playwright install chromium

# Build site/data from the release.
data:
	$(PYTHON) -m site_data --release $(RELEASE) --simulation $(SIMULATION) --out site/data

# Serve the site locally at http://localhost:8000 with Python's own file server.
serve:
	python3 -m http.server -d site -b 127.0.0.1 8000

# The paper-parity test reads the pipeline's numbers.json; it is told where the pipeline is and skips when it is absent.
# The snapshot test compares what the pages show with tests/snapshots/.
test:
	FREEINFERENCE_PIPELINE=$(PIPELINE) $(PYTHON) -m pytest
	node --test "tests/*.test.js"
	$(PYTHON) tests/snapshot.py

# Rewrite tests/snapshots/ from the pages as they are now, when a change is meant to alter what a page shows.
snapshots:
	$(PYTHON) tests/snapshot.py --write

# Publish site/, with its data, to Cloudflare as the static assets of the Worker wrangler.jsonc names. Needs
# `npm install` once and a Cloudflare API token (see README); a push to main deploys the same way through
# .github/workflows/deploy.yml.
deploy:
	npx wrangler deploy

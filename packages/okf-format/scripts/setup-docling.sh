#!/usr/bin/env bash
# Sets up the docling extractor for the ingest process boundary
# (docs/PLAN.md Section 3.4). Mirrors ENSIM's scripts/setup-portico.sh
# pattern for a contained non-TypeScript dependency: vendored locally,
# never committed, never leaking into the rest of the monorepo.
#
# Usage:
#   packages/okf-format/scripts/setup-docling.sh
#   ENCAP_PDF_EXTRACTOR_CMD=$(pwd)/.venv-docling/bin/docling  # then use this
#
# Requires Python 3.11+ (docling's real minimum as of 2.129.0 — 3.9, the
# macOS system default, is not enough). On macOS: `brew install python@3.11`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
VENV_DIR="$REPO_ROOT/.venv-docling"

PYTHON_BIN="${DOCLING_PYTHON:-}"
if [ -z "$PYTHON_BIN" ]; then
  for candidate in python3.13 python3.12 python3.11 /opt/homebrew/bin/python3.11; do
    if command -v "$candidate" >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      break
    fi
  done
fi
if [ -z "$PYTHON_BIN" ]; then
  echo "No Python 3.11+ found. Install one (e.g. 'brew install python@3.11') or set DOCLING_PYTHON=/path/to/python3.11+." >&2
  exit 1
fi

echo "Using $($PYTHON_BIN --version) at $PYTHON_BIN"
"$PYTHON_BIN" -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install docling

echo
echo "docling installed at $VENV_DIR/bin/docling"
echo "Point okf-format at it with:"
echo "  export ENCAP_PDF_EXTRACTOR_CMD=$VENV_DIR/bin/docling"

# ENCAP — see AGENTS.md and docs/PLAN.md before adding recipes.

# Install workspace dependencies.
install:
    npm install

# Build every package/app/harness that defines a build script.
build:
    npm run build

# Run every package/app/harness's test suite.
test:
    npm run test

# Schema and fixture validation: each workspace's own validate script,
# plus the fixtures manifest and the ENSIM snapshot against its own schemas.
validate:
    npm run validate

# Fetch a pinned-commit snapshot of ENSIM's org-doctrine-model data+schema
# into eval/ensim-harness/fixtures/ensim@<sha>/. Overridable:
#   just fetch-ensim                  # default pinned SHA (aa7b714)
#   just fetch-ensim <sha>            # a different pinned commit
#   ENSIM_PATH=/path/to/local/ENSIM just fetch-ensim   # local clone, no network fetch
fetch-ensim sha="aa7b714":
    node eval/ensim-harness/scripts/fetch-ensim.mjs {{sha}}

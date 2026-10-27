# ENCAP — Enterprise Agent Platform

Apps that let people work with AI agents grounded in a structured document set (OKF bundles) and
the enterprise's operating model: synthesis of documents into cited OKF, a document graph and index,
role-based access control, and a personnel console that is a governance layer, not only a chat UI.

Read [`docs/PLAN.md`](docs/PLAN.md) for what this is and the order it is built in, and
[`AGENTS.md`](AGENTS.md) before generating or editing anything.

## Part of the Acquisition Knowledge System

ENCAP is a component of the [Acquisition Knowledge System (AKS)](https://github.com/semanticarchitectures/acquisition-knowledge-system),
a demonstration of AI architecting and simulating Air Force enterprise operations, at scale and
realistically, and then being used in that enterprise, safely and under human authority.

Its role in AKS: the runtime and governance layer. It turns public doctrine into the
enterprise's operating model (AKS milestone D1), owns the single passage index and the access model
for the whole system, including the knowledge base's graph tools (AKS ADR 0009; milestone D3), and
provides the console where humans approve what agents propose (D4). Cross-component specs, the shared ontology and decisions live in the
umbrella repo.

## License

Apache 2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

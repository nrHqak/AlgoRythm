# AlgoRythm AI context index

This is the tool-neutral entry point for humans and coding agents. It intentionally routes to focused sources instead of duplicating the codebase.

## Load order

1. Read the root `AGENTS.md`.
2. Use the table below to select one focused context document.
3. Use `docs/context/REPOSITORY_MAP.md` to find entrypoints and symbols.
4. Inspect only the source files needed to verify or change the behavior.

| Need | Source of truth |
| --- | --- |
| Components, runtime topology, and data flow | [Architecture](docs/context/ARCHITECTURE.md) |
| HTTP, environment, auth, and database ownership contracts | [Contracts](docs/context/CONTRACTS.md) |
| Setup, validation, context refresh, migrations, and deployment | [Workflows](docs/context/WORKFLOWS.md) |
| Stable architectural choices and their consequences | [Decisions](docs/context/DECISIONS.md) |
| Known gaps, debt, and facts that cannot be inferred safely | [Known issues](docs/context/KNOWN_ISSUES.md) |
| Generated files, routes, symbols, migrations, and commands | [Repository map](docs/context/REPOSITORY_MAP.md) |

## Context maintenance

- Run `make context` after changing routes, request models, exported frontend symbols, migrations, environment-variable names, scripts, or top-level structure.
- Run `make context-check` for a non-blocking drift warning or `make context-strict` when drift must fail.
- Edit curated context when behavior or design changes. Never edit the generated repository map manually.
- Keep product narrative in `README.md` and deployment-provider steps in `DEPLOY.md`; link rather than copy them here.

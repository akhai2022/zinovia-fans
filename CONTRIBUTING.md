# Contributing

## Development workflow
- Create a feature branch from `main`.
- Keep changes scoped and include tests where applicable.
- Regenerate OpenAPI + TS client for any API changes.

## Local setup
1) Copy `.env.example` to `.env` and adjust values.
2) Run `make up`.
3) Run `make migrate`.

## Quality gates
- `make api-lint`
- `make api-typecheck`
- `make api-test`
- `make web-lint`
- `make web-build`
- `make gen-contracts`

## Pull requests
- Ensure the CI workflow passes.
- Include a test plan and any deployment notes.

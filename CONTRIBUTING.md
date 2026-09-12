# Contributing to kadan

Thanks for helping. A few rules keep this project small and safe.

## Ground rules

1. **Zero dependencies.** Node built-ins, tmux and standard OS commands only. New dependencies need a maintainer decision before code.
2. **The ledger is append-only.** Never add code that edits, deletes or reorders ledger events. Storage changes go through `src/storage.mjs`.
3. **No provider adapters.** Kadan does not special-case any AI CLI. If something needs a per-CLI branch, open an issue first.
4. **Fail closed.** Before sending, the session must exist and its pane PID must match. Unknown failures are reported, not retried.
5. **No completed DONE markers in prompts.** Prompts describe the format (`KADAN:DONE <card-id> <ok|failed>`); the agent assembles it. A literal marker in the prompt is read back as a false completion.

## Workflow

- Behaviour changes ship with tests in the same commit: `npm test`.
- Run `npm run check:public` before pushing. It fails on personal absolute paths or workspace records.
- Stage files by name. `git add -A` / `git add .` are not used in this repo.
- Keep changes surgical. Do not reformat or rename unrelated code.
- Commit messages: short imperative summary; Korean or English.

## Layout

- `src/` — CLI (`cli.mjs`), floors (`floor-tmux.mjs`, `floor-rottie.mjs`), ledger/storage, watch, dashboards.
- `tests/` — `node --test`. Tests that need tmux skip when it is absent.
- `scripts/watch-judge.sh` — example judge command for `kadan watch`; requires `KADAN_JUDGE_MODEL`.
- `skills/` — agent skills that drive Kadan (conductor, supervisor, secretary).
- `docs/` — current rules; `docs/design.md` explains the locked rules and ledger format. Daily logs and evidence are not part of this repository.

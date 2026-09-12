# kadan (카단)

**Run AI CLI agents as named roles in tmux — start them, message them, watch for completion, and step in yourself.**
카단은 여러 AI CLI(codex, claude 등)를 역할별 tmux 세션으로 띄우고, 메시지를 주고받고, 멈췄는지 감시하고, 필요하면 사람이 직접 창에 들어가 개입하는 도구입니다. 의존성 0개(Node 내장 + tmux).

Kadan does not wrap or adapt any particular AI CLI. Whatever runs in a terminal runs in Kadan.
It keeps an append-only ledger of what happened, refuses to send to a session it cannot prove is alive,
and never auto-judges an agent's output: completion is an explicit `KADAN:DONE <task> ok|failed` line the agent prints.

Interface language is currently Korean (role names, CLI output, dashboards). Contributions are welcome in any language.

## Requirements

- Node.js 24 or newer (the default SQLite storage uses the built-in node:sqlite)
- tmux 3.x (default floor). A Rottie floor also exists; see `docs/`.
- macOS or Linux. No terminal window is opened on Linux; `kadan attach` prints the command instead.

## Install

```bash
git clone https://github.com/ChickenBreast-ky/kadan.git
cd kadan
npm link          # puts the `kadan` command on your PATH (no dependencies are installed)
kadan --help
```

## First run

```bash
export KADAN_FLOOR=tmux       # fixed per machine: tmux | rottie
export KADAN_WINDOW=none      # none | orca | rottie  — whether to open a GUI tab on start

kadan start worker-a --cmd 'codex'        # creates tmux session kadan-worker-a and records it in the ledger
kadan send worker-a --task card-1 \
  "Do card-1. When finished, print one last line in the form: KADAN:DONE <card-id> <ok|failed>, card-id is card-1"
kadan wait worker-a                        # reports the DONE marker or silence; never decides for you
kadan attach worker-a                      # jump into the live terminal
kadan status
kadan stop worker-a                        # only sessions Kadan created can be stopped
```

Data lives in `~/.kadan` (override with `KADAN_HOME`). The ledger is append-only; Kadan never edits or deletes an event.

## More

- `kadan watch` — background monitor that reports stalls, disconnects and DONE candidates to a supervisor role.
- `kadan wall` / `kadan dashboard` — local HTML views of boards, cards, ledger and mail.
- `kadan card` / `kadan work` — central card store and result-oriented work items.
- `docs/` — design principles and locked rules (`design.md`), watch criteria, hierarchy, handover, SQLite storage.
- `CONTRIBUTING.md` — how to contribute; the same rules apply if you use an AI coding agent.
- `skills/` — conductor / supervisor / secretary skills for Codex-style agents that drive Kadan.

## Test

```bash
npm test          # node --test tests/*.test.mjs
npm run check:public   # fails if personal paths or workspace records leak into the repo
```

## License

Apache-2.0. See `LICENSE` and `NOTICE`.

---
description: Apply src/ edits to Games Library in the nested shell and check for errors
allowed-tools: Bash(./scripts/nested.sh status), Bash(./scripts/nested.sh start:*), Bash(./scripts/nested.sh reload), Bash(./scripts/nested.sh logs:*), Bash(./scripts/nested.sh mirror:*), Bash(./scripts/nested.sh stop)
---

Apply the current `src/` edits to Games Library in this repository's **nested
shell**, then confirm they took. Never the user's own session: `make reload` and
`./scripts/dev.sh reload` disable and enable the extension on the real desktop,
which is the user's to do.

1. `./scripts/nested.sh status`.
   - **Not running:** `./scripts/nested.sh start --stand-in` (the made-up library
     to look at; a plain `start` shows the user's own scan, and no button at all
     when there is none). A fresh start loads the current `src/`, so Games Library
     is ACTIVE with the edits when it returns; skip step 2.
   - **Running:** go on. Its settings are its own in every mode; nothing it does
     reaches the user's dconf.
2. `./scripts/nested.sh reload`. It waits for ACTIVE. Under `--stand-in` it copies
   `src/` and makes the made-up library again, so Pillow is needed here too.
3. `./scripts/nested.sh logs 40` and report whether it came up clean. A healthy
   reload logs `[Games Library] Enabled from
   /run/user/1000/games-library/shell-<pid>/lib-<stamp>` (a new stamp when `lib/`
   changed); `[Games Library] Rebuilt` follows a rescan or a style setting's change.
   Anything with `Failed to load`, `Error during disable`, or a JS stack trace
   under a `[Games Library]` line is a real failure: quote it and say which file
   it points at.

How to see it: the mirror window on the desktop shows the nested shell live
(`./scripts/nested.sh mirror on` if `status` says it is closed); the library
opens from its button beside Show Apps, so `/preview` (or the `drive-extension`
skill) opens it and screenshots it. Leave the nested shell running for that, and
stop it (`./scripts/nested.sh stop`) when the work is done. Never press Play or
Rescan there: both are real (a launch, an online scan with the real keys).

A reload re-imports `lib/` only. An edit to `scripts/dev-extension.js`,
`metadata.json` or the schema's keys needs `./scripts/nested.sh stop` then
`start` again (`glib-compile-schemas src/schemas` first, for the schema), not a
reload, and no logout: only the real session needs one, and that is the user's
to do.

---
description: Report the nested shell's state, then the install mode, the real session's state and the library size (read-only)
allowed-tools: Bash(make status), Bash(./scripts/dev.sh status), Bash(./scripts/nested.sh status)
---

Run `./scripts/nested.sh status` and `./scripts/dev.sh status`. Report in two
parts.

**Nested shell** (where changes are tried):

- **nested**: running or not, its pid, size and idle timeout. Not running is
  normal between tasks.
- **extension**: `ACTIVE` is healthy; `ERROR` means `enable()` threw (`/logs`);
  anything else after a `reload`, see `/logs` too.
- **settings**: always its own, never the user's dconf: `fresh for this run`
  under `--stand-in`, or `kept between starts` (`start --clean` resets them).
- **data** and **library**: `stand-in` and `the made-up one` under `--stand-in`,
  or `your own` and the user's own scan (no button beside Show Apps when there is
  none).
- **mirror**: open on the desktop, or closed (`./scripts/nested.sh mirror on`).

**Real session (read-only)**, from `./scripts/dev.sh status`, which only reads:

- **install**: `link` means dev mode: a plain nested `start`, and the real shell
  at its next login, run `src/` through `scripts/dev-extension.js` (a
  `--stand-in` start runs a copy of `src/` of its own). `made before
  dev-extension.json` under it means a link from before the kit's scripts: still
  works, and the user's own `make link` (then a logout) brings it up to date.
  `old-style symlink` is a stale install, `make link` again; `copy` is a real
  install that won't pick up edits until `make install` is re-run.
- **state**: the extension's state in the user's own shell. It says nothing about
  the edits in progress, and is never fixed by reloading or enabling there:
  that is the user's to do. `unknown to the running shell` means the UUID was
  never registered there, which needs the user's logout.
- **cache**: `~/.cache/games-library`, holding `library.json`, `posters/`,
  `backdrops/`, `metadata/`.
- **library**: the number of games in the user's own scan, or `not scanned yet`
  (`/scan`, at the user's request; a test uses `start --stand-in`).

If anything is off, say which command fixes it.

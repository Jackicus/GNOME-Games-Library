---
description: Show Games Library running in a nested shell, mirrored live on the desktop, and describe what it looks like
argument-hint: "[optional: what to click through first, e.g. 'open the library' or 'pick a game']"
allowed-tools: Bash(./scripts/nested.sh:*), Bash(make nested:*), Read
---

Show what Games Library currently looks like, using the kit's `gnome-ext:nested-shell`
skill and this repository's `drive-extension` skill. The user is watching the mirror
window, so narrate with `say` before each step.

Requested: $ARGUMENTS

1. `./scripts/nested.sh start --clean` (reuses one if already running; opens the
   mirror window on the desktop; Games Library is ACTIVE when it returns). Add
   `--demo` for the made-up library when the user's own is not scanned (no button
   then) or the shots are to be kept. A plain `start` only when the question is
   how it sits beside the user's other extensions.
2. In **one** `./scripts/nested.sh do …` call: `say` and `click` through to anything
   requested above — the library opens from its button beside Show Apps, so wrap
   an overview walkthrough in `overview on` … `overview off` — then `shot` into
   your scratchpad.
3. **Read the PNG** and describe what's actually on screen — layout, spacing,
   anything visibly broken.
4. `./scripts/nested.sh stop` when done, even if a step failed. It closes the
   mirror; `./scripts/nested.sh status` then says `not running`.

Never press Play or Rescan: Play launches the game on the real machine (under
`--demo` it runs `true`), Rescan scans online with the user's real keys.

Check `./scripts/nested.sh logs` if the screenshot looks wrong or unchanged; a JS
exception leaves the previous UI up and reads as "nothing happened".

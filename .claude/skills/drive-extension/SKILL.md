---
name: drive-extension
description: What Games Library looks like in the nested GNOME Shell and how to drive it - where the button, the overview grid, the modal panel and the detail pop-up are on a 1600x900 screen, the made-up demo library, the virtual pad, the preferences window, and what must never be pressed. Use with gnome-ext:nested-shell whenever a change must be SEEN or needs a fresh shell start.
---

# Driving Games Library in the nested shell

Read the kit's `gnome-ext:nested-shell` skill first: the loop, `do` and its steps,
`reload` versus `stop` + `start`, logs and stopping are there. This is what is particular
to Games Library.

## Its own commands

- `./scripts/nested.sh start --clean --demo`: `--clean` plus the made-up library of
  `scripts/demo_library.py` (invented games, artwork drawn on the spot, every folder under
  `/demo`, Play running `true`) through the nested session's `XDG_CACHE_HOME`. It needs
  Pillow (`python-pillow`). A shell already running is reused as it is, so `stop` first.
- `overview on` is a flag as well as a command: it marks the overview wanted and only
  then shows it if it is not up, so `do "overview on" "shot $S/x.png"` also photographs
  an overview the **library button** opened, where a bare `shot` would dismiss it.
  `run python3 scripts/nested_driver.py …` carries the same environment, flag included.
- Remote keys for `key`: `XF86OK`, `XF86Back`, `XF86ChannelUp`/`XF86ChannelDown`,
  `XF86HomePage`, and the rest of `scripts/nested_driver.py`'s table.
- Idle stop: `GAMES_LIBRARY_NESTED_IDLE=<seconds>` at `start` (default 600, `0` never).
- `library-opens-in` and `detail-opens-in` are settings: set them before `start`, or with
  `run timeout 5 gsettings --schemadir src/schemas set …` under `--clean`.

## Reading the screen (1600×900)

Measure from a fresh screenshot if the columns setting, the extensions loaded, the
accent or the geometry changed. Roughly:

- **The button** sits right of Show Apps in the overview's dash, ≈ (727, 850), under
  `--clean`. A plain `start` loads the user's extensions: with Dash to Panel it is in its
  bottom panel, Show Apps ≈ (30, 875) and Games ≈ (90, 875), unless another library's
  button attached later sits there; screenshot the strip first (`shot F 0 850 400 50`).
- **`menu` library**: the button opens the overview straight onto the games grid, the
  workspaces row folded away. A second press, or Escape, goes back to the desktop.
- **`modal` library**: a panel pops out of the button, roughly `210,78` to `1390,800`,
  with the library's title and count as its header. `click 20 450` on the shade, `key
  Escape` or a second press closes it.
- **Grid**, 2:3 posters: row 1 centres y ≈ 250, row 2 y ≈ 540 in the overview; 6
  columns by default.
- **A picked game** zooms a panel out of its tile (`menu`) or fades one in centred
  (`modal`); the shade's edge is 48 px in from the work area, so `click 20 450` closes
  it. Play and Show in Files are under the artwork, the details list on the right.
- **No button at all**: the library is empty (nothing scanned into
  `~/.cache/games-library/library.json`, or no `--demo`), or the logs have an error.
- **Two libraries**: with another library's button beside Show Apps (a plain `start`),
  a press of ours with the other's grid up closes the overview and reopens it on ours.

## Keyboard walks

Keep a walk to one unbroken run of `key` steps in one `do`: anything that drops key
focus to the stage between calls hands it back to the pop-up panel rather than to the
tile or row that had it (`panel.js` watches for that), so a split walk starts over.

## The preferences

`./scripts/nested.sh run gnome-extensions prefs games-library@jackicus &`, then
`window FILE`. To reopen after a `prefs.js` edit, kill the nested Extensions app: the
process whose environment has `WAYLAND_DISPLAY=games-library-dev`.

## A controller: `scripts/vpad.py`

A virtual Xbox 360 pad on uinput, driven through a FIFO: `./scripts/vpad.py FIFO &`, then
`echo "tap A" > FIFO` (`tap A|B|X|Y|LB|RB|START|BACK|GUIDE`, `hat up|down|left|right`,
`stick up|down|left|right [secs]`, `quit`). It needs python-evdev and write access to
`/dev/uinput`. It is a real device for the whole machine while it runs, so `quit` it
when done. Pad input is acted on only while the library is up, except Guide (Home),
which opens it when no window has the focus: drive it with the preferences closed.

## Never press

- **Play**: a real launch on the real machine (`xdg-open steam://rungameid/…` reaches
  the user's Steam; PCSX2 opens a real window). Stop at the detail pop-up. Under
  `--demo` Play runs `true`.
- **Rescan** in the nested preferences: the scanner with `--from-settings`, the real
  keys, online.
- **The shortcut dialog's "Allow inhibiting shortcuts" prompt** writes the real
  permission store. If a test must answer it, delete the entry afterwards
  (`PermissionStore.DeletePermission gnome shortcuts-inhibitor
  org.gnome.Shell.Extensions.desktop`) so the real session still asks.

## Screenshots for the README

`docs/screenshots/` is taken under `start --clean --demo` only. Crop the top 30 px (the
top bar, with the screencast indicator) off overview shots, and take the preferences
with `window FILE`.

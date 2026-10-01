---
name: drive-extension
description: What Games Library looks like in the nested GNOME Shell and how to drive it - where the button, the overview grid, the modal panel and the detail pop-up are on a 1600x900 screen, the made-up demo library, the virtual pad, the preferences window, and what must never be pressed. Use with gnome-ext:nested-shell whenever a change must be SEEN or needs a fresh shell start.
---

# Driving Games Library in the nested shell

Read the kit's `gnome-ext:nested-shell` skill first: the loop, `do` and its steps,
`reload` versus `stop` + `start`, logs and stopping are there. This is what is particular
to Games Library.

## Its own commands

- `./scripts/nested.sh start --stand-in` (or `--demo`): a scratch home, fresh settings and
  the made-up library of `scripts/demo_library.py` (invented games, artwork drawn on the
  spot, every folder under `/demo`, Play running `true`), which `scripts/nested.d/games.sh`
  writes into that home's cache. It needs Pillow (`python-pillow`) at `start` and at every
  `reload`, which stages `src/` and the library again; without the package, a venv made
  with `--system-site-packages` (the driver needs `gi`) put first on `PATH` will do. A
  shell already running is reused as it is, so `stop` first; `status` says which it is
  (`data:` stand-in or your own, `library:` made-up or yours).
- A plain `start` (or `--clean`, which resets them) has settings of its own too, with only
  Games Library enabled, but reads your own library in `~/.cache/games-library/`: with
  nothing scanned there, there is no button.
- `overview on` is a flag as well as a command: it marks the overview wanted and only
  then shows it if it is not up, so `do "overview on" "shot $S/x.png"` also photographs
  an overview the **library button** opened, where a bare `shot` would dismiss it.
  `run python3 scripts/nested_driver.py …` carries the same environment, flag included.
- Remote keys for `key`: `XF86OK`, `XF86Back`, `XF86ChannelUp`/`XF86ChannelDown`,
  `XF86HomePage`, and the rest of `scripts/nested_driver.py`'s table.
- Idle stop: `NESTED_IDLE=<seconds>` at `start` (default 600, `0` never).
- `library-opens-in` and `detail-opens-in` are settings: set them with
  `run timeout 5 gsettings --schemadir src/schemas set …`, in any mode.

## Reading the screen (1600×900)

Measure from a fresh screenshot if the columns setting, the extensions loaded, the
accent or the geometry changed. Roughly:

- **The button** sits right of Show Apps in the overview's dash: ≈ (960, 838) under
  `--stand-in`, with the stock favourites (Files, Text Editor, Calculator) left of Show
  Apps (880, 838). Kept settings with other favourites move it; screenshot the dash first
  (`shot F 580 780 440 120`).
- **`menu` library**: the button opens the overview straight onto the games grid, the
  workspaces row folded away. A second press, or Escape, goes back to the desktop.
- **`modal` library**: a panel pops out of the button, roughly `210,78` to `1390,800`,
  with the library's title and count as its header. `click 20 450` on the shade, `key
  Escape` or a second press closes it.
- **Grid**, 2:3 posters: row 1 centres y ≈ 265, row 2 y ≈ 545 in the overview; 6
  columns by default, the first column's centre x ≈ 340 and then every 184 px.
- **A picked game** zooms a panel out of its tile (`menu`) or fades one in centred
  (`modal`); the shade's edge is 48 px in from the work area, so `click 20 450` closes
  it. Play and Show in Files are under the artwork, the details list on the right.
- **No button at all**: the library is empty (nothing scanned into
  `~/.cache/games-library/library.json`, or no `--stand-in`), or the logs have an error.
- **Two libraries**: with another library's button beside Show Apps (another extension
  enabled with `run gnome-extensions enable …`), a press of ours with the other's grid up
  closes the overview and reopens it on ours.

## Keyboard walks

Keep a walk to one unbroken run of `key` steps in one `do`: anything that drops key
focus to the stage between calls hands it back to the pop-up panel rather than to the
tile or row that had it (`panel.js` watches for that), so a split walk starts over.

## The preferences

`./scripts/nested.sh run gnome-extensions prefs games-library@jackicus &`, then
`window FILE`. To reopen after a `prefs.js` edit, kill the nested Extensions app: the
process whose environment has `WAYLAND_DISPLAY=games-library-dev`.

## A controller: `scripts/vpad.py`

A virtual Xbox 360 pad on uinput, driven through a FIFO: `"$PWD"/scripts/vpad.py FIFO &`
(by its full path, which `ext.conf`'s `NESTED_STRAYS` names, so `stop` sweeps a pad left
running), then `echo "tap A" > FIFO` (`tap A|B|X|Y|LB|RB|START|BACK|GUIDE`,
`hat up|down|left|right`, `stick up|down|left|right [secs]`, `quit`). It needs
python-evdev and write access to `/dev/uinput`. It is a real device for the whole machine
while it runs, so `quit` it when done. Pad input is acted on only while the library is up,
except Guide (Home), which opens it when no window has the focus: drive it with the
preferences closed.

## Never press

- **Play**: a real launch on the real machine (`xdg-open steam://rungameid/…` reaches
  the user's Steam; PCSX2 opens a real window). Stop at the detail pop-up. Under
  `--stand-in` Play runs `true`.
- **Rescan** in the nested preferences: the scanner with `--from-settings`, the real
  keys, online.
- **The shortcut dialog's "Allow inhibiting shortcuts" prompt** writes the real
  permission store. If a test must answer it, delete the entry afterwards
  (`PermissionStore.DeletePermission gnome shortcuts-inhibitor
  org.gnome.Shell.Extensions.desktop`) so the real session still asks.

## Screenshots for the README

`docs/screenshots/` is taken under `start --stand-in` only. Crop the top 30 px (the
top bar, with the screencast indicator) off overview shots, and take the preferences
with `window FILE`. The GitHub social preview (1280×640) is the library shot's bottom
800 rows (grid and dash, no top bar or search) scaled from 1600×800.

# Games Library

Shared rules for every extension come from the GNOME-EXTENSIONS kit: `../CLAUDE.md` and `../.claude/rules/` (loaded with this file), and the `gnome-ext:*` skills. `.claude/kit.sh` pulls the kit at session start, or, with no kit beside this repository, fetches it and prints its rules into the session.

A GNOME Shell extension (UUID `games-library@jackicus`, version-name 1.0) that puts the
installed games (Steam, libraries on other drives included, and PlayStation 2 discs
through PCSX2) in a library beside Show Apps: in the overview's app-grid slot, or in a
panel that pops out of its button. No window, nothing on the wallpaper. `metadata.json`
claims Shell 50, the version it runs on; 48 and 49 are audited against the shell's
sources, not booted (`docs/compatibility.md`). It shares the shell with extensions that
reach the same places: read "Running next to other extensions" before touching anything
global.

## Layout

- `src/extension.js`: imports `lib/app.js` and enables it. `make link` puts
  `./scripts/dev-extension.js` in its place, which also turns on `lib/log.js`'s `note()`
  lines (`Rebuilt`, `Enabled from …`); the shipped extension logs only failures.
- `src/lib/app.js`: `GamesLibraryApp`: settings, rebuilds, the browser, the detail
  pop-up, controls, the shortcut, launching (`openPath`).
- `src/lib/library.js`: `SECTIONS` (the one, `games`), `LIBRARY` (the button's title
  and icon), reading `library.json`, the game normaliser.
- `src/lib/mediaMenu.js` (the `menu` library, in the overview's slot),
  `src/lib/libraryWindow.js` (the `modal` library, in the folder's panel),
  `src/lib/libraryButton.js` (the one button beside Show Apps), `src/lib/mediaGrid.js`
  (the shell's app grid, holding posters): `.claude/rules/grid.md`.
- `src/lib/panel.js` (the shell's `AppFolderDialog`, with the folder taken out),
  `src/lib/detailDialog.js`, `src/lib/detailView.js` (a picked game, popped up),
  `src/lib/shape.js`: `.claude/rules/popup.md`.
- `src/lib/controls.js`, `src/lib/actions.js`: remotes, controllers and bound keys
  (`.claude/rules/controls.md`).
- `src/lib/widgets.js`, `src/lib/anim.js`, `src/lib/lazyList.js`: widgets, motion, lists
  filled as they scroll. `src/icons/library-symbolic.svg`: the button's gamepad.
- `src/prefs.js`: General, Controls and Games pages (`.claude/rules/prefs.md`).
- `src/backend/`: the Python scanner; `src/backend/CLAUDE.md`.
- `scripts/`: the kit's `dev.sh`, `nested.sh`, `nested_driver.py`, `dev-extension.js`,
  `kit.mk` (synced from the kit); its own `ext.conf`, `dev.d/games.sh` (`scan`, `scanner`,
  `stalls`), `nested.d/games.sh` (the demo library), `demo_library.py`, `vpad.py`,
  `stallwatch.py`. `docs/`: private API, compatibility, publishing.

The section's identity (its key, its `games-` settings, its title, its icon) is
`SECTIONS` in `lib/library.js` and nothing else restates it: `prefs.js` imports that list
and merges in only what its page says. The button's icon is a file of the extension's
own (`LIBRARY.icon`), `-symbolic` so St recolours it as it does Show Apps; the section's
`icon` stays a theme name, for its preferences page.

Runtime data: `~/.cache/games-library/`: `library.json`, `posters/`, `backdrops/`,
`metadata/index.json`. The JS never scrapes; it only reads what Python wrote. **Every
artwork path in `library.json` is a file in that cache, already scaled** to what the
desktop ever draws, HiDPI included (posters 512×768, backdrops 960×540: `metadata.py`
`POSTER_BOX`/`BACKDROP_BOX`, sized off `mediaGrid.js`'s tile and `detailView.js`
`HERO_MAX_HEIGHT`), since St decodes a background image at full size on the compositor
thread and keeps it. `library.js` lists the two art folders once per load and treats a
path outside them as missing: no stat per poster.

## How it fits together

1. `scan_library.py` reads Steam's and PCSX2's own bookkeeping (`games_scanner.py`),
   enriches each game online (`metadata.py`) and writes `library.json` atomically,
   under an `flock`. Under `--from-settings` it reads the preferences itself, so the
   Rescan button (`prefs.js`) and `./scripts/dev.sh scan` both just run it. Sources,
   credential slots and testing it: `src/backend/CLAUDE.md`.
2. `GamesLibraryApp` reads `library.json` and builds a **browser** (`MediaMenu` or
   `LibraryWindow`, per `library-opens-in`) and the **`DetailDialog`** a pick pops up
   in. A file monitor on `library.json` rebuilds both when a rescan lands, and so does
   a change of any style setting, of either place, or of the scale factor. A rebuild
   puts the library back up if it was showing (`state`/`restore` on the browser).
3. Navigation is two levels: the **library** (a grid) and the **detail** pop-up
   (artwork, Play and Show in Files under it; title, facts, synopsis and a details
   list beside it). **Play** runs the game's own argv (`openPath`'s array branch):
   `xdg-open steam://rungameid/<appid>`, or PCSX2 with `-fullscreen -- <disc>`. A
   launch closes whatever was up (the pop-up's grab would hold the game's window off)
   and, with `play-on-new-workspace`, moves to an empty workspace first.

**The grid is the shell's own app grid**; **the keyboard is St's** (each grid and panel a
`global.focus_manager` group); **remotes and pads are the keyboard too**, replayed as
the arrows, Enter and Escape.

## Where it opens

Where each of the two things opens is a setting, read **independently**:
`library-opens-in` for the grid, `detail-opens-in` for a picked game, each `menu` or
`modal` (default `menu`). There is no desktop or workspaces place: a game is one thing
to launch, not a collection to leave on the wallpaper.

- **One button beside Show Apps** (in the dash, or in Dash to Panel's panel) opens
  both (`libraryButton.js`, a `Dash.ShowAppsIcon` subclass). The shortcut and a
  controller's Home press it the same way (`app.js` `_toggleLibrary`). `app.js` holds
  it for the whole enable and hands it to each browser a build makes, so a rebuild
  leaves it where it is, lit if it was. A library with no games gets no button. It
  behaves as a dock's Show Apps: pressed on the desktop it opens the overview, and a
  second press or Escape goes back to the desktop.
- **`menu` library**: the grid in the overview's app-grid slot, the row of small
  workspaces folded away (`mediaMenu.js`).
- **`modal` library**: the grid in a folder's panel that zooms out of the button
  (`libraryWindow.js`, `panel.js`); a second press, Escape or the shade closes it, and
  it dies when the button unmaps.
- **A picked game**: `menu` zooms the pane out of its tile the way an app folder opens
  and goes when the tile unmaps; `modal` is the same `DetailDialog` over everything
  until dismissed. Both hold a `POPUP` grab; neither is a window
  (`.claude/rules/popup.md`).

**The shortcut** is `games-shortcut` (`as`, empty by default), grabbed with
`Main.wm.addKeybinding` in `NORMAL | OVERVIEW | POPUP` mode; in a popup it only closes
the modal library's own panel (`app.js` `_onShortcut`).

## Running next to other extensions

Other extensions in the same shell (docks, Dash to Panel, Blur my Shell, other libraries)
put buttons beside Show Apps, put a grid in the same app-grid slot, hook the same shell
and Dash to Panel methods, and read the same pads. What keeps them apart; keep it true.

- **Its prefixes**: GObject classes `GamesLibrary…` (`GamesLibraryMediaView`,
  `GamesLibraryPanel`, `GamesLibraryLibraryIcon`, …), CSS `gm-`, the blur effect
  `games-library-panel-blur`; settings `org.gnome.shell.extensions.games-library`, cache
  `~/.cache/games-library/`, staging `$XDG_RUNTIME_DIR/games-library/shell-<pid>/`, log
  prefix `[Games Library]`, nested shell `games-library-dev` in
  `$XDG_RUNTIME_DIR/games-library-nested/`. Shell classes (`app-folder-dialog`,
  `overview-tile`, `button`) are shared on purpose.
- **Two monkey-patches, both chained.** `mediaMenu.js` wraps the overview layout's
  `_getAppDisplayBoxForState` and `libraryButton.js` wraps Dash to Panel's
  `panel._updateGroupedElements`, each as an own property of the instance; each calls
  whatever it found. They come off (`_unfoldWorkspaces`, the Dash to Panel host's
  `release`) only while the current value is still ours, by putting back what was
  there (another wrapper, or a `delete` to show the class's method). Under someone
  else's wrapper ours stays as an inert link: `folded` checks
  `menu._foldedBox === folded`, the panel wrapper checks its `element`.
  `_foldWorkspaces` looks the class's method up on every call (Dash to Dock patches
  this very method on the prototype) and measures its own slot off the class, not off
  what another wrapper may have grown.
- **Two views, one app grid.** A library shows its grid by adding a view to `appDisplay`
  and hiding `appDisplay._box`. If the grid is up with someone else's view in it
  (`MediaMenu._otherViewUp`), our button, shortcut or Home does not draw over it: `open`
  hides the overview and reopens onto ours from the `hidden` handler (`_next`,
  `_reopenId`). Only one view is ever up, so each fold wrapper grows the slot only for its
  own.
- **Controllers.** Another extension may read the same pads; each acts only while its
  own library is up, except Home. Home here is Guide (`pad-home` `button:316`) and
  `keys-home` is empty, leaving Menu (`button:315`) and a remote's HomePage key to
  others. `_controlsOpen` refuses while any window has the focus or any modal grab is
  up (`Main.modalCount > 0`).
- **Workspaces.** `_emptyWorkspace` (`play-on-new-workspace`) skips a workspace with
  `_keepAliveId` set (the shell's during a drag, or another extension's), and never sets
  it.

## Design rules

- **The shell's widgets first**: the app grid for the library, `AppViewItem` and
  `overview-tile` for a tile, `app-folder-dialog` for the panels, `button` for the
  actions, `global.focus_manager` for the keyboard, the dash's `ShowAppsIcon` for the
  button. Its own shapes are only the detail pane and the rows.
- **Motion**: `anim.js` `Duration` 120 ms (hover, leaving) and 200 ms (arriving),
  ease-out-quad or ease-out-expo; `easeProps` takes the slow-down factor for the one
  thing `ease()` cannot reach (a blur effect).
- **Corners come from one radius**: `corner-radius` (default 18), scaled by `shape.js`
  into artwork, hero, pane, pane-inner and badge, set inline as each surface is built.
  The stylesheet's `border-radius` values are fallbacks matching the default: change
  `shape.js`, not them. Pills stay `9999px`.
- **The style settings are one set, for both places**: `columns` (4–10), `rows` (1–3),
  `grid-align`, `corner-radius`, `detail-size` (80–120%). No per-view copy; a change
  rebuilds whatever is built.
- **The neutrals are the dark palette's on purpose** (`#222226`, `#fafafb`): the panels'
  contents sit on the shell's dark folder panel or a dimmed backdrop.
- **Placeholders are drawn**: missing artwork is an accent-tinted tile (`widgets.js`).

## Traps of its own

- **Play is a real launch**, from the nested shell too: `xdg-open steam://…` reaches the
  user's Steam. **Rescan runs the scanner with `--from-settings`**: real keys, online.
  Never press either to test; `/scan` is that same scan, run only when the user asks.
- **The shares idle out, and one can be offline.** On the main desktop, `/media/LENOVO`
  and `/media/HP-AIO` are systemd automounts with a 60 s idle timeout; an offline
  share blocks every toucher for its connect timeout (11 s measured there). A PS2
  disc folder can be there, so nothing in `lib/` or `prefs.js` touches a game's folder
  synchronously (`query_info_async`, `launch_default_for_uri_async` for Show in Files); only the
  local cache is read synchronously. `make stalls` logs to `dist/stalls.log`
  (`autofs_wait` is an automount being mounted, `cifs_*` a share answering slowly).
- **API keys** are in the `credentials` setting in plain text (the README and the
  schema's comment say so; the preferences do not yet).
- **The 48 floor is the theme's**, not the shell internals' (identical in GNOME 48 to
  50, `docs/compatibility.md`): `St.BoxLayout({orientation})` and libadwaita 1.7's
  `Adw.ToggleGroup` are 48+.
- **Private shell API** is listed in `docs/private-api.md`, with what breaks. In short:
  the overview grid going missing after an upgrade is `mediaMenu.js`'s reach into
  `Main.overview._overview.controls`; the button missing beside Show Apps is
  `libraryButton.js`'s into Dash to Panel and `ShowAppsIcon`; the pop-up shading a
  desktop whose folders do not is `panel.js` `folderLook()`.

## Checking and landing

`make check` needs no shell: `make lint`, then `./scripts/dev.sh check`: the schema with
`--strict` (dry run), then `scanner` (`EXT_CHECKS`: the Python byte-compiled, the scanner
`--offline` against an empty scratch `HOME`). CI runs it in the kit's Arch container.
`make pack` packs exactly what `EXT_SHIP` names and fails on any file missing or extra. A
pushed `v*` tag is a release (`.github/workflows/release.yml`).

Seeing a change is the nested shell, whose settings are always its own: the drive skill
(`.claude/skills/drive-extension/SKILL.md`) for its coordinates, `--stand-in`, the pad and
what never to press. `/reload`, `/logs`, `/status` and `/preview` use it; `make reload` is
the user's session, theirs to run. `docs/screenshots/` are of `start --stand-in` only.

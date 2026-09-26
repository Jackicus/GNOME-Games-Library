# Compatibility

The code is built for GNOME Shell 48 to 50, but `metadata.json`'s
`shell-version` currently claims only `["50"]`, the one version that's
actually been run — 48 and 49 are audited against the shell's sources (below),
not booted, so they're not claimed yet; the checklist at the end covers what
adding one takes. This page lists every code path that depends on the
version and says what to check first on each. Below, "claimed version"/
"claimed floor" means this 48–50 design range, not literally what
`metadata.json` lists today.

## What has been tested

- **The development machine:** GNOME Shell 50.5 on CachyOS (Arch-based),
  Wayland, with an NVIDIA GeForce GTX 1080 on the proprietary driver
  580.178.04. The rest of the stack on that machine: mutter 50.5, GJS 1.88.1,
  GLib 2.88.3, GTK 4.22.5, libadwaita 1.9.4, libmanette 0.2.13, Python 3.14.7
  with Pillow 12.3.0, PyGObject 3.56.3 and gdk-pixbuf 2.44.7.
- **Other extensions installed there:** Dash to Panel 74 and Blur my Shell 72,
  both enabled in the session, and Dash to Dock 109, installed but not enabled.
  The Dash to Panel and Blur my Shell code this extension depends on was read in
  those versions ([private-api.md](private-api.md)).

How far that goes:

- **Games Library has not been enabled in the real session on that machine.** The
  journal has no `Games Library` line in any boot it still holds, and there is no
  `~/.cache/games-library/`, so no scan has written a real library there either.
- **It has been run in the nested shell** (`scripts/nested.sh`): the same
  gnome-shell 50.5 binary, run as
  `gnome-shell --wayland --headless --virtual-monitor 1600x900` on its own
  session bus, from the development link (`make link`). On 2026-09-25 it was
  run as `start --clean --demo` — Games Library the only extension enabled, a
  dconf database of its own, and the made-up library of
  `scripts/demo_library.py` — and these were exercised:
  - the `menu` library, opened from its button in the overview's dash, paged
    to the second page and back, and closed with Escape;
  - the detail pop-up (`detail-opens-in` `menu`) for a Steam entry and a PS2
    entry, closed with Escape;
  - the `modal` library panel, opened from the same button;
  - rebuilds from a setting changed underneath it (`library-opens-in`,
    `columns`), with the library on its first page and on its second;
  - the three preference pages, opened in the nested session;
  - a fresh stop and start, enabling from nothing.

  The journal was clean through all of it, once the one error it turned up (a
  rebuild on any page but the first) was fixed.
- **Not exercised there:** Dash to Panel or Blur my Shell alongside (the clean
  session loads no other extension), `detail-opens-in` `modal`, Play, a real
  scan, controllers and remotes, the keyboard shortcut, lock and unlock, and
  a real login.
- **The zip in `dist/` has not been installed.** The shipped path has not been
  run the way a user gets it (checklist step 4).

Nothing else has been tested:

- **GNOME 48 and 49** are within the design range but not claimed, and have
  never been run. Every shell path in [private-api.md](private-api.md) is
  present, with the same shape, at the `48.0` and `49.0` tags. One code path
  differs between 48 and the later versions, and it is chosen by feature test
  ([below](#closing-a-panel-from-the-shade-paneljs)).
- **GNOME 51** is outside the design range, and as written it will not work. It removed two
  calls this extension makes ([below](#gnome-51)).
- **No X11 session.** 48 has one, 49 turns it off by default, and 50 removed it
  (gjs.guide, "Port Extensions to GNOME Shell 49" and "... 50"). Nothing in the
  code branches on the session type.
- **No other GPU.** Nothing here draws with its own shaders. The one GPU effect
  is a `Shell.BlurEffect`, and only when Blur my Shell has put one on the app
  folders.

## Why 48 is the floor

The floor comes from the theme and the widgets, not from the shell internals.
Every private path is the same at `48.0` as at `50.5`.

| What | Where | Needs |
|---|---|---|
| `-st-accent-color`, `-st-accent-fg-color`, `st-mix()`, `st-lighten()`, `st-transparentize()` | `stylesheet.css`, throughout | GNOME 47. `src/st/st-theme-node.c` has none of them at `46.0` and all of them at `47.0` |
| `St.BoxLayout({orientation})` | nine sites in `detailView.js`, `widgets.js`, `panel.js` and `libraryButton.js` | GNOME 48. `src/st/st-box-layout.c` has only `vertical` at `47.0`, and `orientation` from `48.0` |
| `Adw.ToggleGroup`, `Adw.Toggle` | `prefs.js`, the two "opens in" rows and "Align covers" | libadwaita 1.7, which GNOME 48 ships |

The shell does not load an extension on a version `metadata.json` does not
list, so none of this matters unless the floor is lowered.

## Version-sensitive code paths

### Closing a panel from the shade (panel.js)

`MediaPanel._addClickAway()` closes the modal library's panel and the detail
pop-up when the shade around them is clicked. It picks the shell's own way per
version:

```js
if (Clutter.ClickGesture) {
    const clickGesture = new Clutter.ClickGesture();
    clickGesture.connect('may-recognize', () => { ... get_coords_abs() ... });
    clickGesture.connect('recognize', () => this.popdown());
    ...
}
const clickAction = new Clutter.ClickAction();
clickAction.connect('clicked', () => { ... get_actor_at_pos(...) === this ... });
```

`clutter/clutter/clutter-click-gesture.h` is absent at mutter `48.0` and present
at `49.0`, `50.0` and `51.0`. `clutter-click-action.h` is present at `48.0` and
gone from `49.0` (gjs.guide, "Port Extensions to GNOME Shell 49":
"Clutter.ClickAction() and Clutter.TapAction() have been removed"). Each branch
is the shell's own `AppFolderDialog` code for its version: the `ClickAction`
one matches `appDisplay.js` at `48.0`, and the `ClickGesture` one matches it at
`49.0` and `50.5`. The `ClickAction` branch has never run.

*Check first on 48:* open the modal library, then a game. A click on the shade
closes each one, and a click inside the panel does not.

### Remotes and controllers as keys (controls.js)

`Controls.enable()` makes a virtual keyboard to replay a remote's OK as Enter
and a controller's A as Enter:

```js
this._device = Clutter.get_default_backend().get_default_seat()
    .create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
```

`clutter_get_default_backend()` is declared in `clutter-backend.h` at mutter
`48.0`, `49.0` and `50.0`, and removed at `51.0` (gjs.guide, "Port Extensions to
GNOME Shell 51": "use global.stage.context.get_backend()"). The shell itself
already uses `global.stage.context.get_backend().get_default_seat()` in
`keyboard.js` at `48.0`, `49.0`, `50.5` and `51.0`, so that form would work on
every version.

`Controls.enable()` is the first thing `GamesLibraryApp.enable()` calls. On 51 it
throws, and nothing else is built (see [GNOME 51](#gnome-51)).

*Check first on every version:* add a key under Select on the Controls page,
open the library, move to a poster with the arrows, and press the key. The
game should open.

### Keyboard navigation inside the panels (panel.js)

```js
vfunc_key_press_event(event) {
    if (handleBoundKey(event))
        return Clutter.EVENT_STOP;
    if (global.focus_manager.navigate_from_event(event))
        return Clutter.EVENT_STOP;
    ...
}
```

The `navigate_from_event()` call is the one the shell's own
`AppFolderDialog.vfunc_key_press_event()` makes at `48.0`, `49.0` and `50.5`.
At `51.0`, `st_focus_manager_navigate_from_event()` is gone from
`src/st/st-focus-manager.h`, and `AppFolderDialog` no longer has the vfunc. A
focus group now moves focus itself, with a `Clutter.KeyController` that
`st_focus_manager_add_group()` puts on the group's root. gjs.guide's page for 51
does not mention the removal.

*Check first:* open the modal library and a game. Tab and the arrows move
between posters, rows and buttons, and Escape closes the panel.

### The keyboard in the overview (the menu library)

On 48 to 50, the overview's `ControlsManager` connects a `key-press-event`
handler on the stage, and a first Tab or Down calls `navigate_focus()` on the
app display. The library's view is a child of the app display, so that is how
the keyboard gets into the games. The app display also turns its own pages on
Page Up, Page Down, Home and End, from a stage handler it connects while it is
mapped (`_onKeyPressEvent`), and it stays mapped under the games. The view
stops Page Up and Page Down itself when a poster has the keyboard, because
they are its default `keys-page-*` bindings.

51 removes the overview's stage handler. Instead it makes `ControlsManager` a
focus group with a `vfunc_navigate_focus()`, gives `AppDisplay` a
`vfunc_navigate_focus()` of its own, and moves its page keys into a binding
pool (`overviewControls.js` and `appDisplay.js` at `51.0`). Whether the first
arrow still reaches a poster on 51 is untested. So is which grid Page Down
turns, on any version, before a poster has the keyboard.

*Check first on 51:* open the games from the button, press Down, then Page
Down.

### The overview slot (mediaMenu.js)

The `menu` library wraps the overview layout's `_getAppDisplayBoxForState()`.
The layout calls it only while the app display is visible, so until the app
grid has been laid out once, a library just built (at login, or by any
rebuild) has no measured slot. `_slotSize()` re-does the layout's arithmetic
for that first press. The wrapped method takes six arguments
`(state, box, searchHeight, dashHeight, workspacesBox, spacing)` at `48.0`,
`49.0`, `50.5` and `51.0`. The method and `ControlsManagerLayout.vfunc_allocate()`
are the same at all four, apart from `let` becoming `const`. So are the two
constants `_slotSize()` copies, `DASH_MAX_HEIGHT_RATIO` (0.16) and
`VERTICAL_SPACING_RATIO` (0.02).

*Check first:* change `rows` and change it back, which rebuilds the library.
Then press the button on the desktop, close the overview, and press it again.
The covers should be the same size both times, with Dash to Panel on and off.
The row of small workspaces should fade out with no band left where it was.

### The button beside Show Apps (libraryButton.js)

The button subclasses the shell's `ShowAppsIcon`. Its class body is the same
at `48.0`, `49.0`, `50.5` and `51.0`, apart from `let` becoming `const` and one
`return GLib.SOURCE_REMOVE`. The Dash to Panel side was read in Dash to Panel 74
only, which claims 46 to 51.

*Check first:* with Dash to Panel off, the button is in the dash after Show
Apps, with a tooltip on hover. With it on, the button is in the panel after
Show Apps. Disable and enable Dash to Panel, which rebuilds its panels, and the
button comes back.

### Blur my Shell's look on the pop-ups (panel.js)

`folderLook()` copies the blur and the style classes that Blur my Shell puts on
the app folders' dialogs. That was read in Blur my Shell 72, which claims 46 to
50.

*Check first:* with Blur my Shell's app-folder blur on, open a game. The
background blurs as it does behind an app folder, with no dark shade. With
Blur my Shell off, the shade is back.

### Controllers (controls.js, prefs.js)

libmanette is optional. Both processes load it only when it is wanted, with
`import('gi://Manette')`. Without it the shipped extension says nothing (the
line is behind `lib/log.js`'s `note()`, which only the dev entry point turns
on) and the preferences show the same message regardless. `gamepad-enabled` is
on by default, so the shell process loads it at `enable()` when it is
installed.

- The import names no version, so GJS takes whichever Manette typelib is
  installed. Only `Manette-0.2` exists here.
- `Manette.Device.get_guid()`, which both files call for every input, is marked
  `version="0.2.10"` in `Manette-0.2.gir`. With an older libmanette the library
  loads, and every controller input then throws inside its signal handler.
  Nothing checks for this.
- On this machine libmanette is there because WebKitGTK needs it
  (`pacman -Qi libmanette`: required by `webkit2gtk-4.1` and `webkitgtk-6.0`).
  Nothing guarantees it elsewhere.

*Check first:* with nothing open and no window focused, press Guide. The
library should open. Then move with the D-pad, open a game with A, and close it
with B. Unplug the controller and plug it back in.

### The preferences (prefs.js)

The preferences run in a separate process on whatever GTK and libadwaita the
system has. GNOME 48 was released with GTK 4.18 and libadwaita 1.7. The
versions below are the ones marked in this machine's `Adw-1.gir` and
`Gtk-4.0.gir`.

| Widget or call | Needs | In GNOME 48's stack |
|---|---|---|
| `Adw.ToggleGroup`, `Adw.Toggle` (`active_name`, `homogeneous`, `can_shrink`) | libadwaita 1.7 | yes |
| `Adw.ShortcutLabel` | libadwaita 1.8. Falls back to `Gtk.ShortcutLabel` (`Adw.ShortcutLabel ?? Gtk.ShortcutLabel`), which has the same `accelerator` and `disabled-text` and is deprecated since GTK 4.18 | the fallback |
| `Adw.Dialog` (`present()`, `closed`), for the key and controller capture | libadwaita 1.5 | yes |
| `Adw.ToolbarView`, `Adw.SwitchRow`, `Adw.ExpanderRow.add_suffix()` | libadwaita 1.4 | yes |
| `Adw.PasswordEntryRow` (`show_apply_button`, `apply`, `add_suffix()`) | libadwaita 1.2 | yes |
| `Adw.PreferencesGroup.set_header_suffix()` | libadwaita 1.1 | yes |
| `Adw.ActionRow`, `Adw.PreferencesPage`, `Adw.PreferencesGroup`, `Adw.StatusPage`, `Adw.HeaderBar`, `Adw.ButtonContent` | libadwaita 1.0 | yes |
| `Gtk.FileDialog` (`select_folder()`, `initial_folder`) | GTK 4.10 | yes |
| `Gtk.show_uri()` | GTK 4.0, deprecated since 4.10 | yes |
| `Gdk.Toplevel.inhibit_system_shortcuts()` (called with `?.`) | GTK 4.0 | yes |
| `Gtk.Scale.add_mark()`, `Gtk.EventControllerKey`, `Gtk.MenuButton`, the `Gtk.accelerator_*()` functions | GTK 4.0 | yes |

So on 48 the shortcut row draws GTK's deprecated label, and everything else is
the same widget as on 50.

*Check first on 48:* open the preferences. The shortcut row should show
"Disabled". Set a shortcut and clear it, flip both "opens in" toggles, and add
and remove a controller input.

### The scanner (backend/)

The Rescan button runs `python3 <extension>/backend/scan_library.py
--from-settings` from the preferences (`_scanButton`).

- **Python 3.7 or later**, by reading. The three files parse with Python's own
  parser set to the 3.6 grammar, but `subprocess.run(capture_output=True,
  text=True)` is 3.7. Only 3.14.7 is on this machine.
- **The standard library only**, plus `fcntl` (so Unix only) for the lock on
  `library.json`. Online lookups are `urllib` over HTTPS.
- **`gsettings`** (from GLib) on `PATH`, for `--from-settings`. The scanner
  reads the preferences with `gsettings get`, pointed at the extension's own
  `schemas/` when a compiled schema is there.
- **Image scaling is optional, and needed for artwork.** `metadata.py`
  `_scaler()` uses Pillow if it imports, and otherwise GdkPixbuf through
  PyGObject. With neither, `fit_image()` returns `None`, no artwork is kept,
  and every game gets the drawn placeholder. There is no error. On this
  machine PyGObject is there because mutter requires it, and Pillow because
  Inkscape and Matplotlib do (`pacman -Qi`). Neither was installed for this
  extension.

### Smaller things

- **`enable()`/`disable()` synchronity.** The shipped `src/extension.js` has a
  synchronous `enable()`/`disable()` (a plain, static `import` of `lib/app.js`),
  so there's nothing to check here. `scripts/dev-extension.js`, the dev-only
  entry point `make link` installs, has an `async enable()` because it awaits
  the dynamic `import()` of the staged `lib/app.js`; its `disable()` is
  synchronous. The shell awaits `enable()` (`await extension.stateObj.enable()`
  in `extensionSystem.js` at `48.0`, `49.0`, `50.5` and `51.0`), so neither
  shape is a version gap on any claimed version; it would only matter if GNOME
  51's stricter rule (an async `disable()` throws) were relevant, which it is
  not here, since neither entry point's `disable()` is async.
- **A throw inside `GamesLibraryApp.enable()` reaches the shell.** It calls
  `disable()` on whatever it managed to build and rethrows, so `extension.js`'s
  own `enable()` throws too. `_callExtensionEnable()` then leaves the extension
  disabled with the error shown in the Extensions app and in the journal,
  rather than recording a silent success with nothing on screen.
- **`Clutter.Stage.get_key_focus()` returns `null` when nothing has focus, from
  48** (gjs.guide, 48 port page). The panels take the keyboard back when it is
  dropped, and they test for exactly that `null`.
- **`captured-event::key`** (`mediaMenu.js` `_force()`, for Escape in an
  overview the button opened) is a detailed signal at mutter `48.0` and `51.0`
  (`G_SIGNAL_DETAILED` in `clutter-actor.c`). The date menu the code comments
  cite stopped using it in 51, so the comment will go stale, but the signal
  still works.
- **GType names** come from the module's path, because the shell sets
  `GObject.gtypeNameBasedOnJSPath = true` (`ui/environment.js` at `48.0`,
  `49.0`, `50.5` and `51.0`). Under the dev entry point, that means each staged
  copy of `lib/` registers its own types
  ([private-api.md](private-api.md#not-shell-internals-staging-lib)); the
  shipped `extension.js` imports `lib/` straight from `src/`, so it registers
  one set of types for the life of the shell.

## GNOME 51

As written, 51 gets an extension that says it is on and shows nothing.

1. `Clutter.get_default_backend()` is gone. `Controls.enable()` throws on the
   first line of `GamesLibraryApp.enable()`, so there is no button, no shortcut
   and no controller. The journal says
   `Failed to load lib/app.js: TypeError: ...`. The replacement,
   `global.stage.context.get_backend()`, already works on 48 to 50.
2. `global.focus_manager.navigate_from_event()` is gone. With the first fixed,
   any key that reaches a panel's `vfunc_key_press_event()` without being a
   bound key throws there. That covers the modal library and the pop-up in both
   places. Escape still closes them, because at `51.0` `GrabHelper` takes
   Escape with a key controller in the capture phase. Whether the new focus
   group's own key controller handles the arrows before the vfunc sees them is
   untested.

Everything else in [private-api.md](private-api.md) is at `51.0` with the same
shape. The changes that touch this extension without breaking it:

- `AppDisplay` is declared with `static { GObject.registerClass(this); }`, but it
  still `extends BaseAppView`, so `Object.getPrototypeOf(AppDisplay.AppDisplay)`
  still finds it.
- `BaseAppView._onScroll()` now takes a `Clutter.ScrollController`'s arguments.
  The library's view inherits it and does not override it.
- The overview's keyboard entry was rewritten
  ([above](#the-keyboard-in-the-overview-the-menu-library)).
- The search entry is a new `Search.SearchEntry`. `_slotSize()` measures its
  parent, which is still the bin the layout measures.
- The `vertical` property of St widgets is removed and `St.ButtonMask` is
  renamed. Neither is used here.

Dash to Panel 74 claims 51. Blur my Shell 72 does not.

## Checklist for a new GNOME version

1. Read gjs.guide's "Port Extensions to GNOME Shell N" page, and search it for
   `AppDisplay`, `BaseAppView`, `IconGrid`, `overview`, `dash`, `ShowAppsIcon`,
   `AppFolderDialog`, `GrabHelper`, `focus_manager`, `get_default_backend`,
   `ClickGesture`, `BlurEffect`, `St.BoxLayout` and `disable()`.
2. Diff the shell between the last working tag and the new one, over the files
   [private-api.md](private-api.md) reaches into:
   `js/ui/{appDisplay,iconGrid,dash,overview,overviewControls,workspacesView,grabHelper,layout,windowManager,extensionSystem}.js`,
   `js/misc/animationUtils.js` and `src/st/st-focus-manager.h`, plus mutter's
   `clutter/clutter/{clutter-backend,clutter-click-gesture}.h`. Search for every
   name in its table. The removals in 51 were in the headers, not only the JS.
3. Check that Dash to Panel and Blur my Shell have releases claiming the new
   version. Search Dash to Panel's `panel.js` for `_updateGroupedElements`,
   `_elementGroups`, `expandableIndex` and `showAppsIconWrapper`, and Blur my
   Shell's `components/appfolders.js` for `_folderIcons`, `_dialog` and
   `_viewBox`.
4. Install the zip rather than the development link: `make uninstall`, then
   `make pack`, then
   `gnome-extensions install dist/games-library@jackicus.shell-extension.zip`, then
   log out and in, and enable it. This tests what users get through the shipped
   `extension.js`, including the schema compiled on install and the `backend/`
   inside the installed copy. The dev link's entry point
   (`scripts/dev-extension.js`) and the shipped one (`src/extension.js`)
   differ, so this first pass should go through the real zip; once the UUID is
   registered, later iteration on a version-gated code path can go back to
   `make link`, since `lib/`, `prefs.js`, `stylesheet.css` and the schema are
   shared between the two paths either way.
   **Do not use `install --force` over the link.** `make link` builds the
   extension directory as a directory of links into `src/`, and `--force`
   removes the old directory with `file_delete_recursively()` (extensions-tool
   `main.c`). That enumerates with `G_FILE_QUERY_INFO_NONE`, so it follows each
   link and deletes what is in `src/`. `make uninstall` removes only the
   directory of links. `make link` puts it back afterwards. See also
   [publishing.md](publishing.md#testing-the-zip-before-uploading).
5. `make logs '10 min ago'` should be silent through enable, use and disable —
   the shipped extension logs only failures — with no `TypeError`, `Failed to
   load lib/app.js`, `The overview is not laid out as expected` or `No button
   beside Show Apps`. Testing through `make link` instead logs `Enabled from`
   on success, from `scripts/dev-extension.js`.
6. Press Rescan in the preferences. The count updates, the journal says
   `Rebuilt`, and a library that was up comes back up.
7. **The menu library.** Press the button on the desktop: the overview opens
   on the games. Press it again, then open it again and press Escape: each
   lands on the desktop. From the window picker, the button goes to the games
   and back to the picker. The row of workspaces fades out and back. Start a
   search with the games up, then clear it. Press Show Apps afterwards: it
   shows the apps.
8. **The modal library.** Set "Library opens in" to Modal. The panel zooms out
   of the button. Escape, a click on the shade and a second press each close
   it, and closing the overview under it closes it.
9. **The pop-up in `menu`.** Open a game from each library. It zooms out of
   the poster, then widens. Escape zooms it back into the poster. Closing the
   overview under it closes it.
10. **The pop-up in `modal`.** Open a game from the overview: the overview
    goes and the panel fades in centred. Open one from the modal library: that
    panel closes first. The pop-up stays up across a workspace switch, and
    Super does nothing until it is closed.
11. **Dash to Panel on and off,** through steps 7 to 10 each way. Then disable
    and enable Dash to Panel with Games Library on, and check the button comes
    back. **Blur my Shell on and off** for step 9.
12. **The keyboard** in each place: Tab and the arrows move, Enter opens,
    Escape backs out, and Page Up and Page Down turn the grid.
13. **A controller:** Guide on the desktop opens the library, and does nothing
    over a focused window or someone else's popup. The D-pad, A and B work in
    the grid and the pop-up. Unplug it and plug it back in.
14. **The shortcut:** set one in the preferences. It opens and closes the
    library from the desktop and the overview. It closes the modal library's
    panel. Over a top-bar menu it does nothing.
15. Show in Files opens the game's folder. Play really launches the game, so
    test it last, with "Play on a new workspace" on and off.
16. Lock and unlock the screen with the library up, and with nothing up. After
    the unlock the button is back, and the `Enabled from` line names the same
    stage directory as before the lock.
17. Change `columns`, `corner-radius`, "Library opens in" and "Games open in"
    with the library up. It rebuilds and stays up.
18. Disable and enable ten times. Then check that no button is left beside Show
    Apps, that Show Apps shows the apps, and that `make logs` is clean.
19. Only then add the version to `shell-version`.

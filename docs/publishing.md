# Publishing to extensions.gnome.org

How to build the upload, what goes in it, and how the extension stands against
the EGO review guidelines. The guidelines are gjs.guide's
[Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
and [Best Practices](https://gjs.guide/extensions/review-guidelines/best-practices.html).

Private API use is a separate concern with its own page,
[private-api.md](private-api.md) — this page links to it rather than
repeating what it covers.

## Building the zip

```sh
make pack
```

This runs `scripts/dev.sh pack` (`cmd_pack`, the kit's shared script), which:

1. checks the schema with `glib-compile-schemas --strict --dry-run` and stops
   if it fails — the same check an install enforces, run as part of every pack
   rather than left as a manual step;
2. copies exactly what ships into a temporary staging directory (`stage_ship`):
   `extension.js`, `prefs.js`, `metadata.json`, `stylesheet.css`, the schema
   XML, every file `scripts/ext.conf`'s `EXT_SHIP` names (`lib/*.js`,
   `backend/*.py` outside `__pycache__`, `icons/*.svg`) and the repo root's
   `LICENSE`. Nothing else under `src/` is copied, so `src/backend/CLAUDE.md`,
   bytecode and the compiled schema never reach the stage;
3. runs `gnome-extensions pack` on that stage with an `--extra-source` for each
   of `lib`, `backend`, `icons` and `LICENSE`. `gnome-extensions` adds
   `extension.js`, `metadata.json`, `prefs.js`, `stylesheet.css` and every
   `schemas/*.gschema.xml` itself (`command-pack.c`); the rest all need naming
   because none of them is one of its recognised top-level files. If the tool
   compiled the schema into the zip, that file is deleted from it;
4. diffs the stage's file list against `unzip -Z1` of the built zip, failing
   loudly and naming both what's missing and what shouldn't be there on any
   mismatch;
5. deletes the staging directory and reports
   `dist/games-library@jackicus.shell-extension.zip`.

What each shipped part is:

- **`extension.js`, `metadata.json`, `prefs.js`, `stylesheet.css`,
  `schemas/*.gschema.xml`** — the entry point and the two files
  `gnome-extensions` always looks for.
- **`LICENSE`** — GPL-2.0-or-later, copied in from the repo root at pack time.
- **`lib/`** — the shell-side implementation: the library, the two browsers,
  the detail pop-up, controls, the button beside Show Apps and its Dash to
  Panel wrap. All of it runs inside the compositor process.
- **`backend/`** — a Python 3 program (`scan_library.py`, `games_scanner.py`,
  `metadata.py`) that reads Steam's and PCSX2's own bookkeeping, fetches
  artwork and metadata online, and writes `~/.cache/games-library/library.json`.
  It is not GJS and is not spawned by `extension.js`: the preferences' Rescan
  button and `dev.sh scan` both invoke it out-of-process with `python3`. See
  [Scripts and binaries](#scripts-and-binaries-does-not-meet-as-it-stands)
  below — this is the part of the review most worth thinking about before
  uploading. `scan_library.py` keeps its executable bit in the zip; nothing
  relies on that, since it is always run as `python3 <path>`.
- **`icons/library-symbolic.svg`** — the one icon, used for the button beside
  Show Apps.

What is left out, and why it is safe to leave out:

- **`src/schemas/gschemas.compiled`** — never copied into the stage.
  GNOME 44 onward compiles the schema on install rather than expecting it in
  the zip (`extensionDownloader.js` runs `glib-compile-schemas --strict` after
  unzipping an EGO download).
- **`__pycache__/`, `*.pyc`** — `EXT_SHIP` copies `backend/*.py` only, outside
  `__pycache__`.
- **`src/backend/CLAUDE.md`** — not named by `EXT_SHIP`, so never copied.
- **`scripts/`, `README.md`, `CLAUDE.md`, `docs/`, `.claude/`, `.git`, `dist/`** — never
  part of `src/`, so never seen by the packer at all; `--extra-source` only
  reaches directories under the packed tree.

### Why the schema ships as XML only

- gjs.guide, [Port Extensions to GNOME Shell 44](https://gjs.guide/extensions/upgrading/gnome-shell-44.html):
  "GNOME Shell 44 can compile the GSettings Schemas file(s) while installing the
  extension package. In case you are using your own GSettings Schemas, you MUST
  only include the schemas/org.gnome.shell.extensions.<schema-id>.gschema.xml
  file(s) and avoid shipping the gschemas.compiled in the package (if your
  extension is only supporting GNOME Shell 44 and later)."
- The review guidelines' own GSettings rule asks only that "The Schema XML file
  MUST be included in the extension ZIP file".
- In the shell, `extensionDownloader.js` runs
  `glib-compile-schemas --strict <extension>/schemas` after unzipping an EGO
  download, and `gnome-extensions install` does the same
  (`command-install.c`). `--strict` means a schema warning is an install
  failure, which is why `cmd_pack` runs the same check before it packs
  anything (step 1 [above](#building-the-zip)).

Every claimed version (44 and later) compiles on install, so the zip carries no
compiled schema.

### Testing the zip before uploading

```sh
make uninstall
make pack
gnome-extensions install dist/games-library@jackicus.shell-extension.zip
# log out and back in, then enable it
```

Do this rather than `gnome-extensions install --force` over the development
link: `make link` builds the extension directory as a directory of links into
`src/`, and `--force` deletes the existing directory with
`file_delete_recursively()` (`main.c` in the extensions tool), which
enumerates it without `NOFOLLOW_SYMLINKS`. It follows every link, deletes what
is in `src/`, and then deletes the links themselves. `make uninstall` removes
only the directory of links, and `make link` restores it afterwards.

This is also the only way to exercise exactly what a reviewer receives: `make
link` installs `scripts/dev-extension.js` as the entry point, for
edit-without-restart during development — see [Avoid interfering with the
extension system](#avoid-interfering-with-the-extension-system-meets) below —
which is not what ships. Only an installed zip runs the real `src/extension.js`
and proves the packed `backend/` and `icons/` paths resolve the way its
`this.dir`-relative code expects.

`make install` is not the same test either. It copies the same files the zip
holds (the same `stage_ship`), but never runs the zip itself. The installed copy also runs its
own `backend/`, so press Rescan in its preferences once.

## metadata.json

Current contents:

| Key | Value | Verdict |
|---|---|---|
| `uuid` | `games-library@jackicus` | Valid characters, not under `gnome.org`. Cannot change after the first upload |
| `name` | `Games Library` | Generic, no brand in it. No extension on EGO has this name |
| `description` | one sentence | Correct as far as it goes; could say more (below) |
| `settings-schema` | set | Correct; `getSettings()` is called with no arguments in both `lib/app.js` (`GamesLibraryApp`'s constructor) and `prefs.js` (`fillPreferencesWindow`), as Best Practices asks |
| `shell-version` | `["50"]` | The only version actually booted (per [compatibility.md](compatibility.md), 48 and 49 are audited against the shell's sources, not booted, so they're not claimed yet) |
| `url` | `https://github.com/Jackicus/GNOME-Games-Library` | Set — the `origin` remote, public, so users can report problems and a reviewer can check the zip against the repository |
| `version-name` | `"1.0"` | Valid: letters, numbers, space and period only, ≤ 16 characters |
| `version` | absent | Correct — EGO assigns and increments this itself; it should never be set here |
| `session-modes` | absent | Correct — the extension only needs `user` mode and the guideline says the key "MUST be dropped" in that case |
| `donations`, `gettext-domain` | absent | Correct; neither is required |

**`shell-version`**: the guideline is that it "MUST only contain stable releases
and up to one development release. Extensions must not claim to support future
GNOME Shell versions." Add 48 and 49 once they pass the checklist in
[compatibility.md](compatibility.md); a new upload can widen the list.

**`description`** is the only place a user or reviewer learns what the
extension needs and where their data goes. It is also the only place that
explains what could look like a bug. Worth saying:

- it adds a Games button beside Show Apps, in the dash or in Dash to Panel's
  panel;
- the library is empty, and there is no button, until Rescan is pressed in the
  preferences. It finds games through Steam's own library files and the
  folders `PCSX2.ini` names. Without either, there is nothing to show. While
  the scanner is Python, it needs `python3`;
- Rescan looks games up online unless that is switched off. Steam's store and
  artwork CDN get the ids of installed Steam games. IGDB gets the titles of PS2
  discs, and only when the user has entered their own free Twitch key. Answers
  are cached in `~/.cache/games-library`;
- API keys are stored in GSettings (dconf) in plain text;
- Play starts a Steam game through Steam and a PS2 disc through PCSX2, and
  neither is included;
- game controllers are read through libmanette, when it is installed, and
  acted on only while the library is on screen. The exception is the Guide
  button, which opens it.

Multi-paragraph descriptions use `\n` literals, and `*` makes a bullet list
(review guidelines, `metadata.json` table).

## The review guidelines, item by item

### Only use initialization for static resources: meets

`src/extension.js`'s class body has no constructor, and imports only
`Extension` and a static `import` of `lib/app.js`. So `lib/`'s module scope
runs at load time, and all of it is allowed: `GObject.registerClass` calls,
constant tables, `BaseAppView` read off `AppDisplay`'s prototype, two
`Cogl.Color` constants in `panel.js` (a boxed value, not a GObject instance),
`shape.js` building its radius strings, and a few `let` holders. `GamesLibraryApp`
calls `getSettings()` and constructs `Controls` in its constructor, and it is
constructed inside `enable()`. The virtual keyboard is created in
`Controls.enable()`.

`controls.js`'s `current` is cleared in `disable()`. `shape.js`'s `styles`,
`mediaGrid.js`'s `gridAlign` and its `pendingGrid` keep the last build's few
strings and numbers. A reviewer who applies "all dynamically stored memory must
be cleared or freed in disable()" literally could ask about them.

### Destroy all objects: meets

`GamesLibraryApp.disable()` does the following, in order:

- removes the shortcut keybinding;
- drops the theme-context and settings connections;
- cancels the file monitor on `library.json`;
- removes the rebuild timer;
- calls `_teardown()`. The browser's `disable()` destroys the grids or the
  modal panel, takes back the wrapper on the overview layout, and drops its
  overview connections. The `DetailDialog` is popped down and destroyed;
- calls `LibraryButton.detach()`: the button beside Show Apps comes out of the
  dash, and the wrapper on Dash to Panel is taken back;
- calls `Controls.disable()`: settings, pads, repeat timers and the virtual
  keyboard.

Each class tears down what it built, which is what "Avoid Spaghetti Cleanup"
asks for.

One thing outlives `disable()`: **the two method wrappers**,
`_getAppDisplayBoxForState` on the overview's layout and
`_updateGroupedElements` on Dash to Panel's primary panel, but only when
another extension wrapped the same method after this one. Removing ours then
would unhook theirs, so ours stays as an inert link in their chain. It checks
that it is still hooked before doing anything, and the comments where it is put
on say why. Expect the question anyway.

Under the dev entry point (`scripts/dev-extension.js`, never shipped), the
staged copy of `lib/` in `$XDG_RUNTIME_DIR/games-library/shell-<pid>/lib-<stamp>/`
also outlives `disable()`, kept on purpose so the next `enable()` can reuse or
sweep it ([private-api.md](private-api.md#not-shell-internals-staging-lib)).

`extension.js`'s own `disable()` carries no try/catch: `this._app.disable();
this._app = null;`. A throw there reaches the shell, same as a throw from
`enable()` ([AI-generated](#extensions-must-not-be-ai-generated-know-the-code)).

### Disconnect all signals: meets, with one to tidy

Connections to the settings and to anything of the shell's (the theme context,
Show Apps, the overview and its controls, `Main.extensionManager`, Dash to
Panel, the dash) use `connectObject()`/`disconnectObject()` and are dropped in
the owner's `disable()`. The stage's `captured-event::key` handler in
`MediaMenu._force()` keeps its id and is disconnected in `_unforce()`, which
`disable()` calls. Plain `connect()` calls are on the extension's own actors,
or on objects they hold, so they go when those actors are destroyed.

The exception is the `Gio.FileMonitor` on `library.json` in
`GamesLibraryApp.enable()`, which no actor holds. Its `changed` handler is
connected with plain `connect()`. `disable()` cancels the monitor and drops it,
which stops the handler, but never disconnects it. A reviewer reading line by
line will ask. `connectObject(..., this)` and `disconnectObject(this)` fix it.

The preferences connect their settings handlers per window and never disconnect
them on `close-request`. The rules concern `disable()`, not the preferences, so
this is tidying.

### Remove main loop sources: meets

Each source is removed, or checked for, right before a new one is created, and
removed again on the way out, as "Keep Timeout Removal Next to Creation" asks:

| Source | Where | Removed |
|---|---|---|
| rebuild timer | `GamesLibraryApp._scheduleRebuild()` | right before creation; `disable()` |
| repeat timers for a held direction | `Controls._hold()` | `_release(id)` right before creation; `_stopPads()` from `disable()` |
| second-column idle | `DetailView.populate()` (`_deferredMain`) | `_cancelDeferred()` at the top of `populate()`; `_addMain()`; `_cancelDeferred()` from `destroy()` |
| list timer | `DetailView._fillList()` | guarded before creation; `_cancelDeferred()` from `destroy()` |
| top-up idle | `lazyList.js` `fillOnScroll()` `topUp` | guarded before creation; on the scroll view's `destroy` |
| reopen idle | `MediaMenu`'s `hidden` handler (`_reopenId`) | guarded before creation; `disable()` |

The blur's `Clutter.Timeline` (`anim.js` `easeProps()`) is not a GLib source.
The panel stops it in `_onDestroy()`. Nothing in `extension.js` or `prefs.js`
adds a source.

### Do not use deprecated modules: meets

There is no `ByteArray`, `Lang`, `Mainloop` or `imports.*`, and no
`run_dispose()`. Text is decoded with `TextDecoder`.

### No GTK in the shell, no shell libraries in the preferences: meets

The shell side imports Gio, GLib, GObject, Clutter, Cogl, Meta, Mtk, Shell, St,
Pango and Atk, plus Manette when it is installed. It imports no Gtk, Gdk or
Adw. `prefs.js` imports Adw, Gtk, Gdk, Gio, GLib and Pango, plus Manette when
it is installed. It also imports `lib/library.js` (Gio and GLib only) and
`lib/actions.js` (no imports; its header says it is shared and "nothing but
data"). Neither imports Clutter, Meta, St or Shell.

Best Practices suggests a `prefs/` directory for modules only the preferences
load. There are none yet, but `prefs.js` is 1,232 lines, and splitting it into
`prefs/` modules would also answer "Modules are Better Than a Single File".
That is optional.

### Avoid interfering with the extension system: meets

The rule: "Extensions which modify, reload or interact with other extensions or
the extension system are generally discouraged. While not strictly prohibited,
these extensions will be reviewed on a case-by-case basis and may be rejected
at the reviewer's discretion." One thing could be read this way, and it is
never in what ships:

`scripts/dev-extension.js`, the entry point `make link` installs in place of
`src/extension.js`, hashes `lib/` on every `enable()`, copies it into
`$XDG_RUNTIME_DIR/games-library/shell-<pid>/lib-<stamp>/`, deletes this shell's
other stages and those of shells that are gone, and imports `app.js` from the
copy with a dynamic `import()`. The purpose is to defeat GJS's module cache
during development. It is not in the zip: `make pack` (`scripts/dev.sh
cmd_pack`) fails the build on any file it did not stage, and the release
workflow checks the zip for it by name — see [private-api.md](private-api.md#not-shell-internals-staging-lib).
The shipped `src/extension.js` has none of this: a plain, static `import` of
`lib/app.js`.

**Dash to Panel.** `libraryButton.js` reads `global.dashToPanel`, listens
for its `panels-created` and for `Main.extensionManager`'s
`extension-state-changed`, and wraps `_updateGroupedElements` on Dash to
Panel's primary panel so the Games button sits after Show Apps. That is
interacting with another extension. It is defensible. It serves a common
setup, the wrapper chains and comes off only while it is outermost, and
without Dash to Panel the button goes into the dash. Anything unexpected in
`_attach()` is caught and warned about. Expect a question, and answer it in
the description ("adds its button to Dash to Panel's panel when that is
enabled"). [private-api.md](private-api.md) has the details.

### Code must not be obfuscated: meets

This is plain ES modules, unminified. Three lines in `prefs.js` exceed Best
Practices' 200-character limit. They are the long description strings for the
Games page's Files group and the Controls page's key and controller groups.
Split them.

### No excessive logging: meets

"The log should only be used for important messages and errors." Three lines
used to be written when nothing was wrong — `Enabled from <stage dir>`,
`Rebuilt` in `GamesLibraryApp._scheduleRebuild()`, and the missing-libmanette
notice in `Controls._startPads()` — and all three now go through
`lib/log.js`'s `note()`, which only `scripts/dev-extension.js` turns on. The
shipped extension calls `setVerbose()` nowhere, so `note()` is a no-op and
these lines never reach the journal; every `console.*` call left in the shipped
code is on a failure path. `Enabled from` is also gone from the shipped path
entirely — only the dev entry point logs it, since only it stages anything to
name.

### Extensions should not force dispose a GObject: meets

There is no `run_dispose()`.

### Scripts and binaries: does not meet as it stands

This is the item most likely to stop the first upload. The rule:

> Use of external scripts and binaries is strongly discouraged. [...]
> Scripts MUST be written in GJS, unless absolutely necessary [...] Scripts
> must be distributed under an OSI approved license.
> Reviewing Python modules, HTML, and web JavaScript dependencies is out of
> scope for extensions.gnome.org. Unless required functionality is only
> available in another scripting language, scripts must be written in GJS.

The zip ships `backend/`, three Python modules of about 1,500 lines
(`scan_library.py`, `games_scanner.py`, `metadata.py`). The preferences' Rescan
button (`prefs.js` `_scanButton()`) runs
`python3 <extension>/backend/scan_library.py --from-settings` with
`Gio.Subprocess`. The scanner runs `gsettings` to read the settings, credentials
included, and goes online. The shell process never runs it; it only reads the
`library.json` the scanner writes.

Against each part of the rule:

- **No binaries or libraries:** meets. It is source only. Pillow is used if it
  happens to be installed, and nothing installs it, which is also what "MUST
  require explicit user action" for pip asks.
- **"Processes MUST be spawned carefully and exit cleanly":** mostly. It is an
  argv array with no shell, awaited with `communicate_utf8_async()`, and
  `gsettings` has a 10-second timeout. There is no cancellable, though, so a
  scan outlives a preferences window closed halfway through. It writes
  atomically under `flock`, so nothing is left half-written. A
  `Gio.Cancellable` and `force_exit()` on `close-request` would close that gap.
- **GJS unless absolutely necessary:** does not meet. The scanner parses
  Valve's text VDF/ACF files and `PCSX2.ini`, speaks HTTPS and JSON, and scales
  images. GJS can do all of that, with `Soup` 3 for HTTPS and `GdkPixbuf`
  for scaling, and the scanner already falls back to GdkPixbuf. A reviewer
  cannot review the Python, by the rule's own words, and will ask for a port.
- **OSI licence:** meets. `LICENSE` (GPL-2.0-or-later, OSI-approved) is at the
  top of the repo and ships in the zip ([Licensing](#licensing-meets)).

The fix is a GJS port. It can be a script under `backend/` run by the
preferences as now (`gjs -m <path>`). Or it can run in the preferences process
itself, asynchronously, which avoids a subprocess altogether, as the Best
Practices section on subprocesses prefers. The `flock` that keeps two scans
apart becomes a lock file created exclusively (`Gio.File.create()`), or goes
away if the preferences are the only writer. The alternative is to ship
without `backend/` and have users install the scanner separately. That leaves
the extension doing nothing on its own, which runs into [Extensions must be
functional](#extensions-must-be-functional-a-risk-worth-knowing).

### Clipboard, privileged subprocesses, telemetry: meets

There is no clipboard access, nothing runs through `pkexec` or with more
privilege than the user's, and there is no analytics or tracking. Going online
is covered next.

### Network, input and user data: meets; say it in the description

There is no rule against going online. The rule is "Extensions MUST NOT use any
telemetry tools to track users and share the user data online", and nothing
here tracks anyone. The shell process makes no network requests. The scanner
does, and only when Rescan is pressed (or `make scan`) with `games-online` on,
which is the default. It sends:

- to Valve, the app id of each installed Steam game not already cached
  (`store.steampowered.com/api/appdetails`). For games whose library art the
  Steam client has not cached itself, it fetches that art from
  `cdn.cloudflare.steamstatic.com`. No key is sent;
- to Twitch and IGDB, only when the user has entered a key: the key itself to
  `id.twitch.tv` for a token, the cleaned-up title of each PS2 disc not already
  cached to `api.igdb.com`, and requests for cover art to `images.igdb.com`.

Every request carries the User-Agent `GamesLibrary/1.0`. None of it is telemetry,
but it is the user's game list going to third parties, so the description
should say so.

**Credentials.** No guideline covers storing API keys. They sit in the
`credentials` setting (`a{ss}`), in dconf, in plain text. The README and a
comment in the schema say so. The preferences do not, although their entries
are `Adw.PasswordEntryRow`s. Reviewers sometimes suggest libsecret for secrets,
but nothing requires it. A sentence under the Sources group would put the
warning where the key is typed. Two smaller points:

- `_igdb_access_token_locked()` in `metadata.py` puts the client secret in the
  token URL's query string. Twitch's token endpoint takes the same fields as a
  form-encoded body, which keeps the secret out of any URL.
- `prefs.js` `_keyDropFile()` looks for `~/Documents/keys/IGDB/CLIENT ID.txt`
  and `CLIENT SECRET.txt` and offers an Import button when they exist. It is
  harmless: the button appears only if the file does, and nothing is read
  until it is clicked. But it is a personal convention in shipped code, and a
  reviewer may ask why the preferences read files in Documents. Drop it from
  the shipped preferences, or make it a file chooser.

**Input.** `Controls` reads every game controller through libmanette. It acts on
one only while the library is on screen, except for Guide, which opens it only
when no window has the focus and no modal grab is up. It also creates a Clutter virtual keyboard
(`create_virtual_device`), which it uses to replay the arrow keys, Enter and
Escape for a remote or a pad while the library holds the keyboard. Synthesised
input draws a reviewer's eye. The header of `controls.js` explains it, and the
description should mention controllers.

**Launching.** Play calls `Util.spawn(argv)` in the shell (`app.js`
`openPath()`), with the argv read from `library.json`. It is either
`xdg-open steam://rungameid/<appid>` or a PCSX2 binary with
`-fullscreen -- <disc>`. The binary can be an AppImage the scanner found in
`~/Downloads`, among other places. There is no shell, and it runs only on the
user's press. But `normalizeGame()` checks only that it is an array of
non-empty strings, so whatever writes `~/.cache/games-library/library.json`
decides what Play runs. That is the user's own privilege, not an escalation,
but a reviewer reading `Util.spawn(path)` fed from a JSON file will ask. Two
small changes settle it:

- build the argv in the shell, from the platform, a digits-only app id and the
  disc path;
- open `steam://` with `Gio.AppInfo.launch_default_for_uri_async()`, as Show
  in Files already does, instead of spawning `xdg-open`. Best Practices asks
  to "Avoid spawning external shell commands where possible".

### Extensions must be functional: a risk worth knowing

"Extensions which serve no purpose or have no functionality will also be
rejected." On a fresh install, this extension shows nothing at all. No
`library.json` exists until Rescan is pressed in the preferences. A library with
no games gets no button (`GamesLibraryApp._build()` detaches it), and the
shortcut opens a browser with nothing in it. A reviewer's virtual machine is unlikely to have Steam or PCSX2 with
games in it. So even after Rescan they see no change, and may report it as
doing nothing.

Mitigations, in order of cost:

- say what it needs in the description (Steam or PCSX2 with games installed,
  Rescan in the preferences), and put a screenshot on the EGO page;
- show the button with an empty library, opening onto "Nothing indexed yet",
  which `libraryCountLabel()` already says, and pointing at the preferences.
  This changes the rule that an empty library gets no button, so it is a
  decision, not a fix;
- run the first scan when the preferences are first opened.

### Extensions must not be AI-generated: know the code

The rule is that the developer "should be able to justify and explain the code
they submit, within reason". Submissions with "large amounts of unnecessary
code, inconsistent code style, imaginary API usage, comments serving as LLM
prompts, or other indications of AI-generated output will be rejected". Best
Practices lists the patterns reviewers look for. None of the notices it
describes ("Generated with AI…") is in the code. The style is consistent. What
a reviewer would find:

- **Comments.** File headers run 10 to 30 lines, and several cite the shell's
  own source by file (`mediaGrid.js`, `mediaMenu.js`, `panel.js`, `widgets.js`,
  `libraryButton.js` and `libraryWindow.js`). They explain why rather than
  what, which is what the guidelines want, and none of them cite a line number
  any more — those would go stale with every GNOME release and read as
  generated, so only the file and the function or concept are named.
- **Optional chaining on guaranteed APIs** ("Avoid Unnecessary Checks"):
  - `scroll.vadjustment ?? scroll.get_vadjustment?.()` in `lazyList.js`
    `fillOnScroll()`: `St.ScrollView` has `vadjustment` in every claimed
    version;
  - `surface?.inhibit_system_shortcuts?.(null)` and
    `restore_system_shortcuts?.()` in `prefs.js` `_captureShortcut()`: both
    are `Gdk.Toplevel` methods in GTK 4;
  - `this._device?.notify_keyval()` in `Controls._press()`: the device exists
    whenever `Controls` is enabled;
  - `actor.ensure_style?.()` in `anim.js` `ensureStyleDeep()` is correct,
    since plain `Clutter.Actor` children have no `ensure_style`, but
    `if (actor instanceof St.Widget)` says so.

  The rest are acceptable. Some are on private shell paths and Dash to Panel,
  where they are how the code degrades ([private-api.md](private-api.md)).
  Some are on parts `disable()` may find missing, or on optional callbacks
  (`beforeLaunch?.()`, `onActivate?.()`, `onComplete?.()`, `this._prepare?.()`).
  The `Clutter.ClickGesture` test in `MediaPanel._addClickAway()` is a real
  48-versus-49 branch, and goes if 48 is dropped.
- **try/catch that only swallows** ("Avoid Unnecessary try-catch Wrappers").
  The shipped `extension.js` no longer has one: `enable()` and `disable()` are
  a plain, static `import` with no try/catch, so a throw from either reaches
  the shell. `scripts/dev-extension.js`, the dev-only entry point, still
  catches everything in its `enable()` and logs it — reasonable there, since
  its job is surviving a bad `import()` across edits, and it never ships. One
  wrapper remains in the shipped code:
  - the `release` of `LibraryButton._attachToDash()` wraps
    `dash.disconnectObject(this)` and `destroy()` in an empty catch. That is
    Best Practices' own example of a wrapper that is not needed.

  Those that remain handle real failures: reading `library.json`, listing the
  art folders, creating the file monitor, opening a folder, loading libmanette,
  reading a key file, starting the scanner, and Dash to Panel's
  `updateElementPositions()` on a panel that may be going away.
- **Lifecycle flags** ("Lifecycle and Destruction State"). `this._enabling`
  exists only in `scripts/dev-extension.js`, because staging makes its
  `enable()` async; the shipped `extension.js` is synchronous and has no such
  flag. `Controls._starting` guards the async libmanette import against a
  `disable()` that lands during it; that is a real race, so keep it.
  `released` in `LibraryButton._attachToPanel()` is set by the box's
  `destroy` so the box is not destroyed twice when Dash to Panel has already
  taken it down. It is close to the `this._destroyed` pattern the page warns
  about, so be ready to explain it.
- **A Unicode star as an icon.** `DetailView` shows the rating as
  `` `★ ${item.rating}` `` in a pill. Best Practices ("Icons vs. Emojis") asks
  for `St.Icon` rather than Unicode symbols; `starred-symbolic` is the shell's.

### metadata.json must be well-formed: meets

`version` is absent and `url` is set. See [the table above](#metadatajson).

### Session modes: meets

There is no `session-modes`, so the extension runs in `user` only. On lock it
is disabled. The keybinding is removed, controllers are let go, and the library
and the pop-up close. Nothing of it runs on the lock screen, so a controller's
Guide button does nothing there. On unlock it is enabled again. The
alternative, `unlock-dialog`, "MUST be necessary for the extension to operate
correctly", and it is not.

### GSettings schemas: meets

The ID `org.gnome.shell.extensions.games-library` and the path
`/org/gnome/shell/extensions/games-library/` use the required bases. The file is
named `<schema-id>.gschema.xml`, the XML is in the zip, and no compiled schema
ships. `glib-compile-schemas --strict --dry-run src/schemas` passes.

The `<schemalist>` carries no `gettext-domain`. It used to carry
`gettext-domain="gnome-shell-extensions"`, the domain of GNOME's own extensions
package rather than this one's — dropped rather than renamed, since nothing
here is translated.

### Licensing: meets

GNOME Shell is GPL-2.0-or-later and "derived works like extensions MUST be
distributed under compatible terms". The Python scripts also need "an OSI
approved license" while they ship. `LICENSE` (the GPL-2.0 text; the project is
GPL-2.0-or-later) is at the top of the repo, and `cmd_pack` copies it into the
staging directory and names it with `--extra-source=LICENSE`, since
`gnome-extensions pack` adds no licence file by itself and only packs what is
in the staged copy.

`panel.js` says it is the shell's `AppFolderDialog` with the folder taken out.
Whatever came from `appDisplay.js` is GNOME Shell's GPL-2.0-or-later code, which
a compatible licence covers. Naming GNOME Shell as the source in that file's
header is the attribution.

### Copyrights and trademarks: meets, with care over screenshots

"Extensions MUST NOT include copyrighted or trademarked content without proof
of express permission from the owner", and the examples are brand names, logos
and artwork, and multimedia.

- **The name** is generic.
- **Brand names.** The description and the UI name Steam, PlayStation 2, PCSX2,
  IGDB, Twitch and Xbox, to say what the extension reads and which pads work.
  That use describes compatibility rather than branding the extension. EGO
  already lists extensions with Steam in their names (Add to Steam). Expect at
  most a request to reword. Keep logos out.
- **Artwork.** The zip ships no game artwork: its files are code, the schema,
  the stylesheet, which has no `url()`, and one icon, the button's gamepad
  (`icons/library-symbolic.svg`, a single path drawn for this extension). The
  preferences' page icons are the theme's, and placeholders are drawn in
  `widgets.js`.
  Covers and backdrops arrive at runtime on the user's machine, copied from the
  Steam client's own cache and PCSX2's covers folder or downloaded from Valve's
  CDN and IGDB. The Code of Conduct section allows for that ("extensions may be
  used to download, access or operate on external content"). What it governs is
  what is "distributed from GNOME infrastructure": the zip, the name, the
  description and the screenshots.
- **Screenshots** are therefore the one place EGO would distribute commercial
  cover art, since a screenshot of a real library is a grid of publishers'
  artwork. The ones in `docs/screenshots/` avoid the question: they are of a
  made-up library, invented games with artwork drawn by
  `scripts/demo_library.py`, taken with `./scripts/nested.sh start
  --stand-in`. Use those, or new ones taken the same way.

### IGDB attribution: still open

IGDB's terms require crediting them wherever their data is shown, not only
where it is fetched. Nothing in the preferences or the library currently says
so: a PS2 disc's title, synopsis and cover art can all come from IGDB
(`metadata.py`), and the UI shows them exactly as it shows Steam-sourced data,
with no attribution attached. Add "Games metadata is powered by IGDB.com",
linked to `https://www.igdb.com`, wherever IGDB-sourced data appears — the
detail pop-up for a PS2 disc at minimum, and the Games preferences page.

### Don't include unnecessary files: meets

The zip holds what runs: the entry points, `lib/`, `backend/`, `icons/`, the
stylesheet, the schema and `LICENSE`. Only what `scripts/ext.conf`'s
`EXT_SHIP` names is staged, so bytecode and notes never are, and `make pack`
fails on any file missing from the zip or in it that should not be ([Building the zip](#building-the-zip)).

### Use a linter: meets

`eslint.config.mjs` is gjs.guide's recommended GJS configuration, run with
`make lint`. It reports zero errors; the warnings it leaves (chained
assignment, one function over the complexity threshold) are the kind Best
Practices treats as judgement calls rather than rules.

## Private API

Everything the extension reaches into, what it is for, and what happens when a
future GNOME changes it is in [private-api.md](private-api.md). Reviewers accept
private API with a reason. What they look for is that it fails safely. Most of
it does:

- `MediaMenu.enable()` checks for the overview's controls, the app display and
  its `_box`, and warns and draws nothing without them;
- `_foldWorkspaces()` checks that `_getAppDisplayBoxForState` is a function;
- `LibraryButton._attach()` falls back from Dash to Panel to the dash, and
  catches a failed attach;
- `panel.js` `folderLook()` falls back to the stock shade.

The part that is not checked is `mediaGrid.js`, which subclasses `BaseAppView`
(read as `AppDisplay`'s prototype), `AppGrid`, `AppViewItem`, `IconGridLayout`
and `BaseIcon` at module scope. A change there makes the static `import` of
`lib/app.js` throw, which becomes an error shown in the Extensions app — what
reviewers want, since the shipped `extension.js` has no try/catch of its own to
hide it.

## The development entry point

GJS caches a module by URL for the life of the shell, so an edit under `lib/`
is not picked up without logging out, unless `lib/` is imported from a new URL
each time. That staging is not in what ships: it lives entirely in
`scripts/dev-extension.js`, which `make link` installs as `extension.js` in the
development install, and it never reaches a reviewer or an EGO download. The
shipped `src/extension.js` is a plain, static `import` of `lib/app.js`, with
synchronous `enable()`/`disable()` and no try/catch — see [Avoid interfering
with the extension system](#avoid-interfering-with-the-extension-system-meets)
above, [private-api.md](private-api.md#not-shell-internals-staging-lib) for how
the dev entry point stages `lib/`, and the comment at the top of
`scripts/dev-extension.js` for the full mechanism.

Because the two entry points differ, test the shipped one from an installed
zip, not from the development link
([Testing the zip](#testing-the-zip-before-uploading)).

## Things a reviewer will notice, and the minimal fix

1. **The Python scanner.** Port it to GJS
   ([Scripts and binaries](#scripts-and-binaries-does-not-meet-as-it-stands)).
   This is the likeliest rejection.
2. **First run.** Say in the description what it needs, add a screenshot (from
   `docs/screenshots/`), and decide whether an empty library should still get
   its button
   ([Extensions must be functional](#extensions-must-be-functional-a-risk-worth-knowing)).
3. **IGDB attribution.** Show "Games metadata is powered by IGDB.com", linked,
   wherever IGDB-sourced data appears
   ([above](#igdb-attribution-still-open)).
4. **Checks and wrappers.** Remove the `?.` on `vadjustment`,
   `inhibit_system_shortcuts`, `restore_system_shortcuts` and `_device`, and
   use `instanceof St.Widget` in `ensureStyleDeep()`. Remove the empty catch
   around `disconnectObject()`/`destroy()` in `_attachToDash()`.
5. **Play.** Build the argv in the shell from the platform, the app id and the
   disc. Open `steam://` with `Gio.AppInfo.launch_default_for_uri_async()`
   rather than spawning `xdg-open`.
6. **The file monitor.** Use `connectObject()`/`disconnectObject()` for its
   `changed` handler.
7. **Small ones:**
    - replace the `★` with an `St.Icon`;
    - split the three over-long strings in `prefs.js`;
    - send the IGDB secret in the POST body, not the token URL's query string;
    - say in the preferences that keys are stored in plain text;
    - drop or rework the `~/Documents/keys` import;
    - give the Rescan subprocess a cancellable;
    - disconnect the preferences' settings handlers on `close-request`;
    - replace `Gtk.show_uri()`, deprecated since GTK 4.10, with
      `Gtk.UriLauncher`;
    - optionally, split `prefs.js` into a `prefs/` directory.

## Uploading

- **Web:** log in at https://extensions.gnome.org/upload/, choose
  `dist/games-library@jackicus.shell-extension.zip`, and accept the terms.
- **Command line** (gnome-extensions 49 and later; gjs.guide,
  [Port Extensions to GNOME Shell 49](https://gjs.guide/extensions/upgrading/gnome-shell-49.html)):
  `gnome-extensions upload --accept-tos dist/games-library@jackicus.shell-extension.zip`.
  It prompts for the EGO username and password. `--user`, `--password` and
  `--password-file` exist for CI. gjs.guide warns that "Using the password in
  a command option risks exposing it in logs, the environment or the
  filesystem."

Each upload is reviewed before it is published, and review comments arrive on
the extension's EGO page. EGO numbers each upload in `version`, which is why
the file should not set it.

Before every upload:

1. Bump `version-name`.
2. Run `glib-compile-schemas --strict --dry-run src/schemas`.
3. Run `make pack`, and read `unzip -l dist/games-library@jackicus.shell-extension.zip`.
4. Run `make uninstall`, install that zip, log out and back in, press Rescan in
   its preferences, and go through the checklist in
   [compatibility.md](compatibility.md) on each version you claim.
5. Confirm `make logs` is quiet through enable, use, lock, unlock and disable.

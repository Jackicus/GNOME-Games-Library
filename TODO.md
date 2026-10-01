# To do

## A GJS backend beside the Python one

The library scan runs as Python (`src/backend/*.py`). The extensions.gnome.org
review guidelines say scripts "must be written in GJS unless absolutely
necessary", so a reviewer is likely to ask why it is Python.

The plan is to add a GJS backend, not to replace the Python one:

- Both backends stay in the extension and write the same `library.json`, in the
  same format, to `~/.cache/games-library/`.
- A setting, `scan-backend` (`gjs` | `python`), chooses which one Rescan runs.
  Python stays available for the best performance; GJS is the one with no
  dependency beyond the shell itself.
- Once the GJS backend matches the Python one, compare them and decide whether
  to keep both, make GJS the default, or drop Python.

### What the Python backend does

| File | Job |
|---|---|
| `scan_library.py` | CLI entry (`--from-settings`, `--steam-path`, `--pcsx2-path`, `--sources`, `--offline`, `--out`); reads the settings, runs the scanner, enriches every game on a thread pool, writes a fresh `library.json` (no merge with the previous one) under a file lock (`fcntl`), then prunes the art cache |
| `games_scanner.py` | Finds installed games: Steam's library files (`libraryfolders.vdf`, `appmanifest_*.acf`) and PCSX2's PS2 disc images and ini |
| `metadata.py` | Steam store details and artwork for Steam games; IGDB (Twitch OAuth token, then the IGDB API) for PS2 discs; downloads and scales artwork into the cache; thread-safe for the scanner's pool |

Rescan runs it from `src/prefs.js` (`python3 backend/scan_library.py …`). The
shell side only reads `library.json` (`src/lib/library.js`).

### GJS equivalents

| Python | GJS |
|---|---|
| directory listing | `Gio.File.enumerate_children_async` |
| reading `.vdf` / `.acf` / `.ini` | `Gio.File.load_contents_async` plus a small parser (VDF is a simple nested key/value format) |
| `urllib.request` | `Soup.Session.send_and_read_async` (Soup 3) |
| `concurrent.futures` threads | concurrent async requests, capped at the same limit |
| `json` | `JSON.parse` / `JSON.stringify` |
| writing files | `Gio.File.replace_contents_async` (atomic rename) |
| `fcntl` lock | a lock file created with `Gio.File.create` (`G_IO_ERROR_EXISTS` means held), or run the scan inside the preferences process only |
| `hashlib` | `GLib.compute_checksum_for_string` |
| reading settings | `Gio.Settings` directly |

### Steps

- [ ] Write the GJS backend as modules the preferences import directly
      (e.g. `src/prefs/scan/*.js`), since it runs in the preferences process
      and needs no subprocess. It must not import St, Clutter or `ui/`.
- [ ] Port `games_scanner.py`: the Steam library and manifest parsing and the
      PCSX2 disc scan, with the same item ids so the cache carries over
      between backends.
- [ ] Port `metadata.py`: Steam store lookups, the IGDB token and queries (send
      the client secret in the POST body), the art cache layout.
- [ ] Port `scan_library.py`: the atomic write, the lock, the cache prune.
- [ ] Add the `scan-backend` setting, and a row for it in the preferences.
- [ ] Make the preferences run whichever backend the setting names.
- [ ] Check both backends give the same `library.json` for the demo library
      (`scripts/demo_library.py`) and for a real one; diff the two files.
- [ ] Time a full scan and a rescan with each, and write the numbers here.
- [ ] Name the new files in `scripts/ext.conf`'s `EXT_SHIP` (what `make pack` ships), and
      `docs/publishing.md` ("Scripts and binaries").

### Done when

Rescan works with either backend, both produce the same library, and the
timings are recorded so the default can be chosen.

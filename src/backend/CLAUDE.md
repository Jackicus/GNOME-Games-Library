# Backend

The kit's `live-session.md` rules on secrets and online scans apply here: never print a
key, never run `--from-settings` to test (Gotchas below).

`scan_library.py` is the entry point: it scans (`games_scanner.py`), enriches each game
on a pool of `ENRICH_WORKERS` threads (`metadata.py`; nearly all of it is waiting on
other people's servers), and writes `library.json` to a `.tmp` and `os.replace`s it in,
under an `flock`, so two scans never write over each other and the shell's file monitor
never sees half a file. Under `--from-settings` it reads the preferences itself (paths,
`games-sources`, `games-online`, `credentials`), so which setting becomes which flag is
decided here alone; the Rescan button and `./scripts/dev.sh scan` both just run it.

Artwork is scaled on the way into the cache (`POSTER_BOX`, `BACKDROP_BOX`) and the cache
is pruned after each scan, but only when writing the real `library.json`: a run with
`--out` elsewhere shares the one cache, and would prune artwork the real library names.

## Games

**A game library is not a folder of media**, so `games_scanner.py` reads the
launchers' own bookkeeping instead: `steamapps/libraryfolders.vdf` for every
library root and appid, one `appmanifest_<appid>.acf` per title,
`userdata/*/config/localconfig.vdf` for playtime, and `PCSX2.ini` for the PS2
game folders and the covers folder. Steam roots and the PCSX2 config folder
are auto-detected, so a bare `scan_library.py` scans both and `--steam-path` /
`--pcsx2-path` only override that; a machine without Steam, or with PCSX2
installed but never launched, yields an empty list rather than an error.
Proton, the Steam Linux Runtimes and the shared redistributables are skipped.
Both roots are resolved from `~`, so a run with `HOME` pointed somewhere else
finds neither unless it is named.

Steam art is the client's own `appcache/librarycache` when it has cached it
and the keyless `cdn.cloudflare.steamstatic.com` when it has not; the keyless
store API adds the synopsis, genres, year and Metacritic score. PS2 games use
PCSX2's own cover (matched by title or serial) and fall back to IGDB. A game's
source is chosen by its platform, not by the order of `games-sources`; the
order only decides which IGDB credential slot is tried first. A list entry is a
source with a **credential slot**: `igdb` is `igdb@1`, `igdb@2` a second key tried
when the first fails or finds nothing. Slots live in the `credentials` setting
(`a{ss}`; IGDB's Twitch client id and secret tab-separated in one slot, and
`prefs.js` declares the same fields). A source whose slot is empty skips itself,
which is why IGDB sits unkeyed in the default list. Only a standalone run falls
back to `$GAMES_LIBRARY_IGDB_CLIENT_ID` / `$GAMES_LIBRARY_IGDB_CLIENT_SECRET`;
never argv. A cached record keeps the source that answered (`provider`), so a game
already answered is not fetched again; `games-online` off reads the cache only.

Launching is an argv list in the item — `xdg-open steam://rungameid/<appid>`,
or the PCSX2 binary with `-fullscreen -- <disc>` — which `lib/app.js`
`openPath` runs as it is. A PS2 disc with no PCSX2 binary found has no
`launch`, and the detail pane shows no Play button for it.

Every scan re-reads everything: there is no per-item `scan_sig` reuse and no
merging with the previous library — a Steam manifest is one small file, and
there is nothing to walk.

`metadata.py` holds `path_key` and `cache_local_art`, and `games_scanner.py`
imports them; the scanner never imports the other way round.

## Gotchas

- **Steam's store API answers bursts with HTTP 429.** `_fetch` backs off and
  retries a few times. A game whose store lookup still fails is cached with
  its artwork and no synopsis — `enrich` saves whatever answered — and the
  cached record is what later scans use, so it stays without one until the
  record is dropped from `~/.cache/games-library/metadata/index.json`.
- **Never run `--from-settings` to test.** It reads the real GSettings,
  credentials included. Test with explicit paths, `--offline`, and `HOME`
  pointed at a scratch directory so nothing lands in the real cache (the cache
  folder is `os.path.expanduser`'d, so `HOME` decides it).

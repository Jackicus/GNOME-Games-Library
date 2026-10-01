---
description: Re-index the user's installed games and download artwork, into the real cache (only when the user asks)
disable-model-invocation: true
allowed-tools: Bash(make scan), Bash(./scripts/dev.sh scan), Bash(./scripts/dev.sh status)
---

Re-index the user's own games library. This is real, not a test: it writes
`~/.cache/games-library/`, which the user's own shell (and a nested shell without
`--stand-in`) rebuilds from, and with `games-online` on it goes to the network with
the user's own keys. Run it only because the user asked (typing this command is
that); a change is tried against `./scripts/nested.sh start --stand-in`,
which needs no scan.

1. Run `make scan`. The scanner reads the preferences itself (`--from-settings`):
   Steam's own library files (every library in `libraryfolders.vdf`, including
   ones on other drives) and the folders `PCSX2.ini` points at. `steam-path` and
   `pcsx2-path` are empty ("auto-detected") unless someone has overridden them.
   Steam games are looked up in Steam's keyless store and artwork CDN; PS2 discs
   use PCSX2's own covers and fall back to IGDB, whose Twitch client id/secret
   is a credential slot in the `credentials` setting: never print it. "no
   credential set, skipping it" in the output is IGDB without a key stepping
   aside, not an error. With `games-online` off it reads the cache and stays off
   the network.
2. Report the count and the Steam/PS2 split from the scanner's output; never
   paste the titles into a commit or a public place.
3. Nothing else is needed: a running Games Library watches `library.json` and
   rebuilds itself when the file lands (the user's own shell, if they have it
   enabled; a nested shell under `--stand-in` reads its own made-up cache and does
   not change).

"PCSX2: nothing found" is normal on a machine with no PS2 discs: PCSX2 writes
its ini on first launch, and until then there is nothing to read. An HTTP 429
from the Steam store is rate-limiting; `metadata.py` backs off and retries.

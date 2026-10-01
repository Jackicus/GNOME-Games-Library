# Games Library's own dev.sh commands, sourced by the kit's scripts/dev.sh.
#
#   ./scripts/dev.sh scan [ARGS]
#                               scan the installed games into ~/.cache/games-library,
#                               as the preferences' Rescan does (--from-settings: the real
#                               keys, online unless games-online is off); ARGS are passed
#                               through, e.g. --offline
#   ./scripts/dev.sh scanner    the Python byte-compiled, and the scanner run --offline
#                               against an empty scratch HOME (part of 'check')
#   ./scripts/dev.sh stalls [LOG]
#                               watch for desktop freezes: shell main-loop stalls,
#                               processes stuck in the kernel and automount triggers,
#                               with timestamps (default log: dist/stalls.log)
#
# shellcheck shell=bash

CACHE_DIR="$HOME/.cache/games-library"

# Scan the installed games. The scanner reads the preferences itself
# (--from-settings), so which setting becomes which flag is decided in exactly
# one place rather than here and in the preferences' Rescan button as well.
cmd_scan() {
    require python3
    compile_schemas
    # The API keys are read straight out of the preferences by the scanner,
    # along with everything else --from-settings covers, so nothing has to be
    # handed to it here and no key ever reaches a command line.
    python3 "$SRC_DIR/backend/scan_library.py" --from-settings "$@"
}

# What make check runs for the scanner, with no shell, display or network, so CI
# runs it as well: every Python file byte-compiled, and the scanner run
# --offline with HOME pointed at an empty scratch directory, where it must find
# nothing and still write a library that its own loader reads back. Nothing is
# written in the checkout.
cmd_scanner() {
    require python3
    local tmp
    tmp=$(mktemp -d)
    # shellcheck disable=SC2064  # expanded now, on purpose
    trap "rm -rf '$tmp'" RETURN
    PYTHONPYCACHEPREFIX="$tmp/pycache" python3 -m py_compile \
        "$SRC_DIR"/backend/*.py "$REPO_DIR"/scripts/*.py || die "A Python file does not compile."
    ok "The Python compiles."

    mkdir -p "$tmp/home"
    HOME="$tmp/home" PYTHONDONTWRITEBYTECODE=1 \
        python3 "$SRC_DIR/backend/scan_library.py" --offline >"$tmp/scan.log" 2>&1 \
        || { cat "$tmp/scan.log" >&2; die "The offline scan failed."; }
    local found
    found=$(PYTHONDONTWRITEBYTECODE=1 python3 -c '
import sys
sys.path.insert(0, sys.argv[1])
from scan_library import load_existing
print(len(load_existing(sys.argv[2]).get("games", [])))' \
        "$SRC_DIR/backend" "$tmp/home/.cache/games-library/library.json") \
        || die "The scanner's library.json does not load."
    [[ "$found" == 0 ]] || die "An empty home gave $found games."
    ok "The scanner, offline, writes an empty library for an empty home."
}

# A freeze is over by the time anyone looks; this leaves a log of what stalled.
cmd_stalls() {
    require python3
    info "Watching for freezes (Ctrl+C to stop); reproduce one, then read the log."
    python3 "$REPO_DIR/scripts/stallwatch.py" "$@"
}

# The user's own cache and what the scan put in it, after the shared lines.
dev_status() {
    echo "cache:    $CACHE_DIR$([[ -d "$CACHE_DIR" ]] || echo ' (absent)')"
    if [[ -f "$CACHE_DIR/library.json" ]]; then
        # Read through the scanner's own loader rather than restating how the
        # file is shaped a second time.
        echo "library:  $(python3 -c '
import sys
sys.path.insert(0, sys.argv[1])
from scan_library import load_existing
s = load_existing(sys.argv[2])
print(", ".join(f"{len(v)} {k}" for k, v in s.items()) or "empty")' \
            "$SRC_DIR/backend" "$CACHE_DIR/library.json" 2>/dev/null || echo 'unreadable')"
    else
        echo "library:  not scanned yet"
    fi
}

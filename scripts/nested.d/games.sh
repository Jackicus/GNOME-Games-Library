# Games Library's own nested.sh hooks, sourced by the kit's scripts/nested.sh.
#
# shellcheck shell=bash

# --stand-in (--demo): the made-up library of scripts/demo_library.py, written
# where the scanner writes, under the stand-in home's cache; the session's
# XDG_CACHE_HOME points there, so the extension reads it and nothing of yours.
# Needs Pillow.
nested_stand_in() {
    python3 "$REPO_DIR/scripts/demo_library.py" "$1/.cache" >/dev/null
}

# Which library the nested shell shows.
nested_status() {
    if stand_in; then
        echo "library:   the made-up one ($STAND_IN_HOME/.cache/games-library)"
    else
        echo "library:   yours, ~/.cache/games-library"
    fi
}

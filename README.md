# Games Library

**Games Library is now part of [Library](https://github.com/Jackicus/GNOME-Library)**, one
GNOME Shell extension for your TV shows, films and games, opened from a button beside
Show Apps. Its Games tab finds your Steam games and PlayStation 2 discs the way Games
Library did, and the scanner that reads them is now written in GJS.

This repository is archived and no longer changes. Install Library instead:

```bash
git clone https://github.com/Jackicus/GNOME-Library.git
cd GNOME-Library
make install
```

then log out and back in, and `gnome-extensions enable library@jackicus`. If Games
Library is installed, disable it first (`gnome-extensions disable games-library@jackicus`).

GPL-2.0-or-later. See [LICENSE](LICENSE).

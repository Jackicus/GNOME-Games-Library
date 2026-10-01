---
paths:
  - "src/prefs.js"
---

# The preferences

- Three pages: General, Controls, and one per section from `lib/library.js` `SECTIONS`
  (Games), merged with what its page adds (`PAGES`).
- **The shortcut** is set the way GNOME Settings sets one (`_captureShortcut`, after
  `cc-keyboard-shortcut-editor.c`): system shortcuts are inhibited while the dialog
  listens (the shell asks once whether the Extensions app may, and the answer goes to
  the real permission store), and a key the window manager, the shell, the media keys, a
  custom shortcut or one of our remote bindings already has is refused, not taken over.
  The binding is `Main.wm.addKeybinding`, so it is not listed in GNOME Settings.
- **Credentials**: a source's fields here must match `metadata.py`'s count for it; IGDB's
  Twitch client id and secret are one slot, tab-separated. Each key row's Import button
  reads the user's key drop, `~/Documents/keys/<SERVICE>/`, only when pressed.
- **Rescan** runs `backend/scan_library.py --from-settings`: the real keys, online. Never
  press it to test.
- **No synchronous I/O on a game's folder**: a PS2 disc folder can sit on an idled-out
  share, and a stat there kept the window from opening for 11 s. `query_info_async`.

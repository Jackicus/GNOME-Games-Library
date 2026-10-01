---
paths:
  - "src/lib/controls.js"
  - "src/lib/actions.js"
  - "src/lib/app.js"
---

# Remotes, controllers and bound keys

- Nine actions (`actions.js`): the four directions, Select, Back, Home, a page each way.
  Each has a list of keys (`keys-<action>`, `a(uu)` of keyval and modifiers: numbers,
  because Clutter's keysym table lacks half of what a remote sends, `XF86OK` among them)
  and a list of controller inputs (`pad-<action>`, `"button:304"`, `"axis:1-"`).
- The first six stand for a key and are replayed as it through a Clutter virtual
  keyboard, so they do exactly what the arrows, Enter and Escape do wherever the keyboard
  is. Paging (`mediaGrid.js` `pageBy`) and Home are done directly.
- A bound key is handed over by the view it reached (a grid's key handler, a panel's
  `vfunc_key_press_event`, through `handleBoundKey`), so a binding means nothing outside
  the library and a remote's Back stays the browser's Back everywhere else.
- Controllers are read through libmanette, loaded on demand (the extension runs without
  it), monitored while `gamepad-enabled` is on, and acted on only while
  `_controlsActive()` (the pop-up or a browser is showing). Home is the exception:
  `_controlsOpen` opens the library when no window has the focus and no modal grab is up.
- The arrows, Enter and Escape are never offered for binding: they always work.
- Testing with a pad: `scripts/vpad.py` (the drive-extension skill).

---
paths:
  - "src/lib/panel.js"
  - "src/lib/detailDialog.js"
  - "src/lib/detailView.js"
  - "src/lib/libraryWindow.js"
  - "src/lib/shape.js"
  - "src/lib/anim.js"
  - "src/stylesheet.css"
---

# The pop-up panels

`panel.js` `MediaPanel` is the shell's `AppFolderDialog` rebuilt with the folder taken
out (shade, zoom out of the icon, grab, click-away), styled `app-folder-dialog` so it
follows the theme. `libraryWindow.js` `LibraryPanel` (the modal library) and
`detailDialog.js` `DetailDialog` (a picked game) subclass it. The detail panel changes
three things only: it is sized around a poster rather than a 720 px square, it holds a
`DetailView` where the folder holds its grid, and there is no name to edit.

## Geometry that must agree

- The pane sits **inside** the panel by `shape.js` `PANE_INSET` (6), so the folder's
  frame shows around the artwork; its radius is the panel's less the inset
  (`paneInner`), keeping the two curves concentric.
- The inset comes out of the pane's own padding: what shows between the panel's edge
  and the artwork is 32 px either way. `detailView.js` `PADDING` (`32 - PANE_INSET`) and
  the stylesheet's `.gm-pane-content` padding (26 px) are the two halves and must agree,
  or the pane overhangs the panel and the clip cuts the backdrop's corners square.
- The panel's size is asked of the side column (`get_preferred_height`), not added up
  from the pane's numbers, and only after `anim.js` `ensureStyleDeep()`: without it the
  panel came out 26 px short of the pane inside it.
- The hero has a floor, `detailView.js` `HERO_MIN` (132 logical px): on a small work area
  the smallest `detail-size` leaves less room than the buttons under the artwork, so the
  panel grows rather than the artwork vanishing. `detail-size` reaches `panel.js`
  `_budget()` alone.

## What goes behind it: `folderLook()`

Stock GNOME shades to `DIALOG_SHADE_NORMAL` and paints the panel from its theme, and so
does this. Blur my Shell drops a folder's shade for a blur and adds a class of its own to
the folder's box. So once per open a folder's own dialog is looked at: a
`Shell.BlurEffect` on it is matched here with the shade dropped, and any class on its box
beyond `app-folder-dialog` goes on ours, so the same stylesheet paints both. With no
folders on the desktop there is nothing to ask, and the shade and theme stand.

## Opening

- **Two moves**: the panel zooms out of the tile as the artwork and its buttons alone
  (poster-shaped, so the zoom is near uniform), then opens out sideways onto the title,
  facts and list. The pane is laid out once at the open width inside a clip that is the
  panel, so widening reveals the second column instead of reflowing it every frame.
  Closing mirrors it.
- **Nothing is built on an animating frame**: the second column is built on an idle
  while the zoom runs, and the details list waits for the move to finish
  (`detailView.js` `_fillList`, a timer, since an idle lands mid-animation); after that
  `lazyList.js` fills it as it scrolls.
- **Hosting**: `detail-opens-in` `menu` hosts it where the pick was made, in
  `overviewGroup` with the overview up, `uiGroup` otherwise (a tile in the modal
  library's panel included), and the tile unmapping is its cue to go. `modal` is always
  `uiGroup`, hides the overview first (so it fades in centred) or closes the modal
  library's panel first, and survives the tile unmapping.
- **The grab** is `GrabHelper` at `Shell.ActionMode.POPUP` for the whole time it is up, so
  Super and the workspace keys are inert until Escape or a click away. `SYSTEM_MODAL` is
  `modalDialog.js`'s and would only lose the message tray and quick-settings shortcuts.
- **The keyboard**: a panel is a focus group and takes the keyboard as it opens. An
  arrow from the panel finds nothing to move to, so its first navigation key lands
  where Tab would (`_focusFirst`); without it a remote with only arrows could not get in.

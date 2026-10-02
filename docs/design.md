# Design notes

Why the code is the shape it is, where the reason does not fit in a line beside it.
The private API each part reaches is listed in `private-api.md`.

## The button and the `menu` library

- The button behaves as a dock's Show Apps: pressed on the desktop it opens the overview
  onto the games, and a second press or Escape goes back to the desktop. Docks keep a
  `forcedOverview` flag of their own, so any way out of an overview our button opened
  takes it all the way down; left standing, it settled on the window picker and every
  later Show Apps press came back there.
- The view follows Show Apps' `checked`, which the shell clears on every way out of the
  grid. The app display's visibility stays on through the slide to the window picker.
- Only one view can be in the app-grid slot. With another extension's view up, a press
  of ours closes the overview and reopens it onto the games: two of the shell's own
  transitions, rather than one grid drawn over another.
- The workspaces row is folded away while the games are up. How far follows the
  overview's state adjustment, so it keeps step with Show Apps, Super or a swipe; a fade
  on a clock of ours fell out of step.
- A press before the overview has ever been laid out has no measured slot, so
  `_slotSize` redoes `ControlsManagerLayout.vfunc_allocate` in the work area (not the
  monitor, which was a panel's height too tall) and measures the dash even when hidden,
  as the shell does. The view is rebuilt if the shell's own measurement then differs.

## Chained wrappers

`mediaMenu.js` wraps the overview layout's `_getAppDisplayBoxForState` and
`libraryButton.js` wraps Dash to Panel's `panel._updateGroupedElements`, each as an own
property of the instance, and each calls whatever it found. Another extension (Video
Library among them) may wrap the same method. A wrapper comes off only while it is still
outermost, by putting back what it found; deleting it under someone else's wrapper would
take theirs off too. Under another wrapper ours stays as an inert pass-through.

## The grid

The library is the shell's app grid (`BaseAppView`), so paging, swipe, the page dots and
arrows and keyboard focus are the shell's. Its layout assumes square icons, so the icon
asks for its artwork's shape and the layout places poster-shaped cells. A view builds
only the pages in reach of the one showing, since a library can run to thousands of
items where an app grid holds dozens. The page dots are faded rather than hidden for a
one-page library, which otherwise sat 7 px lower than a two-page one.

## The pop-up panels

`panel.js` is the shell's `AppFolderDialog` with the folder taken out: the shade, the
zoom out of the tile, the grab and the click-away, styled `app-folder-dialog` so it
follows the theme. The modal library and the detail pop-up subclass it.

- **What goes behind it.** Blur my Shell swaps a folder's shade for a blur and puts a
  class of its own on the folder's box. Once per open a folder's dialog is asked, and
  its blur and classes go on ours, so the two look alike; with stock GNOME, or no
  folders, the shell's shade and theme stand.
- **Two moves.** A picked game zooms out of its tile at the width of the artwork alone
  (poster-shaped, so the zoom is near uniform), then widens onto the title, facts and
  details. The pane is laid out once at the open width inside a clip, so widening
  reveals the second column rather than reflowing it every frame. Closing mirrors it.
- **Nothing is built on an animating frame.** The second column is built on an idle
  while the zoom runs, and the details list on a timer once the panel has landed.
- **`modal`** hides the overview first, so the panel fades in centred, and it survives
  its tile unmapping; `menu` goes with its tile, as a folder goes with its icon.

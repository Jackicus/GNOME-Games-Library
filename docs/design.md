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

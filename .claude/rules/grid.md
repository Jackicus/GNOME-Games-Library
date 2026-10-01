---
paths:
  - "src/lib/mediaGrid.js"
  - "src/lib/mediaMenu.js"
  - "src/lib/libraryWindow.js"
  - "src/lib/libraryButton.js"
  - "src/lib/lazyList.js"
  - "src/lib/library.js"
---

# The grid, the overview slot and the button

## The grid is the shell's app grid

`mediaGrid.js` subclasses the class `AppDisplay` is built on (`BaseAppView`, not exported,
reached as `AppDisplay`'s prototype), holding posters instead of apps, so pages, swipe,
the page dots, the hover arrows and scroll-wheel paging come with it. One grid serves
both places, the overview's slot and the modal library's panel. A tile is an
`AppViewItem` around a `BaseIcon` styled `overview-tile`, which gives its hover, focus
ring and label. Ours is only the shape: the icon asks for its artwork's proportions
rather than a square, the layout places cells of that shape the theme's gap apart, and a
view builds the pages in reach of the one showing, not a tile per game.

- `columns` and `rows` are each capped by what fits at `MIN_ART` in the box the view is
  given, so a narrow space shows fewer. `grid-align` (`setGridAlign`, read by the layout
  as it allocates) decides whether a part-full row is centred or hugs the leading edge;
  the block itself is always centred, because `gridFor` shrinks the cover to fit `rows`
  and `columns` exactly.
- The page dots keep their room on a one-page library: the shell hides them for a single
  page, and the grid then sat seven pixels lower than a two-page one.
- `mediaGrid.js` `pageBy` turns a page, since the shell's grid turns none for a key.

## The keyboard

Each grid registers itself with `global.focus_manager.add_group`, as the shell's dialogs
and menus do: the nearest group around the focus is the one the arrows walk. The shell
registers its own app grid as a Ctrl+Alt+Tab target; ours is not one. Nothing is focused
until a navigation key asks; then Tab and the arrows move, Enter opens, Escape backs out.

## The `menu` library (`mediaMenu.js`)

- It folds the overview's row of small workspaces away to give the posters room. How far
  is read from the overview's own state adjustment (`_stateAdjustment`), never timed: a
  fade of our own falls out of step with the shell's transition, and one started as the
  overview unmaps stalls until it is next shown.
- **The overview is laid out in the work area, not the monitor.** The box
  `ControlsManagerLayout.vfunc_allocate` divides is already inset by the top bar and
  anything reserved (Dash to Panel's panel, 48 px of it), so `_slotSize` (a press before
  the overview has ever been shown) starts from `getWorkAreaForMonitor` and measures the
  dash whether or not it is visible, as the shell does. The box the standing view was
  built for is kept, and the view is rebuilt when that moves.
- `_force()` is the only `captured-event::key` handler: Escape on our view in an overview
  our button opened closes the overview whole, ahead of the shell's own handler.

## The button (`libraryButton.js`)

Every way out of an overview our button opened goes all the way down, Show Apps
included: a dock keeps a `forcedOverview` flag of its own that ours never sets, so an
overview left standing settled on the window picker and every later Show Apps press came
back there. Show Apps itself is left alone. With Dash to Panel, the button goes into its
panel through the `_updateGroupedElements` wrapper and is re-attached on its
`panels-created` signal.

## Lists and hover

- On destroy, `lazyList.js` takes back only its idle source: the scroll view's
  adjustment is gone by then.
- Only the rows track hover; tiles hover by crossing events.

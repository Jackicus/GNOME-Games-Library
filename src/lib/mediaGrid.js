// The library grid: the shell's own app grid, holding posters instead of apps.
// The shell's grid assumes square icons, so the icon and the layout are ours.

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as IconGrid from 'resource:///org/gnome/shell/ui/iconGrid.js';

import {handleBoundKey} from './controls.js';
import {createArtwork} from './widgets.js';

// Not exported by the shell.
const BaseAppView = Object.getPrototypeOf(AppDisplay.AppDisplay);

// Logical pixels, scaled where they meet an allocation.
const MIN_ART = 96;
// The theme's .icon-grid spacing, for gridFor, which runs before the grid exists.
const GAP = 12;
// An `overview-tile`'s padding, and its label gap and line beneath the artwork.
const TILE_PADDING = 24;
const TILE_CHROME = 56;
// Room for a hovered tile's title to wrap to a second line in the bottom row.
const TITLE_LINE = 20;
const PAGE_PADDING_V = 48;
const PAGE_PADDING_H = 36;
// The shell's PAGE_PREVIEW_RATIO each side, for the page arrows.
const ARROWS_SHARE = 0.2;
const DOTS_HEIGHT = 36;
// Pages built beyond the one showing, so the next is there to swipe to.
const PAGES_AHEAD = 2;

// Read by the layout as it allocates; app.js rebuilds the grids on a change.
let gridAlign = 'center';
export function setGridAlign(align) {
    gridAlign = align === 'start' ? 'start' : 'center';
}

// Decided before any item is added: the layout does not re-page items when the
// mode changes.
function gridFor(width, height, aspect, wantColumns, wantRows) {
    const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    const gap = GAP * scale;
    const pad = TILE_PADDING * scale;
    const chrome = TILE_CHROME * scale;
    const minArt = MIN_ART * scale;

    const gridW = width * (1 - ARROWS_SHARE) - PAGE_PADDING_H * scale;
    const gridH = height - (DOTS_HEIGHT + PAGE_PADDING_V + TITLE_LINE) * scale;

    const fitColumns = Math.floor((gridW + gap) / (minArt / aspect + pad + gap));
    const columns = Math.max(1, Math.min(wantColumns, fitColumns));
    const cellW = Math.floor((gridW - gap * (columns - 1)) / columns);
    const byWidth = Math.floor((cellW - pad) * aspect);

    const forRows = n => Math.floor((gridH + gap) / n - chrome - gap);
    const fitRows = Math.floor((gridH + gap) / (minArt + chrome + gap));
    const rows = Math.max(1, Math.min(wantRows, fitRows));

    const iconSize = Math.max(minArt, Math.min(byWidth, forRows(rows)));

    return {rows, columns, iconSize};
}

// The shell's layout makes every cell square; posters are not.
const PosterGridLayout = GObject.registerClass(
class GamesLibraryPosterGridLayout extends IconGrid.IconGridLayout {
    vfunc_allocate() {
        if (!this._pageWidth || !this._pageHeight)
            return;

        // Every tile is the same size, and this runs on each frame the overview moves.
        const first = this._pages[0]?.visibleChildren[0];
        if (!first)
            return;
        const cellW = first.get_preferred_width(-1)[0];
        const cellH = first.get_preferred_height(-1)[0];

        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        // Already scaled by the theme, and 0 until the first style change.
        const hGap = this.columnSpacing || GAP * scale;
        const vGap = this.rowSpacing || GAP * scale;

        const rtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;
        const {columnsPerPage: columns, rowsPerPage: rows, pagePadding: pad} = this;
        const blockW = columns * cellW + (columns - 1) * hGap;
        const blockH = rows * cellH + (rows - 1) * vGap;
        // `_calculateSpacing`'s centring by hand, since it assumes square cells.
        const centred = gridAlign === 'center';
        const left = pad.left + Math.max(0, (this._pageWidth - pad.left - pad.right - blockW) / 2);
        const top = pad.top +
            Math.max(0, (this._pageHeight - pad.top - pad.bottom - TITLE_LINE * scale - blockH) / 2);

        const box = new Clutter.ActorBox();
        this._pages.forEach((page, pageIndex) => {
            if (rtl)
                pageIndex = this._pages.length - 1 - pageIndex;
            page.visibleChildren.forEach((item, index) => {
                const column = rtl ? columns - 1 - index % columns : index % columns;
                const row = Math.floor(index / columns);
                const inRow = Math.min(columns, page.visibleChildren.length - row * columns);
                const rowOffset = centred
                    ? (rtl ? -1 : 1) * (columns - inRow) * (cellW + hGap) / 2
                    : 0;
                box.set_origin(
                    Math.floor(pageIndex * this._pageWidth + left + rowOffset +
                        column * (cellW + hGap)),
                    Math.floor(top + row * (cellH + vGap)));
                // A hovered tile wraps its title, so the cell is a floor, as in the shell.
                box.set_size(cellW, Math.max(cellH, item.get_preferred_height(cellW)[1]));
                item.allocate(box);
            });
        });

        this._pageSizeChanged = false;
        // Nothing here reorders items, so there is nothing to ease.
        this._shouldEaseItems = false;
    }
});

const MediaGrid = GObject.registerClass(
class GamesLibraryMediaGrid extends AppDisplay.AppGrid {
    constructor({rows, columns, iconSize}) {
        super({
            allow_incomplete_pages: true,
            rows_per_page: rows,
            columns_per_page: columns,
        });
        this.setGridModes([{rows, columns}]);

        // The layout the grid made is dropped: IconGrid's destroy handler holds it
        // and disconnects it.
        const layout = new PosterGridLayout({
            allow_incomplete_pages: true,
            orientation: Clutter.Orientation.HORIZONTAL,
            rows_per_page: rows,
            columns_per_page: columns,
            fixed_icon_size: iconSize,
        });
        layout.connect('pages-changed', () => this.emit('pages-changed'));
        this.layout_manager = layout;
    }
});

// A BaseIcon asks for a square; this one asks for what its artwork does.
const PosterIcon = GObject.registerClass(
class GamesLibraryPosterIcon extends IconGrid.BaseIcon {
    vfunc_get_preferred_width(forHeight) {
        const node = this.get_theme_node();
        const [min, nat] = this.child.get_preferred_width(node.adjust_for_height(forHeight));
        return node.adjust_preferred_width(min, nat);
    }

    vfunc_get_preferred_height(forWidth) {
        const node = this.get_theme_node();
        const [min, nat] = this.child.get_preferred_height(node.adjust_for_width(forWidth));
        return node.adjust_preferred_height(min, nat);
    }
});

const MediaItem = GObject.registerClass(
class GamesLibraryMediaItem extends AppDisplay.AppViewItem {
    _init({item, section, order, onActivate}) {
        super._init({style_class: 'overview-tile'}, false, true);
        this._id = `${section.key}/${item.id}`;
        this._name = item.title;
        this.item = item;
        this.order = order;

        this.icon = new PosterIcon(item.title, {
            setSizeManually: true,
            createIcon: size => createArtwork({
                path: item.art,
                title: item.title,
                icon: section.icon,
                width: Math.round(size / section.aspect),
                height: size,
            }),
        });
        this.set_child(this.icon);
        this.connect('clicked', () => onActivate(section.key, item, this));
    }

    // What the pop-up zooms out of and back into.
    get artwork() {
        return this.icon.icon;
    }
});

// _createGrid() runs in the parent's _init, before `this` can hold the parameters.
let pendingGrid = null;

const MediaView = GObject.registerClass(
class GamesLibraryMediaView extends BaseAppView {
    constructor({section, items, onActivate}) {
        super({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });
        this.add_child(this._box);

        // Both re-run _redisplay over every tile, and neither concerns games.
        this._parentalControlsManager.disconnectObject(this);
        this._appFavorites.disconnectObject(this);

        // The arrows walk the nearest focus group; the shell registers its own grid
        // elsewhere.
        global.focus_manager.add_group(this);
        this.connect('destroy', () => {
            this._destroyed = true;
            global.focus_manager.remove_group(this);
        });

        this.connect('key-press-event', (_view, event) => handleBoundKey(event)
            ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE);

        // The shell hides the dots for one page, which moved the grid 7 px lower;
        // they are faded instead.
        const dots = this._pageIndicators;
        const holdRoom = () => {
            if (!dots.visible) {
                dots.visible = true;
                dots.opacity = 0;
            } else if (dots.get_n_children() > 1) {
                dots.opacity = 255;
            }
        };
        dots.connect('notify::visible', holdRoom);
        holdRoom();

        this._section = section;
        this._data = items;
        this._onActivate = onActivate;
        this._perPage = pendingGrid.rows * pendingGrid.columns;
        this._media = [];
        this._fillTo(0);
    }

    // Straight into the grid: _redisplay diffs every item against every other.
    _fillTo(page) {
        const want = Math.min(this._data.length, (page + 1 + PAGES_AHEAD) * this._perPage);
        while (this._media.length < want) {
            const order = this._media.length;
            const item = new MediaItem({
                item: this._data[order],
                section: this._section,
                order,
                onActivate: this._onActivate,
            });
            this._media.push(item);
            // Placed outright: appending lets the grid choose the page.
            this._addItem(item, Math.floor(order / this._perPage), order % this._perPage);
        }
    }

    // Destroying the view empties the grid, whose `pages-changed` turns the page
    // on an adjustment the scroll view has already dropped.
    goToPage(page, animate = true) {
        if (this._destroyed)
            return;
        if (this._data)
            this._fillTo(page);
        super.goToPage(page, animate);
    }

    // The first tile of the page shown: the focus chain's start can be a page away.
    focusFirst() {
        const item = this._media[this._shownPage() * this._perPage] ?? this._media[0];
        item?.grab_key_focus();
        return !!item;
    }

    // The grid's own current page is wherever the last batch of tiles left it.
    _shownPage() {
        const {value, page_size: pageSize} = this._adjustment;
        return pageSize > 0 ? Math.round(value / pageSize) : 0;
    }

    // The shell's grid turns no page for a key.
    pageBy(delta) {
        const page = this._shownPage() + delta;
        if (page < 0 || page * this._perPage >= this._data.length)
            return false;
        this.goToPage(page);
        this._media[page * this._perPage]?.grab_key_focus();
        return true;
    }

    _createGrid() {
        return new MediaGrid(pendingGrid);
    }

    _loadApps() {
        return [...this._media];
    }

    _compareItems(a, b) {
        return a.order - b.order;
    }
});

export function createMediaView({section, items, width, height, columns, rows, onActivate}) {
    pendingGrid = gridFor(width, height, section.aspect, columns, rows);
    const view = new MediaView({section, items, onActivate});
    // Each batch of tiles makes a page, and the grid follows it.
    view.goToPage(0, false);
    return view;
}

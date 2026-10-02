// The "modal" library: the games grid in a folder-style panel that zooms out of
// the button, as an app folder's FolderView does.

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {libraryCountLabel} from './library.js';
import {createMediaView} from './mediaGrid.js';
import {MediaPanel} from './panel.js';

const LibraryPanel = GObject.registerClass(
class GamesLibraryLibraryPanel extends MediaPanel {
    constructor({columns, rows, onActivate}) {
        // As a folder: it closes when the button unmaps with the overview.
        super({dieWithSource: true});

        this._columns = columns;
        this._rows = rows;
        this._onActivate = onActivate;
        this._view = null;
        this._room = null;

        // The theme insets a folder's name by its container's class.
        this._header = new St.BoxLayout({
            style_class: 'gm-header folder-name-container',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const titles = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'gm-header-titles',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._title = new St.Label({style_class: 'gm-header-title'});
        this._subtitle = new St.Label({style_class: 'gm-header-subtitle'});
        titles.add_child(this._title);
        titles.add_child(this._subtitle);
        this._header.add_child(titles);
        this._panel.add_child(this._header);

        this._stack = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });
        this._panel.add_child(this._stack);
    }

    // `set_size` overrides the 720 px square the theme pins the dialog to.
    _sizePanel(budget) {
        this._panel.remove_all_transitions();
        this._panel.set_size(budget.width, budget.height);
        this._restSize = [budget.width, budget.height];

        // The grid's shape is fixed when built, so a new box rebuilds it.
        if (this._room && (this._room.width !== budget.width || this._room.height !== budget.height))
            this._dropView();
        this._room = budget;
    }

    // Called after `popup`, once the theme padding can be measured.
    showSection(section, items) {
        this._title.text = section.title;
        this._subtitle.text = libraryCountLabel(items.length);

        if (!this._view) {
            const [width, height] = this._viewSize();
            this._view = createMediaView({
                section,
                items,
                width,
                height,
                columns: this._columns,
                rows: this._rows,
                onActivate: this._onActivate,
            });
            this._stack.add_child(this._view);
        }
        this._view.goToPage(0, false);
    }

    get currentView() {
        return this._view;
    }

    _focusFirst() {
        return this.currentView?.focusFirst() ?? false;
    }

    _viewSize() {
        const node = this._panel.get_theme_node();
        const width = Math.round(this._room.width -
            node.get_padding(St.Side.LEFT) - node.get_padding(St.Side.RIGHT));
        const [, headerHeight] = this._header.get_preferred_height(width);
        const height = Math.round(this._room.height - headerHeight -
            node.get_padding(St.Side.TOP) - node.get_padding(St.Side.BOTTOM));
        return [width, height];
    }

    _dropView() {
        this._view?.destroy();
        this._view = null;
    }
});

export class LibraryWindow {
    constructor({sections, itemsFor, onActivate, columns, rows, button}) {
        this._sections = sections.filter(s => itemsFor(s.key).length);
        this._itemsFor = itemsFor;
        this._onActivate = onActivate;
        this._columns = columns;
        this._rows = rows;
        this._button = button;
        this._panel = null;
        this._current = null;
    }

    enable() {
    }

    disable() {
        this.close();
        this._panel?.destroy();
        this._panel = null;
        this._current = null;
    }

    toggle(key = this._sections[0]?.key) {
        if (this._panel?.isOpen && this._current === key) {
            this.close();
            return;
        }
        this.open(key);
    }

    open(key = this._sections[0]?.key) {
        const section = this._sections.find(s => s.key === key);
        if (!section)
            return;

        if (!this._panel) {
            this._panel = new LibraryPanel({
                columns: this._columns,
                rows: this._rows,
                onActivate: this._onActivate,
            });
            this._panel.connect('open-state-changed', (_panel, isOpen) => {
                if (isOpen)
                    return;
                this._current = null;
                this._button.sync(false);
            });
        }

        if (!this._panel.isOpen) {
            // An unmapped icon (a shortcut on the desktop) makes it fade in centred.
            this._panel.popup(this._button.icon);
            if (!this._panel.isOpen)
                return;
        }

        this._current = key;
        this._panel.showSection(section, this._itemsFor(key));
        this._button.sync(true);
    }

    close() {
        this._panel?.popdown();
    }

    get isShowing() {
        return !!this._panel?.isOpen;
    }

    get currentView() {
        return this._panel?.isOpen ? this._panel.currentView : null;
    }

    // For a rebuild to put the library back up.
    get state() {
        return {key: this._panel?.isOpen ? this._current : null};
    }

    restore(state) {
        if (state?.key)
            this.open(state.key);
    }
}

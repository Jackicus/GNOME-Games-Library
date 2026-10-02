// The "menu" library: the games grid in the overview's app-grid slot, opened
// from the button beside Show Apps. Design notes: docs/design.md.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {ControlsState} from 'resource:///org/gnome/shell/ui/overviewControls.js';

import {Duration, Ease} from './anim.js';
import {createMediaView} from './mediaGrid.js';

// overviewControls.js's DASH_MAX_HEIGHT_RATIO and VERTICAL_SPACING_RATIO, not exported.
const DASH_MAX_SHARE = 0.16;
const VERTICAL_SPACING_SHARE = 0.02;

export class MediaMenu {
    constructor({sections, itemsFor, onActivate, columns, rows, button}) {
        this._sections = sections.filter(s => itemsFor(s.key).length);
        this._itemsFor = itemsFor;
        this._onActivate = onActivate;
        this._columns = columns;
        this._rows = rows;
        this._views = new Map();
        this._button = button;
        this._showAppsButton = null;
        this._current = null;
        this._slot = null;
        this._box = null;
        this._fold = 0;
        // Whether a button of ours opened the overview that is up.
        this._forced = false;
        this._escapeId = 0;
        // Opened once the overview is down, when another extension's view was up.
        this._next = null;
        this._reopenId = 0;
        this._foldedBox = null;
        this._stockBox = null;
    }

    enable() {
        this._controls = Main.overview._overview?.controls ?? null;
        this._appDisplay = this._controls?.appDisplay ?? null;
        this._appsBox = this._appDisplay?._box ?? null;
        if (!this._appDisplay || !this._appsBox || !this._sections.length) {
            if (this._sections.length)
                console.warn('[Games Library] The overview is not laid out as expected; no games menu.');
            this._appsBox = null;
            return;
        }

        // Show Apps' `checked` follows the grid on every way out; the app display's
        // visibility does not, as it stays on through the slide to the window picker.
        this._showAppsButton = Main.overview.dash.showAppsButton;
        this._showAppsButton.connectObject('notify::checked', button => {
            if (button.checked)
                return;
            const leaving = this._current && this._forced &&
                Main.overview.visible && !Main.overview.animationInProgress &&
                !this._adjustment?.gestureInProgress &&
                !this._controls._searchController?.searchActive;
            this._show(null);
            if (leaving)
                Main.overview.hide();
        }, this);

        this._controls._searchController?.connectObject('notify::search-active', controller => {
            if (!controller.searchActive && this._current)
                this._syncWorkspaces(true);
        }, this);

        this._adjustment = this._controls._stateAdjustment ?? null;
        this._adjustment?.connectObject('notify::value', () => this._syncWorkspaces(), this);

        // Reopened off an idle, so the shell's own hide has finished first.
        Main.overview.connectObject('hidden', () => {
            this._unforce();
            const next = this._next;
            this._next = null;
            if (next && !this._reopenId) {
                this._reopenId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    this._reopenId = 0;
                    this.open(next);
                    return GLib.SOURCE_REMOVE;
                });
            }
        }, this);

        this._foldWorkspaces();
    }

    disable() {
        if (!this._appsBox)
            return;
        this._show(null);
        this._unfoldWorkspaces();
        this._controls.queue_relayout();
        this._showAppsButton?.disconnectObject(this);
        this._showAppsButton = null;
        Main.overview.disconnectObject(this);
        this._unforce();
        if (this._reopenId)
            GLib.source_remove(this._reopenId);
        this._reopenId = 0;
        this._next = null;
        this._controls._searchController?.disconnectObject(this);
        this._adjustment?.disconnectObject(this);
        this._adjustment = null;
        this._dropViews();
        this._slot = null;
        this._controls = this._appDisplay = this._appsBox = null;
    }

    // While our view is up the grid's box grows over the workspaces row. Wrappers
    // of `_getAppDisplayBoxForState` from other extensions stack; see docs/design.md.
    _foldWorkspaces() {
        const layout = this._controls.layout_manager;
        if (typeof layout._getAppDisplayBoxForState !== 'function')
            return;
        // The class's method is looked up per call: Dash to Dock patches it later.
        const own = Object.prototype.hasOwnProperty.call(layout, '_getAppDisplayBoxForState')
            ? layout._getAppDisplayBoxForState : null;
        const menu = this;
        const folded = function (state, box, searchHeight, dashHeight, workspacesBox, spacing) {
            const shell = Object.getPrototypeOf(this)._getAppDisplayBoxForState;
            const slot = (own ?? shell).call(this, state, box, searchHeight, dashHeight, workspacesBox, spacing);
            // Unhooked but still a link in someone else's chain.
            if (menu._foldedBox !== folded)
                return slot;
            // Measured off the class: another wrapper may have grown `slot` for its view.
            const measured = own
                ? shell.call(this, state, box, searchHeight, dashHeight, workspacesBox, spacing) : slot;
            menu._slot = [measured.get_width(), measured.get_height() + workspacesBox.get_height() + spacing];
            if (!menu._current)
                return slot;
            // The same size in every state, so the slide moves the slot without stretching it.
            const extra = workspacesBox.get_height() + spacing;
            const [x, y] = slot.get_origin();
            const [width, height] = slot.get_size();
            slot.set_origin(x, state === ControlsState.APP_GRID ? y - extra : y);
            slot.set_size(width, height + extra);
            return slot;
        };
        this._stockBox = own;
        this._foldedBox = layout._getAppDisplayBoxForState = folded;
    }

    // Restored only while ours is outermost: deleting it under another wrapper
    // would take theirs off too.
    _unfoldWorkspaces() {
        const folded = this._foldedBox;
        this._foldedBox = null;
        if (!folded)
            return;
        const layout = this._controls.layout_manager;
        if (layout._getAppDisplayBoxForState === folded) {
            if (this._stockBox)
                layout._getAppDisplayBoxForState = this._stockBox;
            else
                delete layout._getAppDisplayBoxForState;
        }
        this._stockBox = null;
    }

    // The fold follows the overview's state adjustment, not a clock of ours, so it
    // keeps in step with whatever moves the overview.
    _syncWorkspaces(animate = false) {
        // An ease of ours can outlast the menu.
        const workspaces = this._controls?._workspacesDisplay;
        if (!workspaces || this._controls._searchController?.searchActive)
            return;
        const state = this._adjustment?.value ?? ControlsState.WINDOW_PICKER;
        const fold = this._current
            ? Math.clamp(state - ControlsState.WINDOW_PICKER, 0, 1) : 0;
        // Unfolded, the workspaces are someone else's to animate.
        if (!fold && !this._fold)
            return;
        const opacity = Math.round(255 * (1 - fold));

        // A transparent workspace still takes a poster's click.
        if (fold < 1) {
            workspaces.reactive = true;
            workspaces.setPrimaryWorkspaceVisible?.(true);
        }
        workspaces.remove_transition('opacity');
        if (animate && workspaces.mapped && workspaces.opacity !== opacity) {
            workspaces.ease({
                opacity,
                duration: Duration.NORMAL,
                mode: Ease.OUT,
                onComplete: () => this._syncWorkspaces(),
            });
            return;
        }
        this._fold = fold;
        workspaces.opacity = opacity;
        if (fold === 1) {
            workspaces.reactive = false;
            workspaces.setPrimaryWorkspaceVisible?.(false);
        }
    }

    // A second press closes what the first opened: the overview, if ours opened it.
    toggle(key = this._sections[0]?.key) {
        if (Main.overview.visible && this._showAppsButton?.checked && this._current) {
            if (this._forced)
                Main.overview.hide();
            else
                this._showAppsButton.checked = false;
            return;
        }
        this.open(key);
    }

    close() {
        Main.overview.hide();
    }

    get isShowing() {
        return Main.overview.visible && !!this._showAppsButton?.checked && !!this._current;
    }

    get currentView() {
        return this.isShowing ? this._views.get(this._current) ?? null : null;
    }

    // For a rebuild (a rescan, a setting) to put the library back up.
    get state() {
        return {key: this._current, forced: this._forced};
    }

    restore(state) {
        if (!state?.key || !this._appsBox || !Main.overview.visible)
            return;
        if (!this._sections.some(s => s.key === state.key))
            return;
        if (state.forced)
            this._force();
        this.open(state.key);
    }

    // With another extension's view in the slot, the overview goes down and comes
    // back up onto ours (the `hidden` handler), rather than drawing one grid over another.
    open(key = this._sections[0]?.key) {
        this._next = null;
        if (!this._appsBox || !this._sections.some(s => s.key === key))
            return;
        if (this._otherViewUp()) {
            this._next = key;
            Main.overview.hide();
            return;
        }
        this._show(key);
        if (Main.overview.visible) {
            this._showAppsButton.checked = true;
            return;
        }
        this._force();
        Main.overview.show(ControlsState.APP_GRID);
    }

    _otherViewUp() {
        return Main.overview.visible && !!this._showAppsButton?.checked &&
            !this._appsBox.visible && !this._current;
    }

    // In an overview our button opened, Escape closes it whole, ahead of the
    // shell's own handler.
    _force() {
        this._forced = true;
        if (this._escapeId)
            return;
        // Asking a non-press `key` event for its symbol is a Clutter assertion.
        this._escapeId = global.stage.connect('captured-event::key', (_stage, event) => {
            if (event.type() !== Clutter.EventType.KEY_PRESS ||
                event.get_key_symbol() !== Clutter.KEY_Escape ||
                !this._current || !this._showAppsButton?.checked ||
                Main.modalCount > 1 || this._controls?._searchController?.searchActive)
                return Clutter.EVENT_PROPAGATE;
            Main.overview.hide();
            return Clutter.EVENT_STOP;
        });
    }

    _unforce() {
        this._forced = false;
        if (this._escapeId)
            global.stage.disconnect(this._escapeId);
        this._escapeId = 0;
    }

    _show(key) {
        if (!this._appsBox)
            return;
        if (key !== this._current) {
            const view = key ? this._view(key) : null;
            this._views.get(this._current)?.hide();
            this._current = key;
            this._appsBox.visible = !key;
            if (view) {
                view.show();
                view.goToPage(0, false);
            }
            this._syncWorkspaces(true);
            this._controls.queue_relayout();
        }
        // A toggle button unchecks itself when clicked while up.
        this._button.sync(!!this._current);
    }

    // For a press before the overview was ever laid out: ControlsManagerLayout's
    // vfunc_allocate redone, measuring the dash even when hidden, as the shell does.
    _slotSize() {
        if (this._slot)
            return this._slot;
        const monitor = Main.layoutManager.primaryMonitor;
        // The overview is laid out in the work area, not the monitor.
        const {width, height} = Main.layoutManager.getWorkAreaForMonitor(monitor.index);
        const spacing = Math.round(height * VERTICAL_SPACING_SHARE);
        const maxDash = Math.round(height * DASH_MAX_SHARE);
        const search = Main.overview.searchEntry?.get_parent();
        const searchHeight = search ? search.get_preferred_height(width)[0] : 0;
        const dash = Main.overview.dash;
        dash.setMaxSize(width, maxDash);
        const dashHeight = Math.min(dash.get_preferred_height(width)[1], maxDash);
        return [width, height - searchHeight - dashHeight - 2 * spacing];
    }

    // `_slotSize`'s estimate and the shell's later measurement can differ, so the
    // view is rebuilt when the box moves.
    _view(key) {
        const [width, height] = this._slotSize();
        if (this._box && (this._box[0] !== width || this._box[1] !== height))
            this._dropViews();
        this._box = [width, height];

        let view = this._views.get(key);
        if (view)
            return view;

        const section = this._sections.find(s => s.key === key);

        view = createMediaView({
            section,
            items: this._itemsFor(key),
            width,
            height,
            columns: this._columns,
            rows: this._rows,
            onActivate: this._onActivate,
        });
        view.visible = false;
        this._appDisplay.add_child(view);
        this._views.set(key, view);
        return view;
    }

    _dropViews() {
        for (const view of this._views.values())
            view.destroy();
        this._views.clear();
        this._box = null;
    }
}

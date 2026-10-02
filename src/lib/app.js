// GamesLibraryApp: builds the library and the detail pop-up where the
// `library-opens-in` and `detail-opens-in` settings say, and launches games.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {SECTIONS, loadLibrary, libraryPath, sectionByKey} from './library.js';
import {setCornerRadius} from './shape.js';
import {setGridAlign} from './mediaGrid.js';
import {MediaMenu} from './mediaMenu.js';
import {LibraryWindow} from './libraryWindow.js';
import {LibraryButton} from './libraryButton.js';
import {DetailDialog} from './detailDialog.js';
import {Controls} from './controls.js';
import {note} from './log.js';

// An array is a game's command line, run as it is; anything else is a folder.
function openPath(path, beforeLaunch) {
    if (!path)
        return;
    if (Array.isArray(path)) {
        beforeLaunch();
        Util.spawn(path);
        return;
    }
    // Async: a disc folder can be on a share that blocks for seconds.
    const file = Gio.File.new_for_path(path);
    Gio.AppInfo.launch_default_for_uri_async(file.get_uri(),
        global.create_app_launch_context(0, -1), null, (_source, res) => {
            try {
                Gio.AppInfo.launch_default_for_uri_finish(res);
            } catch (e) {
                Main.notifyError(`Could not open ${file.get_basename()}`, e.message);
            }
        });
}

export class GamesLibraryApp {
    constructor(extension) {
        this._settings = extension.getSettings();
        this._sections = {};
        // Kept across rebuilds, so it never moves past another extension's button.
        this._button = new LibraryButton({
            path: extension.path,
            onActivate: () => this._toggleLibrary(),
        });
        this._browser = null;
        this._dialog = null;
        this._monitor = null;
        this._rebuildTimer = 0;
        this._reloadWanted = false;
        this._controls = new Controls(this._settings, {
            isActive: () => this._controlsActive(),
            onHome: () => this._controlsHome(),
            onOpen: () => this._controlsOpen(),
            currentView: () => this._browser.currentView,
        });
    }

    enable() {
        this._controls.enable();
        this._sections = loadLibrary();
        this._build();

        // Every size in JS is physical pixels.
        St.ThemeContext.get_for_stage(global.stage).connectObject('notify::scale-factor',
            () => this._scheduleRebuild(), this);

        const rebuildKeys = ['columns', 'rows', 'grid-align', 'corner-radius', 'detail-size',
            'library-opens-in', 'detail-opens-in'];
        for (const key of rebuildKeys)
            this._settings.connectObject(`changed::${key}`, () => this._scheduleRebuild(), this);

        // POPUP too, only so the shortcut can close the modal library (_onShortcut).
        for (const section of SECTIONS) {
            Main.wm.addKeybinding(`${section.prefix}-shortcut`, this._settings,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
                () => this._onShortcut());
        }

        this._monitor = Gio.File.new_for_path(libraryPath()).monitor_file(Gio.FileMonitorFlags.NONE, null);
        this._monitor.connect('changed', (_m, _f, _o, event) => {
            if (event === Gio.FileMonitorEvent.CHANGES_DONE_HINT ||
                event === Gio.FileMonitorEvent.CREATED ||
                event === Gio.FileMonitorEvent.RENAMED ||
                event === Gio.FileMonitorEvent.MOVED_IN)
                this._scheduleRebuild({reload: true, delay: 400});
        });
    }

    disable() {
        for (const section of SECTIONS)
            Main.wm.removeKeybinding(`${section.prefix}-shortcut`);
        St.ThemeContext.get_for_stage(global.stage).disconnectObject(this);
        this._settings.disconnectObject(this);
        this._monitor.cancel();
        this._monitor = null;
        if (this._rebuildTimer)
            GLib.source_remove(this._rebuildTimer);
        this._rebuildTimer = 0;
        this._teardown();
        this._button.detach();
        this._sections = {};
        this._controls.disable();
    }

    _teardown() {
        this._browser.disable();
        this._browser = null;
        this._dialog.popdown();
        this._dialog.destroy();
        this._dialog = null;
    }

    // Settings and rescans arrive in bursts; each burst is one rebuild.
    _scheduleRebuild({reload = false, delay = 150} = {}) {
        this._reloadWanted ||= reload;
        if (this._rebuildTimer)
            GLib.source_remove(this._rebuildTimer);
        this._rebuildTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this._rebuildTimer = 0;
            if (this._reloadWanted)
                this._sections = loadLibrary();
            this._reloadWanted = false;
            const browsing = this._browser.state;
            this._teardown();
            this._build();
            this._browser.restore(browsing);
            note('Rebuilt');
            return GLib.SOURCE_REMOVE;
        });
    }

    _detailMode() {
        return this._settings.get_string('detail-opens-in');
    }

    _build() {
        // Read as each surface is built, so set first.
        setCornerRadius(this._settings.get_int('corner-radius'));
        setGridAlign(this._settings.get_string('grid-align'));

        if (SECTIONS.some(s => this._sections[s.key].length))
            this._button.attach();
        else
            this._button.detach();

        this._dialog = new DetailDialog({
            onOpen: path => openPath(path, () => this._launching()),
            size: this._settings.get_int('detail-size') / 100,
            mode: this._detailMode(),
        });

        const Browser = this._settings.get_string('library-opens-in') === 'modal' ? LibraryWindow : MediaMenu;
        this._browser = new Browser({
            sections: SECTIONS,
            itemsFor: key => this._sections[key] ?? [],
            onActivate: (key, item, tile) => this._openPicked(key, item, tile),
            columns: this._settings.get_int('columns'),
            rows: this._settings.get_int('rows'),
            button: this._button,
        });
        this._browser.enable();
    }

    _toggleLibrary() {
        this._browser.toggle();
    }

    _onShortcut() {
        // A popup keeps the keyboard, unless it is the modal library's own panel.
        if (Main.actionMode === Shell.ActionMode.POPUP &&
            !(this._browser instanceof LibraryWindow && this._browser.isShowing))
            return;
        this._toggleLibrary();
    }

    _openPicked(key, item, tile) {
        if (this._detailMode() === 'modal')
            this._browser.close();
        this._dialog.popup(tile, item, sectionByKey(key));
    }

    _controlsActive() {
        return this._dialog.isOpen || this._browser.isShowing;
    }

    _controlsHome() {
        this._dialog.popdown();
        this._browser.close();
    }

    // Never over a window, where Home is the game's own button.
    _controlsOpen() {
        if (global.display.focus_window || Main.modalCount > 0)
            return;
        this._browser.open();
    }

    // The pop-up's grab would hold the game's window off. A new window maps on the
    // active workspace, hence the switch first.
    _launching() {
        this._dialog.popdown();
        this._browser.close();
        Main.overview.hide();
        if (!this._settings.get_boolean('play-on-new-workspace'))
            return;
        const workspace = this._emptyWorkspace();
        if (!workspace) {
            console.warn('[Games Library] No empty workspace to play on (Settings → Multitasking).');
            return;
        }
        workspace.activate(global.get_current_time());
    }

    // `_keepAliveId` marks a workspace the shell (a drag) or an extension holds.
    _emptyWorkspace() {
        const wm = global.workspace_manager;
        const free = ws => !ws._keepAliveId &&
            !ws.list_windows().some(w => !w.is_on_all_workspaces());
        if (Meta.prefs_get_dynamic_workspaces()) {
            const last = wm.get_workspace_by_index(wm.n_workspaces - 1);
            return free(last) ? last : wm.append_new_workspace(false, global.get_current_time());
        }
        for (let i = 0; i < wm.n_workspaces; i++) {
            const ws = wm.get_workspace_by_index(i);
            if (free(ws))
                return ws;
        }
        return null;
    }
}

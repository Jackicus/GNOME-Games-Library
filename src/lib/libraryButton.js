// The library's button beside Show Apps: the one way in, wherever the library
// opens.
//
// The button is the shell's own `ShowAppsIcon` — a DashItemContainer around a
// `show-apps` toggle with a BaseIcon in it — subclassed for its icon and its
// label, so hover, focus, the tooltip and the dash's sizing all come from the
// dash (`dash.js`). It sits in the dash, or in Dash to Panel's panel when that
// has taken the dash away.
//
// Both places the library opens in are opened from it: the "menu" library
// puts a grid in the overview's app-grid slot, the "modal" library pops a
// panel out of the button itself. What a press means is the caller's
// (`onActivate`), and so is whether the button is lit (`sync`); everything
// else about it is here. The app holds it for as long as the extension is
// enabled and hands it to whichever place the library opens in, so a rebuild
// — a rescan landing, a setting changed — leaves it where it is.
//
// Other extensions may put buttons of their own in the same place, and hook
// Dash to Panel the same way — see `_attachToPanel` for how the hooks stack
// without either pulling the other's out.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';

import {LIBRARY} from './library.js';

// Show Apps with our icon and our tooltip, and nothing to drop on it.
const LibraryIcon = GObject.registerClass(
class GamesMenuLibraryIcon extends Dash.ShowAppsIcon {
    _init(gicon) {
        // Read by _createIcon, which the BaseIcon super._init() builds calls
        // straight away — so it is set before the chain-up, as the shell sets
        // _iconActor before setDragApp() reads it.
        this._gicon = gicon;
        // eslint-disable-next-line no-restricted-syntax -- constructor() could not set it first
        super._init();
        this.setLabelText(LIBRARY.title);
    }

    _createIcon(size) {
        this._iconActor = new St.Icon({
            gicon: this._gicon,
            icon_size: size,
            style_class: 'show-apps-icon',
            track_hover: true,
        });
        return this._iconActor;
    }

    // Show Apps doubles as the dash's unpin target; the library is not one.
    _canRemoveApp() {
        return false;
    }
});

export class LibraryButton {
    // `path` is the extension's own directory, which the icon is read from:
    // lib/ runs from a staged copy that holds nothing else.
    constructor({path, onActivate}) {
        this._gicon = new Gio.FileIcon({
            file: Gio.File.new_for_path(GLib.build_filenamev([path, LIBRARY.icon])),
        });
        this._onActivate = onActivate;
        this._button = null;
        this._buttonHost = null;
        this._dashToPanel = null;
        // Whether it is lit, kept so a re-attach lights it again.
        this._checked = false;
        this._attached = false;
    }

    // Put beside Show Apps, and kept there — across Dash to Panel rebuilding
    // its panels — until `detach`. Attaching what is attached does nothing,
    // which is what lets every rebuild ask for it.
    attach() {
        if (this._attached)
            return;
        this._attached = true;
        // Dash to Panel builds its panels when it is enabled and again when
        // its settings change, either of which can come after this.
        Main.extensionManager.connectObject('extension-state-changed',
            () => this._reattach(), this);
        // It also rebuilds them on monitors-changed, which no extension state
        // reflects, and says so with `panels-created` on its own emitter.
        this._armDashToPanel();
        this._attach();
    }

    detach() {
        this._attached = false;
        Main.extensionManager.disconnectObject(this);
        this._dashToPanel?.disconnectObject?.(this);
        this._dashToPanel = null;
        this._detach();
    }

    // The button's icon, for a panel that wants to zoom out of it — or null
    // while it is not on screen (the dash is the overview's, and a shortcut
    // can be pressed on the desktop), which leaves nothing to zoom out of.
    get icon() {
        const icon = this._button?.icon;
        return icon?.mapped ? icon : null;
    }

    sync(checked) {
        this._checked = !!checked;
        this._buttonHost?.sync?.();
        if (this._button)
            this._button.toggleButton.checked = this._checked;
    }

    // ------------------------------------------------------------------

    _armDashToPanel() {
        const dashToPanel = global.dashToPanel;
        if (!dashToPanel || dashToPanel === this._dashToPanel)
            return;
        this._dashToPanel?.disconnectObject?.(this);
        this._dashToPanel = dashToPanel;
        dashToPanel.connectObject?.('panels-created', () => this._reattach(), this);
    }

    _reattach() {
        // Dash to Panel may only have appeared since we last looked.
        this._armDashToPanel();
        this._attach();
    }

    _attach() {
        this._detach();
        // The primary panel only: a button per panel would make the host's
        // release a list, and is not done.
        const panel = global.dashToPanel?.panels?.[0];
        try {
            if (panel?.showAppsIconWrapper && panel.panel && panel._updateGroupedElements)
                this._attachToPanel(panel);
            else if (Main.overview.dash?._dashContainer)
                this._attachToDash(Main.overview.dash);
        } catch (e) {
            console.warn(`[Games Menu] No button beside Show Apps: ${e}`);
            this._detach();
        }
        this.sync(this._checked);
    }

    _detach() {
        const host = this._buttonHost;
        this._buttonHost = null;
        host?.release();
        this._button = null;
    }

    _newButton() {
        const container = new LibraryIcon(this._gicon);
        container.show(false);
        container.toggleButton.connect('clicked', () => this._onActivate());
        return container;
    }

    _attachToDash(dash) {
        const container = this._button = this._newButton();
        container.icon.setIconSize(dash.iconSize);
        dash._hookUpLabel?.(container);
        dash._dashContainer.add_child(container);
        dash.connectObject('icon-size-changed',
            () => container.icon.setIconSize(dash.iconSize), this);
        this._buttonHost = {
            release: () => {
                try {
                    dash.disconnectObject(this);
                    container.destroy();
                } catch {
                    // The dash is on its way out.
                }
            },
        };
    }

    // Dash to Panel lays out only the elements it knows, in groups it works
    // out from its settings. Ours is one more element, put into the group
    // Show Apps is in, straight after it, each time the groups are made —
    // which is a wrapper round the panel's own `_updateGroupedElements`.
    //
    // Another extension can wrap the same method on the same panel, for its
    // own buttons (Video Menu puts its button there the same way). Each
    // wrapper calls whatever was there before it, so any number of them
    // stack; what must not happen is one of them taking the method back by
    // deleting it, which takes every wrapper put on after it too. So ours is
    // only ever taken back while it is still the one on the panel, and then
    // by putting back exactly what it found. With someone else's wrapper over
    // it, it stays where it is, as the link in their chain it has become, and
    // passes straight through.
    _attachToPanel(panel) {
        const showApps = panel.showAppsIconWrapper.realShowAppsIcon;
        const box = new St.BoxLayout({
            orientation: panel.geom?.vertical
                ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL,
        });
        const container = this._button = this._newButton();
        container.icon.setIconSize(showApps.icon.iconSize);
        const style = showApps.toggleButton.get_style();
        if (style)
            container.toggleButton.set_style(style);
        container.toggleButton.connect('notify::hover', button => {
            if (button.hover)
                container.showLabel();
            else
                container.hideLabel();
        });
        box.add_child(container);

        // What the panel had before us: its class's method, or another
        // extension's wrapper, which is an own property just as ours is.
        const stock = panel._updateGroupedElements;
        const stockWasOwn = Object.prototype.hasOwnProperty.call(panel, '_updateGroupedElements');
        // Cleared on release. From then on the wrapper is only a link to
        // `stock`, for whoever may have wrapped over it.
        let element = {actor: box, box: new Clutter.ActorBox()};
        const wrapper = function (positions) {
            stock.call(this, positions);
            if (!element)
                return;
            for (const group of this._elementGroups ?? []) {
                const at = group.elements.findIndex(e => e.actor === showApps);
                if (at < 0)
                    continue;
                element.position = group.elements[at].position;
                group.elements.splice(at + 1, 0, element);
                if (group.expandableIndex > at)
                    group.expandableIndex++;
                break;
            }
            box.visible = showApps.visible;
        };

        // The way out is in place before anything is put into the panel, so
        // a throw part-way through still has it to call.
        let released = false;
        box.connect('destroy', () => (released = true));
        this._buttonHost = {
            // The panel sizes its icons after it is made, and again as it fills.
            sync: () => {
                container.icon.setIconSize(showApps.icon.iconSize);
                container.toggleButton.set_style(showApps.toggleButton.get_style());
            },
            release: () => {
                element = null;
                if (panel._updateGroupedElements === wrapper) {
                    if (stockWasOwn)
                        panel._updateGroupedElements = stock;
                    else
                        delete panel._updateGroupedElements;
                }
                if (!released)
                    box.destroy();
                try {
                    panel.updateElementPositions?.();
                } catch {
                    // The panel itself is on its way out.
                }
            },
        };

        panel.panel.add_child(box);
        panel._updateGroupedElements = wrapper;
        panel.updateElementPositions?.();
    }
}

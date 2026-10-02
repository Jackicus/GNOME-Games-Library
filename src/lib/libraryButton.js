// The library's button beside Show Apps, in the dash or in Dash to Panel's panel:
// the shell's ShowAppsIcon with our icon and label.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';

import {LIBRARY} from './library.js';

const LibraryIcon = GObject.registerClass(
class GamesLibraryLibraryIcon extends Dash.ShowAppsIcon {
    _init(gicon) {
        // Read by _createIcon, which super._init() calls.
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
    // `path` is the extension's directory: lib/ runs from a staged copy.
    constructor({path, onActivate}) {
        this._gicon = new Gio.FileIcon({
            file: Gio.File.new_for_path(GLib.build_filenamev([path, LIBRARY.icon])),
        });
        this._onActivate = onActivate;
        this._button = null;
        this._buttonHost = null;
        this._dashToPanel = null;
        this._checked = false;
        this._attached = false;
    }

    attach() {
        if (this._attached)
            return;
        this._attached = true;
        // Dash to Panel rebuilds its panels when enabled, on a setting, and on
        // monitors-changed, which only its own `panels-created` says.
        Main.extensionManager.connectObject('extension-state-changed',
            () => this._reattach(), this);
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

    // Null off screen, where there is nothing for a panel to zoom out of.
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

    _armDashToPanel() {
        const dashToPanel = global.dashToPanel;
        if (!dashToPanel || dashToPanel === this._dashToPanel)
            return;
        this._dashToPanel?.disconnectObject?.(this);
        this._dashToPanel = dashToPanel;
        dashToPanel.connectObject?.('panels-created', () => this._reattach(), this);
    }

    _reattach() {
        this._armDashToPanel();
        this._attach();
    }

    _attach() {
        this._detach();
        // The primary panel only.
        const panel = global.dashToPanel?.panels?.[0];
        try {
            if (panel?.showAppsIconWrapper && panel.panel && panel._updateGroupedElements)
                this._attachToPanel(panel);
            else if (Main.overview.dash?._dashContainer)
                this._attachToDash(Main.overview.dash);
        } catch (e) {
            console.warn(`[Games Library] No button beside Show Apps: ${e}`);
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

    // Ours is put after Show Apps each time Dash to Panel groups its elements. The
    // wrapper comes off only while outermost; see docs/design.md.
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

        const stock = panel._updateGroupedElements;
        const stockWasOwn = Object.prototype.hasOwnProperty.call(panel, '_updateGroupedElements');
        // Cleared on release, leaving the wrapper a pass-through for any wrapped over it.
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

        // Dash to Panel may destroy the box before release.
        let released = false;
        box.connect('destroy', () => (released = true));
        this._buttonHost = {
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

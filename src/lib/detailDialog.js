// A picked game, popped up the way an app folder opens: zoomed out of its tile at
// the artwork's width, then widened onto the details. See docs/design.md.

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Duration, Ease, ensureStyleDeep} from './anim.js';
import {DetailView} from './detailView.js';
import {MediaPanel} from './panel.js';
import {PANE_INSET} from './shape.js';

export const DetailDialog = GObject.registerClass(
class GamesLibraryDetailDialog extends MediaPanel {
    constructor({onOpen, size = 1, mode = 'menu'}) {
        super({
            size,
            // "modal" outlives the overview, so it is never hosted in it.
            host: mode === 'modal' ? Main.layoutManager.uiGroup : null,
            dieWithSource: mode !== 'modal',
            inset: PANE_INSET,
        });

        this._mode = mode;

        // The pane is laid out once at the open width; widening the clip reveals the
        // second column rather than reflowing it every frame.
        this._clip = new St.Widget({
            layout_manager: new Clutter.FixedLayout(),
            x_expand: true,
            y_expand: true,
            clip_to_allocation: true,
        });
        this._panel.add_child(this._clip);

        this._detail = new DetailView({onOpen});
        this._detail.actor.set_position(0, 0);
        this._clip.add_child(this._detail.actor);

        this._narrowWidth = 320;
        this._wideWidth = 320;

        this._item = null;
        this._section = null;

        this.connect('destroy', () => this._detail.destroy());
    }

    // Filled first: the panel's size is measured off the side column.
    _prepare(budget) {
        const frame = 2 * this._framePx;
        this._detail.setSize(budget.width - frame, budget.height - frame);
        this._detail.populate(this._item, this._section);
    }

    // Closed, the panel is the side column: the artwork and the buttons under it.
    _sizePanel(budget) {
        const frame = 2 * this._framePx;

        // Unstyled, the column measures 26 px short and the clip cuts the corners.
        ensureStyleDeep(this._detail.actor);

        const pad = 2 * this._detail.padding;
        const [, sideWidth] = this._detail.side.get_preferred_width(-1);
        const [, sideHeight] = this._detail.side.get_preferred_height(sideWidth);

        // Never shorter than the column (HERO_MIN on a small work area); the work
        // area is the ceiling.
        const paneWidth = budget.width - frame;
        const paneHeight = Math.min(Math.ceil(sideHeight) + pad, budget.maxHeight - frame);
        this._wideWidth = budget.width;
        this._narrowWidth = Math.min(budget.width, Math.ceil(sideWidth) + pad + frame);

        this._detail.setSize(paneWidth, paneHeight);
        this._detail.actor.set_size(paneWidth, paneHeight);
        this._panel.remove_all_transitions();
        this._panel.set_size(this._narrowWidth, paneHeight + frame);
        this._restSize = [this._narrowWidth, paneHeight + frame];
    }

    _opened() {
        this._widen();
    }

    _closeSequence() {
        this._narrowAndZoomOut();
    }

    // After the zoom, not during it: the zoom's scale is a ratio of this width.
    _widen() {
        if (!this.isOpen)
            return;
        this._detail.revealMain({delay: Duration.NORMAL / 4});
        if (this._wideWidth <= this._narrowWidth)
            return;
        this._panel.ease({
            width: this._wideWidth,
            duration: Duration.NORMAL,
            mode: Ease.OUT_EXPO,
        });
    }

    // Narrowed back to the artwork, so what zooms home is the tile's shape.
    _narrowAndZoomOut() {
        this._panel.remove_transition('width');
        this._closingLead = 0;
        if (!this._source?.mapped || this._panel.width <= this._narrowWidth) {
            this._zoomAndFadeOut();
            return;
        }
        this._detail.hideMain();
        this._closingLead = Duration.FAST;
        this._panel.ease({
            width: this._narrowWidth,
            duration: Duration.FAST,
            mode: Ease.OUT,
            onComplete: () => this._zoomAndFadeOut(),
        });
    }

    popup(source, item, section) {
        if (this.isOpen)
            return;

        this.accessible_name = item.title;
        this._item = item;
        this._section = section;

        // Hiding the overview unmaps the tile, so the panel fades in centred.
        if (this._mode === 'modal' && Main.overview.visible) {
            Main.overview.hide();
            source = null;
        }

        super.popup(source);
    }
});

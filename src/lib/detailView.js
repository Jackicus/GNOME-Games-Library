// A picked game: artwork and actions on the left, title, facts, synopsis and
// details on the right. Drawn on the detail panel, so it has no frame of its own.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';

import {Duration, Ease, staggerIn} from './anim.js';
import {fillOnScroll} from './lazyList.js';
import {artworkStyle, createArtwork, createActionButton, createLabel, createPill, createRow} from './widgets.js';
import {PANE_INSET, radiusStyle} from './shape.js';
import {adjustAnimationTime, ensureActorVisibleInScrollView} from 'resource:///org/gnome/shell/misc/animationUtils.js';

// Logical pixels. With PANE_INSET, 32 px between the panel's edge and the artwork;
// the stylesheet's .gm-pane-content padding must agree.
const PADDING = 32 - PANE_INSET;

// The pop-up is a folder-sized panel, not the work area.
const HERO_MAX_HEIGHT = 560;
const HERO_RESERVED = 2 * 52 + 28;         // two action buttons and the gaps
const HERO_MAX_WIDTH_FRACTION = 0.34;      // of the pane width
const HERO_MIN = 132;
// 14 px type at the stylesheet's line-height of 1.5.
const SUMMARY_LINE = 21;
const SUMMARY_LINES = 5;
const FIRST_ROWS = 24;
const ROWS_PER_BATCH = 16;

export class DetailView {
    constructor({onOpen}) {
        this._onOpen = onOpen;
        this._list = null;
        this._listHost = null;
        this._width = 0;
        this._height = 0;
        this._deferredList = 0;
        this._deferredMain = 0;
        this._columns = null;
        this._main = null;
        this._buildPendingMain = null;
        this.hero = null;
        this.side = null;
        this.item = null;

        this.actor = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            y_expand: true,
        });
    }

    destroy() {
        this._cancelDeferred();
        this.actor.destroy();
    }

    setSize(width, height) {
        this._width = width;
        this._height = height;
    }

    _cancelDeferred() {
        if (this._deferredList) {
            GLib.source_remove(this._deferredList);
            this._deferredList = 0;
        }
        if (this._deferredMain) {
            GLib.source_remove(this._deferredMain);
            this._deferredMain = 0;
        }
    }

    // Physical pixels, for the dialog to size its panel around the side column.
    get padding() {
        return PADDING * this._scale;
    }

    get _scale() {
        return St.ThemeContext.get_for_stage(global.stage).scale_factor;
    }

    _heroSize(aspect) {
        const scale = this._scale;
        const room = this._height - 2 * this.padding - HERO_RESERVED * scale;
        const byHeight = Math.min(HERO_MAX_HEIGHT * scale, room);
        const byWidth = Math.round(this._width * HERO_MAX_WIDTH_FRACTION * aspect);
        // The panel grows around HERO_MIN rather than the artwork vanishing.
        const height = Math.max(HERO_MIN * scale, Math.min(byHeight, byWidth));
        return {width: Math.round(height / aspect), height};
    }

    // `mainColumn: 'held'` leaves the second column for `revealMain()`.
    populate(item, section, {mainColumn = 'auto'} = {}) {
        this._cancelDeferred();
        this.actor.destroy_all_children();
        this.item = item;
        this._list = null;
        this._listHost = null;
        this._main = null;

        const pane = new St.Widget({
            style_class: 'gm-pane',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
            clip_to_allocation: true,
            style: radiusStyle('paneInner'),
        });
        this.actor.add_child(pane);

        if (item.backdrop) {
            const backdrop = new St.Widget({style_class: 'gm-backdrop', x_expand: true, y_expand: true});
            backdrop.set_style(artworkStyle(item.backdrop, 'paneInner'));
            pane.add_child(backdrop);
                pane.add_child(new St.Widget({
                style_class: 'gm-backdrop-veil',
                x_expand: true,
                y_expand: true,
                style: radiusStyle('paneInner'),
            }));
        }

        const columns = new St.BoxLayout({style_class: 'gm-pane-content', x_expand: true, y_expand: true});
        pane.add_child(columns);
        this._columns = columns;
        this.side = this._buildSide(item, section);
        columns.add_child(this.side);

        // The second column is built off the zoom's frames, on an idle.
        this._buildPendingMain = () => this._buildMain(item);
        this._deferredMain = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._deferredMain = 0;
            this._addMain();
            if (mainColumn === 'auto')
                this.revealMain();
            return GLib.SOURCE_REMOVE;
        });
    }

    _addMain() {
        if (!this._buildPendingMain)
            return;
        const build = this._buildPendingMain;
        this._buildPendingMain = null;
        if (this._deferredMain) {
            GLib.source_remove(this._deferredMain);
            this._deferredMain = 0;
        }
        this._main = build();
        this._main.opacity = 0;
        this._columns.add_child(this._main);
    }

    revealMain({delay = 0} = {}) {
        this._addMain();
        this._main?.ease({opacity: 255, delay, duration: Duration.NORMAL, mode: Ease.OUT});
        this._fillList(delay + Duration.NORMAL);
    }

    // A timer, not an idle: an idle lands mid-animation.
    _fillList(after) {
        if (this._deferredList || this._list || !this._listHost)
            return;
        this._deferredList = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            adjustAnimationTime(after), () => {
                this._deferredList = 0;
                this._showList();
                return GLib.SOURCE_REMOVE;
            });
    }

    hideMain({duration = Duration.FAST} = {}) {
        this._main?.ease({opacity: 0, duration, mode: Ease.OUT});
    }

    _buildSide(item, section) {
        // Clutter would otherwise expand it for its expanding buttons.
        const side = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'gm-detail-side', x_expand: false, y_expand: true});

        const {width: heroW, height: heroH} = this._heroSize(section.aspect);
        this.hero = createArtwork({
            path: item.art,
            title: item.title,
            icon: section.icon,
            width: heroW,
            height: heroH,
            styleClass: 'gm-art gm-hero',
            radius: 'hero',
        });
        side.add_child(this.hero);

        if (item.playPath) {
            const play = createActionButton({
                label: item.playLabel,
                icon: 'media-playback-start-symbolic',
            });
            play.set_x_expand(true);
            play.connect('clicked', () => this._onOpen(item.playPath));
            side.add_child(play);
        }

        if (item.folder) {
            const folder = createActionButton({
                label: 'Show in Files',
                icon: 'folder-symbolic',
                styleClass: 'button gm-action-secondary',
            });
            folder.set_x_expand(true);
            folder.connect('clicked', () => this._onOpen(item.folder));
            side.add_child(folder);
        }

        return side;
    }

    _buildMain(item) {
        const main = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, y_expand: true, style_class: 'gm-detail-main'});

        main.add_child(createLabel(item.title, 'gm-detail-title'));

        const facts = new St.BoxLayout({style_class: 'gm-facts', y_align: Clutter.ActorAlign.CENTER});
        if (item.subtitle)
            facts.add_child(createPill(item.subtitle, 'gm-fact gm-fact-strong'));
        if (item.year)
            facts.add_child(createPill(String(item.year), 'gm-fact'));
        if (item.rating)
            facts.add_child(createPill(`★ ${item.rating}`, 'gm-fact gm-fact-rating'));
        if (item.countLabel)
            facts.add_child(createPill(item.countLabel, 'gm-fact'));
        for (const tag of item.tags)
            facts.add_child(createPill(tag, 'gm-fact gm-fact-tag'));
        if (facts.get_n_children())
            main.add_child(facts);

        if (item.summary) {
            const summary = new St.Label({text: item.summary, style_class: 'gm-summary', x_expand: true});
            summary.clutter_text.line_wrap = true;
            summary.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
            summary.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            // A fixed height makes Pango ellipsise the last visible line.
            summary.height = SUMMARY_LINE * this._scale * SUMMARY_LINES;
            summary.y_expand = false;
            main.add_child(summary);
        }

        main.add_child(new St.Label({text: item.details.name, style_class: 'gm-group-heading'}));

        this._listHost = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
            clip_to_allocation: true,
        });
        main.add_child(this._listHost);
        return main;
    }

    _showList() {
        const {entries} = this.item.details;
        this._list = entries.length
            ? this._buildList(entries)
            : new St.Label({text: 'Nothing here yet.', style_class: 'gm-empty-hint', x_expand: true});
        this._listHost.add_child(this._list);
    }

    _buildList(entries) {
        const scroll = new St.ScrollView({x_expand: true, y_expand: true, overlay_scrollbars: true, style_class: 'vfade gm-list-scroll'});
        scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        const box = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style_class: 'gm-list'});
        scroll.set_child(box);

        let next = 0;
        let first = true;
        fillOnScroll(scroll, () => {
            const limit = Math.min(entries.length, next + (first ? FIRST_ROWS : ROWS_PER_BATCH));
            const batch = [];
            for (; next < limit; next++) {
                const entry = entries[next];
                const row = createRow({
                    index: entry.index,
                    title: entry.title,
                    subtitle: entry.subtitle,
                    badges: entry.badges,
                    size: entry.size,
                    icon: entry.icon,
                    onActivate: () => this._onOpen(entry.path),
                });
                // A Tab past the fold has to scroll, or the list is never topped up.
                row.connect('key-focus-in', () => ensureActorVisibleInScrollView(scroll, row));
                batch.push(row);
                box.add_child(row);
            }
            if (first)
                staggerIn(batch, {step: 12, cap: 160, fromY: 8});
            first = false;
            return next < entries.length;
        });
        return scroll;
    }
}

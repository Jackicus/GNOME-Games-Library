// St building blocks for the views; the stylesheet's gm-* classes paint them.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';

import {radiusStyle} from './shape.js';

// St rounds a background image only with the radius in the same inline style.
export function artworkStyle(path, part = 'art') {
    return `background-image: url("file://${encodeURI(path)}"); background-size: cover; ${radiusStyle(part)}`;
}

export function createLabel(text, styleClass, props = {}) {
    const label = new St.Label({text, style_class: styleClass, ...props});
    label.clutter_text.single_line_mode = true;
    label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    return label;
}

// A missing image is a placeholder the stylesheet tints with the accent colour.
export function createArtwork({path, title, icon, width, height, styleClass = 'gm-art', radius = 'art'}) {
    const art = new St.Widget({
        style_class: styleClass,
        width,
        height,
        layout_manager: new Clutter.BinLayout(),
        // Unclipped, so the focus ring shows; not expanded, or the placeholder's
        // centring box would stretch it.
        x_expand: false,
        y_expand: false,
    });
    if (path) {
        art.set_style(artworkStyle(path, radius));
        return art;
    }

    art.set_style(radiusStyle(radius));
    art.add_style_class_name('gm-art-placeholder');
    const stack = new St.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        y_expand: true,
        clip_to_allocation: true,
        style_class: 'gm-art-placeholder-content',
    });
    // `width` is physical pixels, `icon_size` logical.
    const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    stack.add_child(new St.Icon({
        icon_name: icon,
        icon_size: Math.max(24, Math.round(width * 0.22 / scale)),
        style_class: 'gm-art-placeholder-icon',
        x_align: Clutter.ActorAlign.CENTER,
    }));
    if (title && width >= 120) {
        const label = new St.Label({
            text: title,
            style_class: 'gm-art-placeholder-title',
            x_align: Clutter.ActorAlign.CENTER,
            width: Math.round(width * 0.8),
        });
        label.clutter_text.line_wrap = true;
        label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        label.clutter_text.x_align = Clutter.ActorAlign.CENTER;
        label.height = Math.min(64, Math.round(height * 0.3));
        stack.add_child(label);
    }
    art.add_child(stack);
    return art;
}

export function createActionButton({label, icon, styleClass = 'button default gm-action'}) {
    const content = new St.BoxLayout({style_class: 'gm-action-content', y_align: Clutter.ActorAlign.CENTER});
    if (icon)
        content.add_child(new St.Icon({icon_name: icon, icon_size: 16, y_align: Clutter.ActorAlign.CENTER}));
    content.add_child(new St.Label({text: label, y_align: Clutter.ActorAlign.CENTER}));
    return new St.Button({
        style_class: styleClass,
        reactive: true,
        can_focus: true,
        track_hover: true,
        child: content,
    });
}

export function createTitles(title = '', subtitle = '') {
    const actor = new St.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL,
        style_class: 'gm-header-titles',
        y_align: Clutter.ActorAlign.CENTER,
    });
    const titleLabel = new St.Label({style_class: 'gm-header-title', text: title});
    const subtitleLabel = new St.Label({style_class: 'gm-header-subtitle', text: subtitle});
    actor.add_child(titleLabel);
    actor.add_child(subtitleLabel);
    return {actor, titleLabel, subtitleLabel};
}

// `styleClass` is required: there is no bare pill rule.
export function createPill(text, styleClass, style = null) {
    return new St.Label({text, style_class: styleClass, style, y_align: Clutter.ActorAlign.CENTER});
}

// Only the row tracks hover, so a pointer crossing is one repaint.
export function createRow({index, title, subtitle, badges = [], size, icon, onActivate}) {
    const row = new St.Button({
        style_class: 'button flat gm-row',
        reactive: true,
        can_focus: true,
        track_hover: true,
        x_expand: true,
        style: radiusStyle(),
    });
    const content = new St.BoxLayout({x_expand: true, y_align: Clutter.ActorAlign.CENTER});

    // A label sized in CSS draws its text at the top, so the disc is a bin.
    content.add_child(new St.Bin({
        style_class: 'gm-row-index',
        y_align: Clutter.ActorAlign.CENTER,
        child: new St.Label({
            text: String(index),
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        }),
    }));

    const titleLabel = createLabel(title, 'gm-row-title', {x_expand: true, y_align: Clutter.ActorAlign.CENTER});
    if (subtitle) {
        const text = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, y_align: Clutter.ActorAlign.CENTER, style_class: 'gm-row-text'});
        text.add_child(titleLabel);
        text.add_child(createLabel(subtitle, 'gm-row-subtitle'));
        content.add_child(text);
    } else {
        titleLabel.add_style_class_name('gm-row-text');
        content.add_child(titleLabel);
    }

    for (const badge of badges)
        content.add_child(createPill(badge, 'gm-badge', radiusStyle('badge')));
    if (size)
        content.add_child(new St.Label({text: size, style_class: 'gm-row-size', y_align: Clutter.ActorAlign.CENTER}));

    content.add_child(new St.Icon({
        icon_name: icon,
        icon_size: 16,
        style_class: 'gm-row-icon',
        y_align: Clutter.ActorAlign.CENTER,
    }));

    row.set_child(content);
    row.connect('clicked', () => onActivate?.());
    return row;
}

// Durations and curves of a piece with the shell's (ease-out-quad 250 ms, windows
// popping in with ease-out-expo 150 ms).

import Clutter from 'gi://Clutter';

import {adjustAnimationTime} from 'resource:///org/gnome/shell/misc/animationUtils.js';

export const Duration = {
    FAST: 120,     // hover, pressed state, things leaving
    NORMAL: 200,   // things arriving, a panel zooming
};

export const Ease = {
    OUT: Clutter.AnimationMode.EASE_OUT_QUAD,
    OUT_EXPO: Clutter.AnimationMode.EASE_OUT_EXPO,
    // Only for a folder's icon coming back as its dialog closes.
    IN: Clutter.AnimationMode.EASE_IN_QUAD,
};

// The scale a window pops in from.
export const POP_SCALE = 0.94;

// For a Clutter effect's properties, which `actor.ease()` cannot reach. Returns
// the timeline, to stop if the effect goes first.
export function easeProps(object, targets, {duration = Duration.NORMAL, mode = Ease.OUT, onComplete} = {}) {
    const time = adjustAnimationTime(duration);
    const entries = Object.entries(targets).map(([key, to]) => [key, object[key], to]);
    const land = () => {
        for (const [key, , to] of entries)
            object[key] = to;
        onComplete?.();
    };
    // Animations are off.
    if (time < 1) {
        land();
        return null;
    }

    const timeline = new Clutter.Timeline({
        actor: global.stage,
        duration: time,
        progress_mode: mode,
    });
    timeline.connect('new-frame', () => {
        const t = timeline.get_progress();
        for (const [key, from, to] of entries)
            object[key] = from + (to - from) * t;
    });
    timeline.connect('stopped', (_timeline, finished) => {
        if (finished)
            land();
    });
    timeline.start();
    return timeline;
}

export function staggerIn(actors, {step = 12, cap = 150, fromY = 10, duration = Duration.NORMAL} = {}) {
    actors.forEach((actor, i) => {
        actor.remove_all_transitions();
        actor.opacity = 0;
        actor.translation_y = fromY;
        actor.ease({
            opacity: 255,
            translation_y: 0,
            delay: Math.min(i * step, cap),
            duration,
            mode: Ease.OUT,
        });
    });
}

// Before a first map, a widget's own spacing and margins are not picked up, and
// `ensure_style` on a parent does not reach its children.
export function ensureStyleDeep(actor) {
    actor.ensure_style?.();
    for (const child of actor.get_children())
        ensureStyleDeep(child);
}

export function rectIn(actor, ancestor) {
    const [ax, ay] = ancestor.get_transformed_position();
    const [x, y] = actor.get_transformed_position();
    const [width, height] = actor.get_transformed_size();
    return {x: x - ax, y: y - ay, width, height};
}

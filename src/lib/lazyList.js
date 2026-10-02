// Fills a scroll view a batch at a time, more as it nears its end, so opening a
// long list does not stall the compositor mid-animation.

import GLib from 'gi://GLib';

const MARGIN = 600;

// `buildBatch()` appends the next batch and returns false when nothing is left.
export function fillOnScroll(scroll, buildBatch, {margin = MARGIN} = {}) {
    const adjustment = scroll.vadjustment;
    let more = buildBatch();
    let pending = 0;

    // page_size is 0 until the view is first allocated.
    const wantsMore = () => adjustment.page_size > 0 &&
        (adjustment.upper <= adjustment.page_size + 1 ||
         adjustment.value + adjustment.page_size >= adjustment.upper - margin);

    const topUp = () => {
        if (pending || !more)
            return;
        pending = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            pending = 0;
            if (more && wantsMore()) {
                more = buildBatch();
                topUp();
            }
            return GLib.SOURCE_REMOVE;
        });
    };

    adjustment.connect('notify::value', topUp);
    adjustment.connect('notify::upper', topUp);
    adjustment.connect('notify::page-size', topUp);
    // The adjustment is disposed with the scroll view; only the idle needs removing.
    scroll.connect('destroy', () => {
        if (pending)
            GLib.source_remove(pending);
        pending = 0;
        more = false;
    });

    topUp();
}

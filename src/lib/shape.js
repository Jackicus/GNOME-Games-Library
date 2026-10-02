// The `corner-radius` setting, scaled into each surface's radius. St CSS has no
// variables, so each rounded surface takes it inline; the stylesheet's values are
// fallbacks.

const DEFAULT_RADIUS = 18;

// The shell's $base_padding, in logical pixels for a CSS string.
export const PANE_INSET = 6;

const PART = {
    art: r => r,
    hero: r => r + 4,
    pane: r => r + 12,
    // Concentric with the panel's corner.
    paneInner: r => Math.max(0, r + 12 - PANE_INSET),
    badge: r => Math.round(r / 2),
};

// One string per radius, so tiles share a theme node.
let styles = {};

export function setCornerRadius(px) {
    styles = {};
    for (const [part, scale] of Object.entries(PART))
        styles[part] = `border-radius: ${scale(px)}px;`;
}
setCornerRadius(DEFAULT_RADIUS);

export function radiusStyle(part = 'art') {
    return styles[part];
}

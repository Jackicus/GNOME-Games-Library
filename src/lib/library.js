// Reads ~/.cache/games-library/library.json, which the scanner writes, and
// normalises each game for the views.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const SECTIONS = [
    {
        key: 'games',
        prefix: 'games',
        title: 'Games',
        icon: 'applications-games-symbolic',
        aspect: 1.5,
    },
];

// `-symbolic`, so St recolours it as it does Show Apps.
export const LIBRARY = {
    title: 'Games',
    icon: 'icons/library-symbolic.svg',
};

export function sectionByKey(key) {
    return SECTIONS.find(s => s.key === key) ?? SECTIONS[0];
}

function cacheDir() {
    return GLib.build_filenamev([GLib.get_user_cache_dir(), 'games-library']);
}

export function libraryPath() {
    return GLib.build_filenamev([cacheDir(), 'library.json']);
}

export function libraryCountLabel(count) {
    return count ? `${count} in your library` : 'Nothing indexed yet';
}

export function readSections() {
    const nothing = {sections: {}, generated: null};
    const path = libraryPath();
    if (!GLib.file_test(path, GLib.FileTest.EXISTS))
        return nothing;
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        if (!ok)
            return nothing;
        const raw = JSON.parse(new TextDecoder('utf-8').decode(bytes));
        return {sections: raw?.sections ?? {}, generated: raw?.generated ?? null};
    } catch (e) {
        console.error(`[Games Library] Failed to read ${path}: ${e}`);
        return nothing;
    }
}

export function loadLibrary() {
    const empty = Object.fromEntries(SECTIONS.map(s => [s.key, []]));
    const {sections} = readSections();
    const art = artworkIndex();
    const out = {...empty};
    for (const section of SECTIONS) {
        const items = sections[section.key];
        if (Array.isArray(items))
            out[section.key] = items.map(item => normalizeGame(item, art)).filter(Boolean);
    }
    return out;
}

// St paints a missing image as nothing, so a cleared cache must show as missing.
// The art folders are listed once rather than a stat per item; a path outside
// them counts as missing, since it could be on a sleeping share.
const ART_DIRS = ['posters', 'backdrops'];

function listNames(path) {
    const names = new Set();
    let children;
    try {
        children = Gio.File.new_for_path(path).enumerate_children(
            'standard::name', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    } catch {
        return names;
    }
    let info;
    while ((info = children.next_file(null)) !== null)
        names.add(info.get_name());
    children.close(null);
    return names;
}

function artworkIndex() {
    const root = cacheDir();
    const index = new Map();
    for (const name of ART_DIRS) {
        const dir = GLib.build_filenamev([root, name]);
        index.set(dir, listNames(dir));
    }
    return index;
}

function exists(path, art) {
    if (!path)
        return false;
    const cut = path.lastIndexOf('/');
    return art.get(path.slice(0, cut))?.has(path.slice(cut + 1)) ?? false;
}

function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

const PLATFORM_NAMES = {steam: 'Steam', ps2: 'PlayStation 2'};

// Steam counts minutes; past two hours, hours read better.
function playtimeLabel(minutes) {
    if (!minutes || minutes < 1)
        return null;
    if (minutes < 120)
        return `${plural(minutes, 'minute')} played`;
    return `${plural(Math.round(minutes / 60), 'hour')} played`;
}

function normalizeGame(game, art) {
    if (!game || !game.title)
        return null;
    const platform = PLATFORM_NAMES[game.platform] ?? 'Game';
    const played = playtimeLabel(game.playtime_minutes);
    const folder = game.folder_path ?? null;

    const entries = [];
    if (folder) {
        entries.push({
            index: entries.length + 1,
            title: game.platform === 'ps2' ? 'Disc image' : 'Install folder',
            subtitle: game.platform === 'ps2' ? (game.disc_path ?? folder) : folder,
            path: folder,
            icon: 'folder-symbolic',
            badges: game.disc_format ? [game.disc_format.toUpperCase()] : [],
            size: game.size_mb ? `${Math.round(game.size_mb)} MB` : null,
        });
    }
    if (played) {
        entries.push({
            index: entries.length + 1,
            title: 'Playtime',
            subtitle: played,
            path: null,
            icon: 'preferences-system-time-symbolic',
            badges: [],
            size: null,
        });
    }
    if (game.serial) {
        entries.push({
            index: entries.length + 1,
            title: 'Serial',
            subtitle: game.serial,
            path: null,
            icon: 'media-optical-symbolic',
            badges: [],
            size: null,
        });
    }

    const launch = Array.isArray(game.launch) && game.launch.every(a => typeof a === 'string' && a)
        ? game.launch : null;
    return {
        id: game.id ?? game.title,
        kind: 'games',
        title: game.title,
        subtitle: platform,
        year: game.year ?? null,
        rating: game.rating ?? null,
        tags: Array.isArray(game.genres) ? game.genres.slice(0, 3) : [],
        summary: game.summary ?? null,
        art: exists(game.poster_path, art) ? game.poster_path : null,
        backdrop: exists(game.backdrop_path, art) ? game.backdrop_path : null,
        folder,
        countLabel: played,
        details: {name: 'Details', entries},
        playPath: launch,
        playLabel: 'Play',
    };
}

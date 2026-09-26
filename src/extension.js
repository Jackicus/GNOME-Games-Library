import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {GamesLibraryApp} from './lib/app.js';

export default class GamesLibraryExtension extends Extension {
    enable() {
        this._app = new GamesLibraryApp(this);
        this._app.enable();
    }

    disable() {
        this._app.disable();
        this._app = null;
    }
}

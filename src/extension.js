import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {GamesMenuApp} from './lib/app.js';

export default class GamesMenuExtension extends Extension {
    enable() {
        this._app = new GamesMenuApp(this);
        this._app.enable();
    }

    disable() {
        this._app.disable();
        this._app = null;
    }
}

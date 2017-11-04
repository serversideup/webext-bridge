"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Endpoint {
    constructor(path) {
        this._path = path;
    }
    get path() {
        return this._path;
    }
    isInternal() {
        return this.isInternalImpl(false);
    }
    isReallyInternal() {
        return this.isInternalImpl(true);
    }
    toString() {
        return this._path;
    }
    isInternalImpl(strict) {
        if (!strict && this._path.indexOf('devtools') === 0) {
            return true;
        }
        // 'content-script:frame#2' || 'window@712' => false
        return !(/window|frame/.test(this._path));
    }
}
exports.Endpoint = Endpoint;
//# sourceMappingURL=Endpoint.js.map
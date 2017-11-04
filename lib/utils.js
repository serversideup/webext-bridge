"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function uuid() {
    return ('oooooo').replace(/[o]/g, (c) => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}
exports.uuid = uuid;
//# sourceMappingURL=utils.js.map
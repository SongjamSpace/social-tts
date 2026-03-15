"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBundle = parseBundle;
function parseBundle(json) {
    const b = JSON.parse(json);
    if (!b || b.version !== 1 || typeof b.host !== "string" || typeof b.privateKeyPem !== "string") {
        throw new Error("Invalid connection bundle");
    }
    return {
        version: 1,
        host: b.host,
        port: typeof b.port === "number" ? b.port : 22,
        user: typeof b.user === "string" ? b.user : "root",
        privateKeyPem: b.privateKeyPem,
        mint: typeof b.mint === "string" ? b.mint : undefined,
        label: typeof b.label === "string" ? b.label : undefined,
    };
}

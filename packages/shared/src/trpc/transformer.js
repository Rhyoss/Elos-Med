"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dermaosTransformer = void 0;
const DATE_MARKER = '__dermaos_date';
function isPlainObject(value) {
    if (value === null || typeof value !== 'object')
        return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
function encode(value) {
    if (value instanceof Date) {
        return { [DATE_MARKER]: value.toISOString() };
    }
    if (Array.isArray(value)) {
        return value.map(encode);
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
    }
    return value;
}
function isEncodedDate(value) {
    return (isPlainObject(value) &&
        typeof value[DATE_MARKER] === 'string' &&
        Object.keys(value).length === 1);
}
function isJsonEnvelope(value) {
    return (isPlainObject(value) &&
        'json' in value &&
        Object.keys(value).every((key) => key === 'json' || key === 'meta'));
}
function decode(value) {
    if (isJsonEnvelope(value)) {
        return decode(value.json);
    }
    if (isEncodedDate(value)) {
        return new Date(value[DATE_MARKER]);
    }
    if (Array.isArray(value)) {
        return value.map(decode);
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
    }
    return value;
}
exports.dermaosTransformer = {
    input: {
        serialize: (value) => ({ json: encode(value) }),
        deserialize: decode,
    },
    output: {
        serialize: (value) => ({ json: encode(value) }),
        deserialize: decode,
    },
};
//# sourceMappingURL=transformer.js.map
const DATE_MARKER = '__dermaos_date';

type EncodedDate = { [DATE_MARKER]: string };
type JsonEnvelope = { json: unknown; meta?: unknown };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function encode(value: unknown): unknown {
  if (value instanceof Date) {
    return { [DATE_MARKER]: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return value.map(encode);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, encode(item)]),
    );
  }

  return value;
}

function isEncodedDate(value: unknown): value is EncodedDate {
  return (
    isPlainObject(value) &&
    typeof value[DATE_MARKER] === 'string' &&
    Object.keys(value).length === 1
  );
}

function isJsonEnvelope(value: unknown): value is JsonEnvelope {
  return (
    isPlainObject(value) &&
    'json' in value &&
    Object.keys(value).every((key) => key === 'json' || key === 'meta')
  );
}

function decode(value: unknown): unknown {
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
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, decode(item)]),
    );
  }

  return value;
}

export const dermaosTransformer = {
  input: {
    serialize: (value: unknown) => ({ json: encode(value) }),
    deserialize: decode,
  },
  output: {
    serialize: (value: unknown) => ({ json: encode(value) }),
    deserialize: decode,
  },
};

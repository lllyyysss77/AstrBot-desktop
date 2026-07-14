export type JsonObject = Record<string, unknown>;

export function responseData<T>(response: unknown): T {
  const outer = (response as { data?: unknown } | null)?.data;
  if (outer && typeof outer === 'object' && 'data' in outer) {
    return (outer as { data: T }).data;
  }
  return outer as T;
}

export function objectList(data: unknown, keys: string[]): JsonObject[] {
  if (Array.isArray(data)) return data.filter(isObject);
  if (!isObject(data)) return [];
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value.filter(isObject);
  }
  return [];
}

export function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseJsonObject(source: string): JsonObject {
  const parsed: unknown = JSON.parse(source);
  if (!isObject(parsed)) throw new Error('JSON root must be an object.');
  return parsed;
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function recordId(record: JsonObject, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value) return value;
  }
  return '';
}

export function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

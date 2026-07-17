export function isSafePluginConfigPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:/.test(value)) return false;
  return value.split(/[\\/]/).every((part) => part !== '' && part !== '.' && part !== '..');
}

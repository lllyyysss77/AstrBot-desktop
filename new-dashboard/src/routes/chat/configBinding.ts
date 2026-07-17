export const CHAT_SELECTED_CONFIG_STORAGE_KEY = 'chat.selectedConfigId';

export type ConfigRouteEntry = {
  pattern: string;
  configId: string;
};

function storageValue(key: string, fallback: string) {
  try {
    return localStorage.getItem(key)?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export function storedChatConfigId() {
  return storageValue(CHAT_SELECTED_CONFIG_STORAGE_KEY, 'default');
}

export function storeChatConfigId(configId: string) {
  try {
    localStorage.setItem(CHAT_SELECTED_CONFIG_STORAGE_KEY, configId || 'default');
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}

export function buildWebchatUmo(sessionId: string, platformId = 'webchat', isGroup = false) {
  const username = storageValue('user', 'guest');
  const messageType = isGroup ? 'GroupMessage' : 'FriendMessage';
  return `${platformId}:${messageType}:${platformId}!${username}!${sessionId}`;
}

export function configRouteEntries(value: unknown): ConfigRouteEntry[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const routing = (value as { routing?: unknown }).routing;
  if (!routing || typeof routing !== 'object' || Array.isArray(routing)) return [];
  return Object.entries(routing).map(([pattern, configId]) => ({
    pattern,
    configId: String(configId || 'default'),
  }));
}

export function configRouteMatches(pattern: string, target: string) {
  const patternParts = pattern.split(':');
  const targetParts = target.split(':');
  return patternParts.length === 3
    && targetParts.length === 3
    && patternParts.every((part, index) => !part || part === '*' || part === targetParts[index]);
}

export function resolveChatConfigId(entries: ConfigRouteEntry[], umo: string) {
  return entries.find((entry) => configRouteMatches(entry.pattern, umo))?.configId || 'default';
}

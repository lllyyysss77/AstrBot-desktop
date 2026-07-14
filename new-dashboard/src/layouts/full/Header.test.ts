import { describe, expect, it } from 'vitest';

import {
  getModeSwitchTarget,
  LAST_BOT_ROUTE_KEY,
  LAST_CHAT_ROUTE_KEY,
} from './Header';

function storage(values: Record<string, string>): Pick<Storage, 'getItem'> {
  return { getItem: (key) => values[key] ?? null };
}

describe('Header mode switching', () => {
  it('returns to the last bot route from chat', () => {
    expect(getModeSwitchTarget('/chat/42', storage({ [LAST_BOT_ROUTE_KEY]: '/settings' })))
      .toBe('/settings');
  });

  it('returns to the last conversation from bot mode', () => {
    expect(getModeSwitchTarget('/settings', storage({ [LAST_CHAT_ROUTE_KEY]: '42' })))
      .toBe('/chat/42');
    expect(getModeSwitchTarget('/settings', storage({}))).toBe('/chat');
  });
});

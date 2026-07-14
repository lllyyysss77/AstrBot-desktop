import { describe, expect, it } from 'vitest';

import {
  defaultNavigationItems,
  MORE_GROUP_KEY,
  resolveNavigationItems,
} from './navigation';

describe('sidebar navigation compatibility', () => {
  it('keeps the legacy default order without customization', () => {
    expect(resolveNavigationItems(defaultNavigationItems, null)).toBe(defaultNavigationItems);
  });

  it('applies existing sidebar customization and keeps new defaults', () => {
    const result = resolveNavigationItems(defaultNavigationItems, {
      mainItems: ['core.navigation.console', 'missing', 'core.navigation.console'],
      moreItems: ['core.navigation.welcome', 'core.navigation.trace'],
    });

    expect(result[0].title).toBe('core.navigation.console');
    const more = result.find((item) => item.title === MORE_GROUP_KEY);
    expect(more?.children?.map((item) => item.title)).toContain('core.navigation.trace');
    expect(result.some((item) => item.title === 'core.navigation.platforms')).toBe(true);
  });
});

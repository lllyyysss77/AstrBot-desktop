import { describe, expect, it, vi } from 'vitest';

import {
  resolveAuthenticatedRoute,
  sessionNeedsPasswordSetup,
} from './sessionFlow';

const session = { token: 'token', username: 'astrbot' };

describe('authenticated session flow', () => {
  it('keeps legacy password warning precedence', () => {
    expect(sessionNeedsPasswordSetup({ ...session, changePwdHint: true })).toBe(true);
    expect(sessionNeedsPasswordSetup({ ...session, md5PwdHint: true })).toBe(true);
    expect(sessionNeedsPasswordSetup({
      ...session,
      md5PwdHint: true,
      passwordUpgradeRequired: true,
    })).toBe(false);
  });

  it('routes password warnings to setup before checking onboarding', async () => {
    const onboardingCheck = vi.fn(async () => true);
    await expect(resolveAuthenticatedRoute(
      { ...session, changePwdHint: true },
      onboardingCheck,
    )).resolves.toBe('/auth/setup');
    expect(onboardingCheck).not.toHaveBeenCalled();
  });

  it('routes completed and incomplete onboarding to legacy-compatible pages', async () => {
    await expect(resolveAuthenticatedRoute(session, async () => true))
      .resolves.toBe('/dashboard/default');
    await expect(resolveAuthenticatedRoute(session, async () => false))
      .resolves.toBe('/welcome');
  });
});

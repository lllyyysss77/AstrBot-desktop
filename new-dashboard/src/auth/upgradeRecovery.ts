import type { CompatibleApiResponse, AuthSessionResponse } from '@/api/auth';

export const UPGRADE_RECOVERY_EVENT = 'astrbot-upgrade-recovery';
export const UPGRADE_RECOVERY_TOKEN_KEY = 'astrbot-upgrade-recovery-token';

export type LegacyVersionData = {
  dashboard_version?: string;
  version?: string;
};

export type UpgradeRecoveryDetail = LegacyVersionData & {
  blocking?: boolean;
};

export type RestartPollDecision = 'continue' | 'reloaded' | 'timeout';

type LegacyEnvelope<T> = {
  data?: T;
  message?: string | null;
  status?: 'ok' | 'error';
};

export function normalizeVersion(version?: string | null) {
  return String(version ?? '').trim().replace(/^v/i, '');
}

export function versionsMismatch(core?: string | null, dashboard?: string | null) {
  const normalizedCore = normalizeVersion(core);
  const normalizedDashboard = normalizeVersion(dashboard);
  return Boolean(
    normalizedCore
    && normalizedDashboard
    && normalizedCore !== normalizedDashboard,
  );
}

export function restartPollDecision(
  initialStartTime: number | string | null,
  nextStartTime: number | string | null,
  attempts: number,
  maxAttempts = 90,
): RestartPollDecision {
  if (
    nextStartTime != null
    && initialStartTime != null
    && String(nextStartTime) !== String(initialStartTime)
  ) return 'reloaded';
  return attempts >= maxAttempts ? 'timeout' : 'continue';
}

export async function legacyUpgradeDetail(
  response: CompatibleApiResponse<AuthSessionResponse>,
  fetchImpl: typeof fetch = fetch,
): Promise<UpgradeRecoveryDetail | null> {
  const token = String(response.data.data?.token ?? '');
  if (!response.legacyFallback || !token) return null;
  const version = await legacyRequest<LegacyVersionData>(
    '/api/stat/version',
    token,
    {},
    fetchImpl,
  );
  return versionsMismatch(version.version, version.dashboard_version)
    ? { ...version, blocking: true }
    : null;
}

export function dispatchUpgradeRecovery(
  detail: UpgradeRecoveryDetail,
  token?: string,
) {
  if (token) sessionStorage.setItem(UPGRADE_RECOVERY_TOKEN_KEY, token);
  window.dispatchEvent(new CustomEvent<UpgradeRecoveryDetail>(
    UPGRADE_RECOVERY_EVENT,
    { detail },
  ));
}

export async function getLegacyStartTime(
  token = recoveryToken(),
  fetchImpl: typeof fetch = fetch,
) {
  const data = await legacyRequest<{ start_time?: number | string | null }>(
    '/api/stat/start-time',
    token,
    {},
    fetchImpl,
  );
  return data.start_time ?? null;
}

export async function restartLegacyCore(
  token = recoveryToken(),
  fetchImpl: typeof fetch = fetch,
) {
  await legacyRequest(
    '/api/stat/restart-core',
    token,
    { method: 'POST' },
    fetchImpl,
  );
}

export function recoveryToken() {
  return localStorage.getItem('token')
    || sessionStorage.getItem(UPGRADE_RECOVERY_TOKEN_KEY)
    || '';
}

async function legacyRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const locale = globalThis.localStorage?.getItem('astrbot-locale');
  if (locale) headers.set('Accept-Language', locale);
  const response = await fetchImpl(path, { ...init, headers });
  const text = await response.text();
  const payload = text ? JSON.parse(text) as LegacyEnvelope<T> : {};
  if (!response.ok || payload.status === 'error') {
    throw new Error(payload.message || response.statusText || 'Legacy recovery request failed.');
  }
  return (payload.data ?? {}) as T;
}

import type {
  GhproxyTestRequest,
  PipInstallRequest,
  UpdateRequest,
} from '@/api/openapi';
import {
  compatibleRequest,
  type CompatibleApiResponse,
} from './auth';

export type VersionData = {
  change_pwd_hint?: boolean;
  dashboard_version?: string;
  md5_pwd_hint?: boolean;
  password_upgrade_required?: boolean;
  version?: string;
};

export type PublicVersionData = {
  astrbot_code_version?: string;
  astrbot_version?: string;
  webui_version?: string;
};

export type StartTimeData = {
  start_time?: number | string | null;
};

export const publicApi = {
  versions: () => legacyCompatibleRequest<PublicVersionData>(
    '/api/v1/stats/versions',
    '/api/stat/versions',
  ),
};

export const statsApi = {
  version: () => legacyCompatibleRequest<VersionData>(
    '/api/v1/stats/version',
    '/api/stat/version',
  ),
  testGhproxy: (payload: GhproxyTestRequest) => legacyCompatibleRequest<{ latency?: number }>(
    '/api/v1/stats/ghproxy/test',
    '/api/stat/test-ghproxy-connection',
    jsonRequest(payload),
  ),
  startTime: () => legacyCompatibleRequest<StartTimeData>(
    '/api/v1/stats/start-time',
    '/api/stat/start-time',
  ),
  restart: () => legacyCompatibleRequest<Record<string, unknown>>(
    '/api/v1/system/restart',
    '/api/stat/restart-core',
    { method: 'POST' },
  ),
};

export const updatesApi = {
  check: () => legacyCompatibleRequest<Record<string, unknown>>(
    '/api/v1/updates/check',
    '/api/update/check',
  ),
  releases: (type?: 'core' | 'dashboard') => {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    return legacyCompatibleRequest<unknown[]>(
      `/api/v1/updates/releases${query}`,
      `/api/update/releases${query}`,
    );
  },
  core: (payload?: UpdateRequest) => legacyCompatibleRequest<Record<string, unknown>>(
    '/api/v1/updates/core',
    '/api/update/do',
    payload ? jsonRequest(payload) : { method: 'POST' },
  ),
  dashboard: (payload?: UpdateRequest) => legacyCompatibleRequest<Record<string, unknown>>(
    '/api/v1/updates/dashboard',
    '/api/update/dashboard',
    payload ? jsonRequest(payload) : { method: 'POST' },
  ),
  progress: (taskId: string) => legacyCompatibleRequest<Record<string, unknown>>(
    `/api/v1/updates/progress/${encodeURIComponent(taskId)}`,
    `/api/update/progress?id=${encodeURIComponent(taskId)}`,
  ),
  installPip: (payload: PipInstallRequest) => legacyCompatibleRequest<Record<string, unknown>>(
    '/api/v1/pip/install',
    '/api/update/pip-install',
    jsonRequest(payload),
  ),
};

function jsonRequest(payload: object): RequestInit {
  return { body: JSON.stringify(payload), method: 'POST' };
}

async function legacyCompatibleRequest<T>(
  primaryPath: string,
  legacyPath: string,
  init?: RequestInit,
): Promise<CompatibleApiResponse<T>> {
  const response = await compatibleRequest<T>(primaryPath, legacyPath, init);
  if (response.data.status === 'error') {
    throw new Error(response.data.message || 'Request failed');
  }
  return response;
}

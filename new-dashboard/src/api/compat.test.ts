import { afterEach, describe, expect, it, vi } from 'vitest';

import { publicApi, statsApi, updatesApi } from './compat';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('legacy-compatible API groups', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls public version discovery back to the unversioned route', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404))
      .mockResolvedValueOnce(jsonResponse({ data: { astrbot_version: '4.0.0' }, status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await publicApi.versions();

    expect(response.data.data.astrbot_version).toBe('4.0.0');
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/api/v1/stats/versions', '/api/stat/versions']);
  });

  it('preserves the legacy proxy test request body', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404))
      .mockResolvedValueOnce(jsonResponse({ data: { latency: 25 }, status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    await statsApi.testGhproxy({ proxy_url: 'https://proxy.example' });

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/stats/ghproxy/test',
      '/api/stat/test-ghproxy-connection',
    ]);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe('{"proxy_url":"https://proxy.example"}');
  });

  it('maps core update and progress calls to their legacy routes', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404))
      .mockResolvedValueOnce(jsonResponse({ data: {}, status: 'ok' }))
      .mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404))
      .mockResolvedValueOnce(jsonResponse({ data: { progress: 50 }, status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    await updatesApi.core({ reboot: true });
    await updatesApi.progress('task/id');

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/updates/core',
      '/api/update/do',
      '/api/v1/updates/progress/task%2Fid',
      '/api/update/progress?id=task%2Fid',
    ]);
  });
});

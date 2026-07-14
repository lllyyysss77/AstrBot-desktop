import type { AxiosAdapter } from 'axios';
import { describe, expect, it } from 'vitest';

import { getVersion, listProviders } from '@/api/generated/openapi-v1';
import { createOpenApiAxiosClient } from './openapi';

function createStorage(values: Record<string, string>): Storage {
  return {
    get length() { return Object.keys(values).length; },
    clear: () => Object.keys(values).forEach((key) => delete values[key]),
    getItem: (key) => values[key] ?? null,
    key: (index) => Object.keys(values)[index] ?? null,
    removeItem: (key) => { delete values[key]; },
    setItem: (key, value) => { values[key] = value; },
  };
}

describe('generated OpenAPI client', () => {
  it('exports generated endpoint functions', () => {
    expect(getVersion).toBeTypeOf('function');
    expect(listProviders).toBeTypeOf('function');
  });

  it('attaches existing authentication and locale headers', async () => {
    const storage = createStorage({ token: 'secret', 'astrbot-locale': 'en-US' });
    const client = createOpenApiAxiosClient({ storage });
    let headers: Record<string, unknown> = {};
    const adapter: AxiosAdapter = async (config) => {
      headers = config.headers?.toJSON() ?? {};
      return { config, data: {}, headers: {}, status: 200, statusText: 'OK' };
    };

    await client.get('/api/v1/stat/version', { adapter });

    expect(headers.Authorization).toBe('Bearer secret');
    expect(headers['Accept-Language']).toBe('en-US');
  });
});

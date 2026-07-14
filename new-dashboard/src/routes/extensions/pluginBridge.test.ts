import { describe, expect, it } from 'vitest';
import { validPluginEndpoint } from './PluginPage';

describe('plugin page bridge endpoint validation', () => {
  it('normalizes a relative plugin endpoint', () => {
    expect(validPluginEndpoint('/records/中文')).toBe('records/%E4%B8%AD%E6%96%87');
  });

  it.each(['../admin', 'records?all=true', 'https://example.com/api', 'records\\secret', ''])('rejects an endpoint outside the plugin namespace: %s', (endpoint) => {
    expect(() => validPluginEndpoint(endpoint)).toThrow();
  });
});

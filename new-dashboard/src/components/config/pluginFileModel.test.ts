import { describe, expect, it } from 'vitest';

import { isSafePluginConfigPath } from './pluginFileModel';

describe('plugin file config paths', () => {
  it.each(['files/prompt.txt', 'avatar.png'])('accepts a relative plugin path: %s', (path) => {
    expect(isSafePluginConfigPath(path)).toBe(true);
  });

  it.each(['../secret', 'files/../../secret', '/etc/passwd', 'C:\\secret', 'files\\..\\secret', ''])('rejects a path outside the plugin directory: %s', (path) => {
    expect(isSafePluginConfigPath(path)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { filterPlugins, normalizePluginUrl, pluginAuthor, pluginId, pluginInstallUrl, pluginPages } from './extensionModel';

describe('extension model helpers', () => {
  it('normalizes plugin identity and repository URLs', () => {
    expect(pluginId({ module_name: 'astrbot_plugin_demo' })).toBe('astrbot_plugin_demo');
    expect(normalizePluginUrl('https://github.com/a/b.git/')).toBe('https://github.com/a/b');
  });

  it('normalizes authors, pages and install URLs', () => {
    expect(pluginAuthor({ author: { name: 'AstrBot' } })).toBe('AstrBot');
    expect(pluginPages({ pages: ['main', { page_name: 'settings' }] })).toEqual(['main', 'settings']);
    expect(pluginInstallUrl({ download_url: 'https://example.com/plugin.zip' })).toContain('plugin.zip');
  });

  it('searches across title, id, author and description', () => {
    expect(filterPlugins([{ name: 'weather', author: 'Alice', desc: 'Forecast' }], 'alice')).toHaveLength(1);
  });
});

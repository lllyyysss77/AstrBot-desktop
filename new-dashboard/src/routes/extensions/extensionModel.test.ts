import { describe, expect, it } from 'vitest';
import { filterPlugins, marketPluginList, marketPluginTotal, normalizePluginUrl, pluginAuthor, pluginId, pluginInstallUrl, pluginPages } from './extensionModel';

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

  it('normalizes the keyed marketplace response used by the legacy dashboard', () => {
    const payload = {
      $meta: { name: 'AstrBot', total: 2 },
      astrbot_plugin_weather: { author: 'Alice', desc: 'Forecast' },
      'Bob/astrbot_plugin_search': { author: 'Bob', name: 'astrbot_plugin_search' },
    };
    const plugins = marketPluginList(payload);
    expect(plugins.map(pluginId)).toEqual(['astrbot_plugin_weather', 'astrbot_plugin_search']);
    expect(plugins[0].market_plugin_id).toBe('Alice/astrbot_plugin_weather');
    expect(marketPluginTotal(payload, plugins.length)).toBe(2);
  });
});

import { isObject, objectList, recordId, type JsonObject } from '@/routes/configuration/model';

export function pluginId(item: JsonObject) {
  return recordId(item, 'name', 'id', 'plugin_id', 'module_name', 'dir_name');
}

export function pluginTitle(item: JsonObject) {
  return String(item.display_name || item.title || item.name || item.id || 'Plugin');
}

export function pluginDescription(item: JsonObject) {
  return String(item.desc || item.description || '');
}

export function pluginAuthor(item: JsonObject) {
  const author = item.author;
  if (Array.isArray(author)) return author.join(', ');
  if (isObject(author)) return String(author.name || author.login || '');
  return String(author || '');
}

export function pluginList(data: unknown) {
  return objectList(data, ['plugins', 'items', 'data', 'results']);
}

export function marketPluginList(data: unknown) {
  const list = pluginList(data);
  if (list.length || Array.isArray(data)) return list;
  if (!isObject(data)) return [];
  return Object.entries(data).flatMap(([key, value]) => {
    if (key === '$meta' || !isObject(value)) return [];
    const fallbackName = key.includes('/') ? '' : key.trim();
    const name = String(value.name || '').trim() || fallbackName;
    const author = pluginAuthor(value).trim();
    return [{
      ...value,
      name: name || key,
      market_plugin_id: String(value.market_plugin_id || '').trim() || (author && name ? `${author}/${name}` : ''),
    }];
  });
}

export function marketPluginTotal(data: unknown, fallback: number) {
  if (!isObject(data)) return fallback;
  const meta = isObject(data.$meta) ? data.$meta : {};
  const pagination = isObject(data.pagination) ? data.pagination : {};
  for (const value of [data.total, data.total_count, meta.total, meta.total_count, pagination.total]) {
    const total = Number(value);
    if (Number.isFinite(total) && total >= 0) return total;
  }
  return fallback;
}

export function sourceList(data: unknown) {
  return objectList(data, ['sources', 'items', 'data']);
}

export function normalizePluginUrl(value: unknown) {
  return String(value || '').trim().replace(/\/+$/, '').replace(/\.git$/i, '').toLowerCase();
}

export function pluginInstallUrl(item: JsonObject) {
  return String(item.download_url || item.repo || item.repo_url || item.repository || item.url || '').trim();
}

export function pluginPages(item: JsonObject): string[] {
  const pages = item.pages;
  if (!Array.isArray(pages)) return [];
  return pages.map((page) => isObject(page) ? String(page.name || page.page_name || page.id || '') : String(page || '')).filter(Boolean);
}

export function filterPlugins(items: JsonObject[], query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) => `${pluginTitle(item)} ${pluginId(item)} ${pluginAuthor(item)} ${pluginDescription(item)}`.toLowerCase().includes(term));
}

export function categoryValue(item: JsonObject) {
  return String(item.category || objectList(item.categories, ['items'])[0]?.name || 'other');
}

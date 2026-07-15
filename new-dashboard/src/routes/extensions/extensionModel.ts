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

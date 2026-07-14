export type NavigationItem = {
  children?: NavigationItem[];
  icon: string;
  title: string;
  to?: string;
};

export const MORE_GROUP_KEY = 'core.navigation.groups.more';

const moreItems: NavigationItem[] = [
  { title: 'core.navigation.conversation', icon: '◫', to: '/conversation' },
  { title: 'core.navigation.sessionManagement', icon: '⌑', to: '/session-management' },
  { title: 'core.navigation.cron', icon: '◷', to: '/cron' },
  { title: 'core.navigation.subagent', icon: '⌘', to: '/subagent' },
  { title: 'core.navigation.dashboard', icon: '▦', to: '/dashboard/default' },
  { title: 'core.navigation.console', icon: '›_', to: '/console' },
  { title: 'core.navigation.trace', icon: '≋', to: '/trace' },
];

export const defaultNavigationItems: NavigationItem[] = [
  { title: 'core.navigation.welcome', icon: '◉', to: '/welcome' },
  { title: 'core.navigation.platforms', icon: '♙', to: '/platforms' },
  { title: 'core.navigation.providers', icon: '✦', to: '/providers' },
  { title: 'core.navigation.config', icon: '⚙', to: '/config' },
  {
    title: 'core.navigation.extension',
    icon: '◆',
    to: '/extension#installed',
    children: [
      { title: 'core.navigation.extensionTabs.installed', icon: '◆', to: '/extension#installed' },
      { title: 'core.navigation.extensionTabs.market', icon: '▣', to: '/extension#market' },
      { title: 'core.navigation.extensionTabs.mcp', icon: '⌘', to: '/extension#mcp' },
      { title: 'core.navigation.extensionTabs.skills', icon: 'ϟ', to: '/extension#skills' },
      { title: 'core.navigation.extensionTabs.components', icon: '⚒', to: '/extension#components' },
    ],
  },
  { title: 'core.navigation.knowledgeBase', icon: '▤', to: '/knowledge-base' },
  { title: 'core.navigation.persona', icon: '♥', to: '/persona' },
  { title: MORE_GROUP_KEY, icon: '•••', children: moreItems },
];

type SidebarCustomization = { mainItems?: unknown; moreItems?: unknown };

function stringKeys(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : [];
}

export function resolveNavigationItems(
  items: NavigationItem[],
  customization: SidebarCustomization | null,
) {
  if (!customization) return items;
  const moreGroup = items.find((item) => item.title === MORE_GROUP_KEY);
  const allItems = new Map<string, NavigationItem>();
  items.filter((item) => item.title !== MORE_GROUP_KEY).forEach((item) => allItems.set(item.title, item));
  moreGroup?.children?.forEach((item) => allItems.set(item.title, item));
  const mainKeys = stringKeys(customization.mainItems).filter((key) => allItems.has(key));
  const mainSet = new Set(mainKeys);
  const moreKeys = stringKeys(customization.moreItems)
    .filter((key) => allItems.has(key) && !mainSet.has(key));
  const used = new Set([...mainKeys, ...moreKeys]);
  const defaultMain = items.filter((item) => item.title !== MORE_GROUP_KEY);
  const defaultMore = moreGroup?.children ?? [];
  const main = mainKeys.map((key) => allItems.get(key)!).concat(defaultMain.filter((item) => !used.has(item.title)));
  const more = moreKeys.map((key) => allItems.get(key)!).concat(defaultMore.filter((item) => !used.has(item.title)));
  return more.length ? [...main, { title: MORE_GROUP_KEY, icon: '•••', children: more }] : main;
}

export function readNavigationItems() {
  if (typeof localStorage === 'undefined') return defaultNavigationItems;
  try {
    const stored = localStorage.getItem('astrbot_sidebar_customization');
    return resolveNavigationItems(defaultNavigationItems, stored ? JSON.parse(stored) : null);
  } catch {
    return defaultNavigationItems;
  }
}

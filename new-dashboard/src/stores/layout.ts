import { create } from 'zustand';

export const SIDEBAR_OPENED_ITEMS_KEY = 'sidebar_openedItems';
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 300;
export const SIDEBAR_DEFAULT_WIDTH = 235;
export const SIDEBAR_COLLAPSED_WIDTH = 80;

export type ThemeMode = 'light' | 'dark' | 'system';

function readOpenedGroups(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SIDEBAR_OPENED_ITEMS_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function resolveInitialThemeMode(storedMode: string | null, legacyTheme: string | null): ThemeMode {
  if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
    return storedMode;
  }
  if (legacyTheme === 'PurpleThemeDark') return 'dark';
  if (legacyTheme === 'PurpleTheme') return 'light';
  return 'system';
}

function readThemeMode(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system';
  return resolveInitialThemeMode(localStorage.getItem('themeMode'), localStorage.getItem('uiTheme'));
}

export function clampSidebarWidth(width: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

export function resolveDarkTheme(mode: ThemeMode, prefersDark: boolean) {
  return mode === 'dark' || (mode === 'system' && prefersDark);
}

type LayoutState = {
  chatSidebarOpen: boolean;
  drawerOpen: boolean;
  miniSidebar: boolean;
  openedGroups: string[];
  sidebarWidth: number;
  themeMode: ThemeMode;
  closeDrawer: () => void;
  setDrawerOpen: (open: boolean) => void;
  setChatSidebarOpen: (open: boolean) => void;
  setOpenedGroups: (groups: string[]) => void;
  setSidebarWidth: (width: number) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleDrawer: () => void;
  toggleChatSidebar: () => void;
  toggleMiniSidebar: () => void;
};

export const useLayoutStore = create<LayoutState>()((set) => ({
  chatSidebarOpen: false,
  drawerOpen: typeof window === 'undefined' || window.innerWidth >= 768,
  miniSidebar: false,
  openedGroups: readOpenedGroups(),
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  themeMode: readThemeMode(),
  closeDrawer: () => set({ drawerOpen: false }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setChatSidebarOpen: (chatSidebarOpen) => set({ chatSidebarOpen }),
  setOpenedGroups: (openedGroups) => {
    localStorage.setItem(SIDEBAR_OPENED_ITEMS_KEY, JSON.stringify(openedGroups));
    set({ openedGroups });
  },
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth: clampSidebarWidth(sidebarWidth) }),
  setThemeMode: (themeMode) => {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const isDark = resolveDarkTheme(themeMode, prefersDark);
    localStorage.setItem('themeMode', themeMode);
    localStorage.setItem('uiTheme', isDark ? 'PurpleThemeDark' : 'PurpleTheme');
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    set({ themeMode });
  },
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
  toggleChatSidebar: () => set((state) => ({ chatSidebarOpen: !state.chatSidebarOpen })),
  toggleMiniSidebar: () => set((state) => ({ miniSidebar: !state.miniSidebar })),
}));

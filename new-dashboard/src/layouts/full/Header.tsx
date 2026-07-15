import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Menu, MenuItem } from '@/components/headless/Menu';
import { MdiIcon } from '@/components/icons/MdiIcon';
import { useAuthStore } from '@/stores/auth';
import { type ThemeMode, useLayoutStore } from '@/stores/layout';

export const LAST_BOT_ROUTE_KEY = 'astrbot:last_bot_route';
export const LAST_CHAT_ROUTE_KEY = 'astrbot:last_chat_route';

export function getModeSwitchTarget(pathname: string, storage: Pick<Storage, 'getItem'>) {
  if (pathname === '/chat' || pathname.startsWith('/chat/')) {
    const lastBotRoute = storage.getItem(LAST_BOT_ROUTE_KEY) || '/';
    return lastBotRoute.startsWith('/chat') ? '/' : lastBotRoute;
  }
  const lastChatId = storage.getItem(LAST_CHAT_ROUTE_KEY);
  return lastChatId ? `/chat/${lastChatId}` : '/chat';
}

const languageOptions = [
  { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { code: 'en-US', label: 'English', flag: '🇺🇸' },
  { code: 'ru-RU', label: 'Русский', flag: '🇷🇺' },
] as const;

const themeOptions: Array<{ icon: `mdi-${string}`; mode: ThemeMode; label: string }> = [
  { icon: 'mdi-white-balance-sunny', mode: 'light', label: 'Light' },
  { icon: 'mdi-weather-night', mode: 'dark', label: 'Dark' },
  { icon: 'mdi-theme-light-dark', mode: 'system', label: 'System' },
];

export function Header() {
  const { i18n, t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  const drawerOpen = useLayoutStore((state) => state.drawerOpen);
  const chatSidebarOpen = useLayoutStore((state) => state.chatSidebarOpen);
  const miniSidebar = useLayoutStore((state) => state.miniSidebar);
  const themeMode = useLayoutStore((state) => state.themeMode);
  const setDrawerOpen = useLayoutStore((state) => state.setDrawerOpen);
  const setThemeMode = useLayoutStore((state) => state.setThemeMode);
  const toggleDrawer = useLayoutStore((state) => state.toggleDrawer);
  const toggleChatSidebar = useLayoutStore((state) => state.toggleChatSidebar);
  const toggleMiniSidebar = useLayoutStore((state) => state.toggleMiniSidebar);
  const clearSession = useAuthStore((state) => state.clearSession);
  const isChat = location.pathname === '/chat' || location.pathname.startsWith('/chat/');

  useEffect(() => {
    const updateViewport = () => {
      const nextMobile = window.innerWidth < 768;
      setMobile((wasMobile) => {
        if (wasMobile !== nextMobile) setDrawerOpen(!nextMobile);
        return nextMobile;
      });
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [setDrawerOpen]);

  useEffect(() => {
    if (isChat) {
      const conversationId = location.pathname.split('/')[2];
      if (conversationId) sessionStorage.setItem(LAST_CHAT_ROUTE_KEY, conversationId);
    } else {
      sessionStorage.setItem(LAST_BOT_ROUTE_KEY, `${location.pathname}${location.search}${location.hash}`);
    }
  }, [isChat, location.hash, location.pathname, location.search]);

  return (
    <div className={`app-header${isChat ? ' app-header--chat' : ''}`}>
      {!isChat && (
        <button
          aria-label={mobile ? t('core.header.buttons.openSidebar', 'Toggle sidebar') : t('core.header.buttons.collapseSidebar', 'Collapse sidebar')}
          aria-pressed={mobile ? drawerOpen : miniSidebar}
          className="app-header__icon-button"
          onClick={mobile ? toggleDrawer : toggleMiniSidebar}
          type="button"
        >
          <MdiIcon name="mdi-menu" />
        </button>
      )}
      {!isChat && <Link className="app-header__logo" to="/about">Astr<span>Bot</span></Link>}
      {isChat && mobile && (
        <button
          aria-label={t('core.header.buttons.openSidebar', 'Toggle chat sidebar')}
          aria-pressed={chatSidebarOpen}
          className="app-header__icon-button"
          onClick={toggleChatSidebar}
          type="button"
        >
          <MdiIcon name={chatSidebarOpen ? 'mdi-chevron-left' : 'mdi-chevron-right'} />
        </button>
      )}
      <div className="app-header__spacer" />
      <button
        className="app-header__mode-switch"
        onClick={() => navigate(getModeSwitchTarget(location.pathname, sessionStorage))}
        type="button"
      >
        <MdiIcon name={isChat ? 'mdi-robot' : 'mdi-chat'} />
        {isChat ? 'Bot' : 'Chat'}
      </button>
      <Menu
        label={t('core.header.buttons.menu', 'Application menu')}
        trigger={(props) => (
          <button {...props} aria-label={t('core.header.buttons.menu', 'Application menu')} className="app-header__icon-button" type="button"><MdiIcon name="mdi-dots-vertical" /></button>
        )}
      >
        <div className="headless-menu__label">{t('core.common.language')}</div>
        {languageOptions.map((language) => (
          <MenuItem key={language.code} onSelect={() => void i18n.changeLanguage(language.code)}>
            <span>{language.flag}</span>
            <span>{language.label}</span>
            {i18n.language === language.code && <span aria-label={t('core.common.selected', 'Selected')}>✓</span>}
          </MenuItem>
        ))}
        <div className="headless-menu__separator" role="separator" />
        <div className="headless-menu__label">{t('core.header.buttons.theme.title')}</div>
        {themeOptions.map((theme) => (
          <MenuItem key={theme.mode} onSelect={() => setThemeMode(theme.mode)}>
            <span className="headless-menu__item-label"><MdiIcon name={theme.icon} />{theme.label}</span>
            {themeMode === theme.mode && <span aria-label={t('core.common.selected', 'Selected')}>✓</span>}
          </MenuItem>
        ))}
        <div className="headless-menu__separator" role="separator" />
        <MenuItem onSelect={() => navigate('/about')}>{t('core.navigation.about', 'About')}</MenuItem>
        <MenuItem onSelect={() => {
          clearSession();
          navigate('/auth/login', { replace: true });
        }}>{t('core.header.buttons.logout', 'Log out')}</MenuItem>
      </Menu>
    </div>
  );
}

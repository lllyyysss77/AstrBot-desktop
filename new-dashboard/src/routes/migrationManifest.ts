export type RouteMigrationEntry = {
  path: string;
};

export const routeMigrationManifest: readonly RouteMigrationEntry[] = [
  { path: '/' },
  { path: '/main' },
  { path: '/auth/login' },
  { path: '/auth/setup' },
  { path: '/welcome' },
  { path: '/about' },
  { path: '/dashboard/default' },
  { path: '/console' },
  { path: '/trace' },
  { path: '/conversation' },
  { path: '/session-management' },
  { path: '/platforms' },
  { path: '/providers' },
  { path: '/config' },
  { path: '/normal' },
  { path: '/system' },
  { path: '/settings' },
  { path: '/persona' },
  { path: '/subagent' },
  { path: '/cron' },
  { path: '/extension' },
  { path: '/extension/:pluginId' },
  { path: '/extension-marketplace' },
  { path: '/plugin-page/:pluginName/:pageName' },
  { path: '/knowledge-base' },
  { path: '/knowledge-base/:kbId' },
  { path: '/knowledge-base/:kbId/document/:docId' },
  { path: '/alkaid/knowledge-base' },
  { path: '/chat' },
  { path: '/chat/:conversationId' },
  { path: '/chatbox' },
  { path: '/chatbox/:conversationId' },
] as const;

export const migratedRoutePaths = routeMigrationManifest.map((route) => route.path);

const publicRoutePaths = new Set(['/auth/login', '/auth/setup']);

export function routeRequiresAuth(path: string) {
  return !publicRoutePaths.has(path);
}

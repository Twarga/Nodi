import { signal } from '@preact/signals';

type Route = 'devices' | 'files' | 'home' | 'login' | 'send' | 'share' | 'settings';

const currentRoute = signal<Route>('home');
let initialized = false;

function getRouteFromPath(): Route {
  const path = window.location.pathname;
  if (path === '/devices') return 'devices';
  if (path === '/files') return 'files';
  if (path === '/home') return 'home';
  if (path === '/login') return 'login';
  if (path === '/send') return 'send';
  if (path === '/share') return 'share';
  if (path === '/settings') return 'settings';
  return 'home';
}

function initRouter() {
  if (initialized) return;
  initialized = true;
  currentRoute.value = getRouteFromPath();
  window.addEventListener('popstate', () => {
    currentRoute.value = getRouteFromPath();
  });
}

export function navigate(path: string) {
  window.history.pushState({}, '', path);
  currentRoute.value = getRouteFromPath();
}

export function useRoute() {
  initRouter();
  return currentRoute;
}

export { currentRoute };

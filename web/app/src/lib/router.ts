import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

type Route = 'dashboard' | 'login' | 'settings';

const currentRoute = signal<Route>('dashboard');

function getRouteFromPath(): Route {
  const path = window.location.pathname;
  if (path === '/login') return 'login';
  if (path === '/settings') return 'settings';
  return 'dashboard';
}

export function initRouter() {
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
  useEffect(() => {
    initRouter();
  }, []);
  return currentRoute;
}

export { currentRoute };
import { AuthProvider, useAuth } from './stores/auth';
import { ThemeProvider } from './stores/theme';
import { useRoute } from './lib/router';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { DevicesPage } from './pages/Devices';
import { HomePage } from './pages/Home';
import { SendPage } from './pages/Send';
import { SharePage } from './pages/Share';
import { SettingsPage } from './pages/Settings';
import { UploadPanel } from './components/UploadPanel';
import { MobileNav } from './components/MobileNav';

function Router() {
  const route = useRoute();
  const { state } = useAuth();

  if (state.value.loading) {
    return (
      <div class="flex h-screen items-center justify-center bg-background">
        <svg class="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    );
  }

  if (route.value === 'login') {
    if (state.value.user) {
      window.history.replaceState({}, '', '/');
      route.value = 'home';
      return <HomePage />;
    }
    return <LoginPage />;
  }

  if (!state.value.user) {
    window.location.href = '/login';
    return null;
  }

  if (route.value === 'home') {
    return <HomePage />;
  }

  if (route.value === 'files') {
    return <DashboardPage />;
  }

  if (route.value === 'send') {
    return <SendPage />;
  }

  if (route.value === 'devices') {
    return <DevicesPage />;
  }

  if (route.value === 'share') {
    return <SharePage />;
  }

  if (route.value === 'settings') {
    return <SettingsPage />;
  }

  return <HomePage />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router />
        <UploadPanel />
        <MobileNav />
      </AuthProvider>
    </ThemeProvider>
  );
}

import { AuthProvider, useAuth } from './stores/auth';
import { ThemeProvider } from './stores/theme';
import { useRoute } from './lib/router';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';

function Router() {
  const route = useRoute();
  const { state } = useAuth();

  // Show loading while checking auth
  if (state.value.loading) {
    return (
      <div class="flex h-screen items-center justify-center text-muted-foreground">
        <svg class="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    );
  }

  // Login page
  if (route.value === 'login') {
    return <LoginPage />;
  }

  // Protected routes
  if (!state.value.user) {
    window.location.href = '/login';
    return null;
  }

  return <DashboardPage />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </ThemeProvider>
  );
}

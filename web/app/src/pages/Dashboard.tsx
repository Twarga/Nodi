import { useEffect } from 'preact/hooks';
import { appState, setPath, setFiles, setLoading } from '../stores/app';
import { browseAPI } from '../lib/api';
import { TopBar } from '../components/TopBar';
import { Sidebar } from '../components/Sidebar';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { WorkspaceBar } from '../components/WorkspaceBar';

export function DashboardPage() {
  const state = appState.value;

  useEffect(() => {
    loadFiles(state.currentPath);
  }, [state.currentPath, state.sortBy, state.sortOrder, state.showHidden]);

  const loadFiles = async (path: string) => {
    setLoading(true);
    try {
      const data = await browseAPI.list({
        path,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
      });
      let files = data.files;
      if (!state.showHidden) {
        files = files.filter(f => !f.name.startsWith('.'));
      }
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        files = files.filter(f => f.name.toLowerCase().includes(q));
      }
      setPath(path, data.path);
      setFiles(files);
    } catch {
      setFiles([]);
    }
  };

  return (
    <div class="flex h-screen flex-col">
      <TopBar />

      <div class="flex flex-1 overflow-hidden">
        <Sidebar />

        <main class="flex-1 overflow-auto app-main">
          <Breadcrumbs />
          <div class="mt-4">
            <WorkspaceBar />
          </div>

          {/* Placeholder for file list */}
          <div class="mt-4 rounded-xl border border-border/90 bg-surface/95 shadow-sm backdrop-blur p-8 text-center">
            <p class="text-muted-foreground">
              {state.isLoading ? 'Loading files...' : `${state.files.length} files`}
            </p>
            {state.files.length > 0 && (
              <div class="mt-4 text-left space-y-1">
                {state.files.slice(0, 10).map(f => (
                  <div key={f.name} class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-hover text-sm">
                    <span class="text-muted-foreground">{f.is_dir ? '📁' : '📄'}</span>
                    <span class="flex-1 truncate">{f.name}</span>
                    <span class="text-xs text-muted-foreground tabular">{f.size}</span>
                  </div>
                ))}
                {state.files.length > 10 && (
                  <p class="text-xs text-muted-foreground text-center py-2">...and {state.files.length - 10} more</p>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

import { useState, FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { NodiLogo } from "./NodiLogo";

interface Props {
  onLogin: (username: string) => void;
}

export const Login = ({ onLogin }: Props) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(false);
    if (!username.trim() || password.length < 3) {
      setError(true);
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin(username.trim());
    }, 450);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className={`w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm ${error ? "animate-ql-shake" : "animate-ql-pop-in"}`}>
        <div className="flex flex-col items-center text-center">
          <NodiLogo className="h-12 w-12 text-primary" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Nodi</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your server</p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Username</label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-shadow"
              placeholder="admin"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-shadow"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">Invalid credentials. Try again.</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors disabled:opacity-70"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Demo mode — enter any username and a password (3+ chars).
        </p>
      </div>
    </main>
  );
};

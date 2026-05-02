import { useState } from "react";
import { Login } from "@/components/Login";
import { Dashboard } from "@/components/Dashboard";
import { ThemeProvider } from "@/lib/theme";

const Index = () => {
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem("ql-user"));

  const onLogin = (u: string) => {
    localStorage.setItem("ql-user", u);
    setUsername(u);
  };
  const onLogout = () => {
    localStorage.removeItem("ql-user");
    setUsername(null);
  };

  return (
    <ThemeProvider>
      {username ? <Dashboard username={username} onLogout={onLogout} /> : <Login onLogin={onLogin} />}
    </ThemeProvider>
  );
};

export default Index;

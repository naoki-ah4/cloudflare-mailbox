import { useEffect } from "react";
import { useTheme, type Theme } from "~/utils/theme";

interface ThemeProviderProps {
  children: React.ReactNode;
  serverTheme?: Theme;
}

const ThemeProvider = ({ children, serverTheme }: ThemeProviderProps) => {
  const { theme } = useTheme(serverTheme);

  useEffect(() => {
    // SSRとクライアントの同期のため、マウント時にテーマを再適用
    const { applyTheme } = require("~/utils/theme");
    applyTheme(theme);
  }, [theme]);

  return <>{children}</>;
};

export default ThemeProvider;
import { useEffect } from "react";
import { useTheme, type Theme } from "~/app/utils/theme";

interface ThemeProviderProps {
  children: React.ReactNode;
  serverTheme?: Theme;
}

const ThemeProvider = ({ children, serverTheme }: ThemeProviderProps) => {
  const { theme } = useTheme(serverTheme);

  useEffect(() => {
    // SSRとクライアントの同期のため、マウント時にテーマを再適用
    void (async () => {
      const { applyTheme } = await import("~/app/utils/theme");
      applyTheme(theme);
    })();
  }, [theme]);

  return <>{children}</>;
};

export default ThemeProvider;

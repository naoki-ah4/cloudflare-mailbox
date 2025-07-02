import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "auto";

const THEME_STORAGE_KEY = "cloudflare-mailbox-theme";

export const getSystemTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const getStoredTheme = (): Theme | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
};

export const setStoredTheme = (theme: Theme): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
};

export const getResolvedTheme = (theme: Theme): "light" | "dark" => {
  if (theme === "auto") {
    return getSystemTheme();
  }
  return theme;
};

export const applyTheme = (theme: Theme): void => {
  if (typeof window === "undefined") return;

  const resolvedTheme = getResolvedTheme(theme);
  const root = document.documentElement;

  if (resolvedTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // CSS変数でテーマを設定
  root.setAttribute("data-theme", resolvedTheme);
};

export const useTheme = (serverTheme?: Theme) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // サーバーから取得したテーマを優先、なければストレージ、最後にauto
    return serverTheme || getStoredTheme() || "auto";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    return getResolvedTheme(theme);
  });

  useEffect(() => {
    // システムテーマ変更の監視
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = () => {
      if (theme === "auto") {
        const newResolvedTheme = getSystemTheme();
        setResolvedTheme(newResolvedTheme);
        applyTheme(theme);
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    // 初期テーマ適用
    applyTheme(theme);
    setResolvedTheme(getResolvedTheme(theme));

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [theme]);

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    setStoredTheme(newTheme);
    const newResolvedTheme = getResolvedTheme(newTheme);
    setResolvedTheme(newResolvedTheme);
    applyTheme(newTheme);
  };

  return {
    theme,
    resolvedTheme,
    setTheme: updateTheme,
  };
};

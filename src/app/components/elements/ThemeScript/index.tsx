// SSRとクライアントの不一致を防ぐためのスクリプト
const ThemeScript = () => {
  const script = `
    (function() {
      try {
        const theme = localStorage.getItem('cloudflare-mailbox-theme') || 'auto';
        const getSystemTheme = () => {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        };
        const getResolvedTheme = (theme) => {
          return theme === 'auto' ? getSystemTheme() : theme;
        };
        const resolvedTheme = getResolvedTheme(theme);
        const root = document.documentElement;
        
        if (resolvedTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        
        root.setAttribute('data-theme', resolvedTheme);
      } catch (e) {
        console.error('Theme initialization error:', e);
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
};

export default ThemeScript;
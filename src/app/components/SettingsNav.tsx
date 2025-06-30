import { useLocation } from "react-router";

interface SettingsNavProps {
  className?: string;
}

const SettingsNav = ({ className = "" }: SettingsNavProps) => {
  const location = useLocation();
  
  const navItems = [
    {
      href: "/settings",
      label: "基本設定",
      icon: "⚙️",
      paths: ["/settings"]
    },
    {
      href: "/profile", 
      label: "プロフィール",
      icon: "👤",
      paths: ["/profile"]
    },
    {
      href: "/settings/password",
      label: "パスワード変更", 
      icon: "🔒",
      paths: ["/settings/password"]
    }
  ];

  const isActiveItem = (paths: string[]) => {
    return paths.some(path => 
      path === "/settings" 
        ? location.pathname === "/settings" 
        : location.pathname.startsWith(path)
    );
  };

  return (
    <nav className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">設定メニュー</h2>
      <ul className="space-y-2">
        {navItems.map((item) => (
          <li key={item.href}>
            <a 
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md no-underline transition-colors ${
                isActiveItem(item.paths)
                  ? 'text-blue-600 bg-blue-50 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <a 
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:text-gray-900 rounded-md no-underline transition-colors"
        >
          <span className="text-lg">🏠</span>
          <span>ダッシュボード</span>
        </a>
      </div>
    </nav>
  );
};

export default SettingsNav;
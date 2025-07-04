import { useLocation } from "react-router";
import { useState } from "react";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface SettingsNavProps {
  className?: string;
}

const SettingsNav = ({ className = "" }: SettingsNavProps) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  // キーボードナビゲーション対応
  const focusTrapRef = useFocusTrap(isOpen);
  useEscapeKey(() => setIsOpen(false), isOpen);

  const navItems = [
    {
      href: "/settings",
      label: "基本設定",
      icon: "⚙️",
      paths: ["/settings"],
    },
    {
      href: "/profile",
      label: "プロフィール",
      icon: "👤",
      paths: ["/profile"],
    },
    {
      href: "/settings/password",
      label: "パスワード変更",
      icon: "🔒",
      paths: ["/settings/password"],
    },
  ];

  const isActiveItem = (paths: string[]) => {
    return paths.some((path) =>
      path === "/settings"
        ? location.pathname === "/settings"
        : location.pathname.startsWith(path)
    );
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* モバイル用ハンバーガーメニューボタン */}
      <button
        className="hidden md:hidden lg:hidden max-md:block bg-none border-none text-xl cursor-pointer p-2 text-gray-700"
        onClick={toggleMenu}
        aria-expanded={isOpen}
        aria-controls="settings-nav"
        aria-label="設定メニューを開く"
      >
        ☰
      </button>

      {/* モバイル用オーバーレイ */}
      <div
        className={`hidden max-md:fixed max-md:top-0 max-md:left-0 max-md:right-0 max-md:bottom-0 max-md:bg-black/50 max-md:z-[999] ${isOpen ? "max-md:block" : ""}`}
        onClick={closeMenu}
      />

      <nav
        ref={focusTrapRef}
        id="settings-nav"
        role="navigation"
        aria-label="設定メニュー"
        className={`bg-white rounded-lg border border-gray-200 p-4 lg:p-3 max-md:p-3 max-md:hidden max-md:fixed max-md:top-0 max-md:left-0 max-md:h-screen max-md:w-72 max-md:z-[1000] max-md:shadow-lg ${isOpen ? "max-md:block" : ""} ${className}`}
      >
        {/* モバイル用閉じるボタン */}
        <button
          className="hidden max-md:block max-md:absolute max-md:top-4 max-md:right-4 max-md:bg-none max-md:border-none max-md:text-xl max-md:cursor-pointer max-md:text-gray-500 max-md:z-[1001]"
          onClick={closeMenu}
          aria-label="設定メニューを閉じる"
        >
          ✕
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-4 max-md:text-base max-md:mb-3">
          設定メニュー
        </h2>
        <ul className="flex flex-col gap-2 list-none m-0 p-0">
          {navItems.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className={`flex items-center gap-3 p-3 rounded-md no-underline transition-all duration-200 text-gray-600 hover:bg-gray-50 hover:no-underline max-md:p-3.5 max-md:active:bg-gray-200 ${
                  isActiveItem(item.paths)
                    ? "text-blue-600 bg-blue-50 font-medium"
                    : ""
                }`}
                onClick={closeMenu}
                aria-current={isActiveItem(item.paths) ? "page" : undefined}
              >
                <span className="text-lg shrink-0" aria-hidden="true">{item.icon}</span>
                <span className="text-sm max-md:text-base">{item.label}</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-6 pt-4 border-t border-gray-200 max-md:mt-4 max-md:pt-3">
          <a
            href="/dashboard"
            className="flex items-center gap-3 p-3 text-gray-500 rounded-md no-underline transition-colors duration-200 hover:text-gray-900 hover:no-underline max-md:p-3.5"
            onClick={closeMenu}
          >
            <span className="text-lg shrink-0" aria-hidden="true">🏠</span>
            <span className="text-sm max-md:text-base">ダッシュボード</span>
          </a>
        </div>
      </nav>
    </>
  );
};

export default SettingsNav;

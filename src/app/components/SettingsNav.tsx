import { useLocation } from "react-router";
import { useState } from "react";
import styles from "./SettingsNav.module.scss";

interface SettingsNavProps {
  className?: string;
}

const SettingsNav = ({ className = "" }: SettingsNavProps) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
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
        className={styles.mobileMenuButton}
        onClick={toggleMenu}
      >
        ☰
      </button>

      {/* モバイル用オーバーレイ */}
      <div 
        className={`${styles.overlay} ${isOpen ? styles.open : ''}`}
        onClick={closeMenu}
      />

      <nav className={`${styles.navigation} ${isOpen ? styles.open : ''} ${className}`}>
        {/* モバイル用閉じるボタン */}
        <button 
          className={styles.closeButton}
          onClick={closeMenu}
        >
          ✕
        </button>

        <h2 className={styles.header}>設定メニュー</h2>
        <ul className={styles.navList}>
          {navItems.map((item) => (
            <li key={item.href}>
              <a 
                href={item.href}
                className={`${styles.navItem} ${
                  isActiveItem(item.paths) ? styles.active : ''
                }`}
                onClick={closeMenu}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
        
        <div className={styles.divider}>
          <a 
            href="/dashboard"
            className={styles.dashboardLink}
            onClick={closeMenu}
          >
            <span className={styles.navIcon}>🏠</span>
            <span className={styles.navLabel}>ダッシュボード</span>
          </a>
        </div>
      </nav>
    </>
  );
};

export default SettingsNav;
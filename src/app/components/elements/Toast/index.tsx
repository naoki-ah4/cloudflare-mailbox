import { useState, useEffect } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: ToastData;
  onClose: (id: string) => void;
}

const Toast = ({ toast, onClose }: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // アニメーションのために少し遅らせて表示
    const showTimer = setTimeout(() => setIsVisible(true), 100);
    
    // 自動削除タイマー
    const duration = toast.duration ?? 5000;
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(toast.id), 300); // アニメーション時間
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [toast.id, toast.duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(toast.id), 300);
  };

  const getToastStyles = () => {
    const baseStyles = "border-l-4 p-4 rounded-r-lg shadow-lg bg-white";
    
    switch (toast.type) {
      case "success":
        return `${baseStyles} border-green-500`;
      case "error":
        return `${baseStyles} border-red-500`;
      case "warning":
        return `${baseStyles} border-yellow-500`;
      case "info":
        return `${baseStyles} border-blue-500`;
      default:
        return `${baseStyles} border-gray-500`;
    }
  };

  const getIconAndColor = () => {
    switch (toast.type) {
      case "success":
        return { icon: "✓", color: "text-green-600" };
      case "error":
        return { icon: "✗", color: "text-red-600" };
      case "warning":
        return { icon: "⚠", color: "text-yellow-600" };
      case "info":
        return { icon: "ℹ", color: "text-blue-600" };
      default:
        return { icon: "•", color: "text-gray-600" };
    }
  };

  const { icon, color } = getIconAndColor();

  return (
    <div
      className={`transform transition-all duration-300 ease-in-out ${
        isVisible 
          ? "translate-x-0 opacity-100" 
          : "translate-x-full opacity-0"
      }`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className={getToastStyles()}>
        <div className="flex items-start gap-3">
          {/* アイコン */}
          <div className={`text-lg font-bold ${color} flex-shrink-0`} aria-hidden="true">
            {icon}
          </div>
          
          {/* コンテンツ */}
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold ${color} text-sm mb-1`}>
              {toast.title}
            </h4>
            {toast.message && (
              <p className="text-gray-700 text-sm leading-relaxed">
                {toast.message}
              </p>
            )}
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className={`mt-2 text-sm font-medium ${color} hover:underline focus:outline-none focus:underline`}
              >
                {toast.action.label}
              </button>
            )}
          </div>
          
          {/* 閉じるボタン */}
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-lg leading-none flex-shrink-0"
            aria-label="通知を閉じる"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
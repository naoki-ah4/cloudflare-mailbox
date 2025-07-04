import { useEffect } from "react";
import LoadingSpinner from "../../elements/LoadingSpinner";

interface LoadingOverlayProps {
  show: boolean;
  message?: string;
  backdrop?: boolean;
}

const LoadingOverlay = ({
  show,
  message = "読み込み中...",
  backdrop = true,
}: LoadingOverlayProps) => {
  useEffect(() => {
    if (show) {
      // ローディング中はスクロールを無効化
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 bottom-0 z-[9999] flex items-center justify-center ${backdrop ? "bg-black/50 backdrop-blur-sm" : ""}`}
    >
      <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px]">
        <LoadingSpinner size="large" color="primary" />
        <p className="m-0 text-gray-900 text-sm font-medium text-center">
          {message}
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;

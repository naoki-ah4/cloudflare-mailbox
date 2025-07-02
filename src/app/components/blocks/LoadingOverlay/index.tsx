import { useEffect } from "react";
import LoadingSpinner from "../../elements/LoadingSpinner";
import styles from "./index.module.scss";

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
    <div className={`${styles.overlay} ${backdrop ? styles.backdrop : ""}`}>
      <div className={styles.content}>
        <LoadingSpinner size="large" color="primary" />
        <p className={styles.message}>{message}</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;

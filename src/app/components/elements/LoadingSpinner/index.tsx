import styles from "./index.module.scss";

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  color?: "primary" | "white" | "gray";
  className?: string;
}

const LoadingSpinner = ({
  size = "medium",
  color = "primary",
  className = "",
}: LoadingSpinnerProps) => {
  return (
    <div
      className={`${styles.spinner} ${styles[size]} ${styles[color]} ${className}`}
      role="status"
      aria-label="読み込み中"
    >
      <span className={styles.srOnly}>読み込み中...</span>
    </div>
  );
};

export default LoadingSpinner;

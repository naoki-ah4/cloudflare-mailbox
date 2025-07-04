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
  const sizeClasses = {
    small: "w-4 h-4 border-2",
    medium: "w-6 h-6 border-2",
    large: "w-8 h-8 border-[3px]",
  };

  const colorClasses = {
    primary: "border-gray-200 border-t-blue-600",
    white: "border-white/30 border-t-white",
    gray: "border-gray-200 border-t-gray-600",
  };

  return (
    <div
      className={`inline-block rounded-full animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      role="status"
      aria-label="読み込み中"
    >
      <span className="sr-only">読み込み中...</span>
    </div>
  );
};

export default LoadingSpinner;

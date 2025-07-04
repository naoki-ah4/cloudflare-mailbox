interface SkeletonLoaderProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  animation?: "pulse" | "wave" | "none";
}

const SkeletonLoader = ({
  width = "100%",
  height = "1rem",
  className = "",
  variant = "rectangular",
  animation = "pulse",
}: SkeletonLoaderProps) => {
  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  const baseClasses = "bg-gray-300 relative overflow-hidden";
  const variantClasses = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded",
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-pulse", // Tailwindのデフォルトpulseを使用、独自waveアニメーションは後で追加
    none: "",
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
      aria-label="読み込み中"
    />
  );
};

// プリセットコンポーネント
export const SkeletonText = ({
  lines = 1,
  className = "",
}: {
  lines?: number;
  className?: string;
}) => (
  <div className={className}>
    {Array.from({ length: lines }, (_, index) => (
      <SkeletonLoader
        key={index}
        variant="text"
        height="1rem"
        className={index < lines - 1 ? "mb-2" : ""}
      />
    ))}
  </div>
);

export const SkeletonCard = ({ className = "" }: { className?: string }) => (
  <div
    className={`p-4 bg-white border border-gray-200 rounded-lg ${className}`}
  >
    <SkeletonLoader variant="rectangular" height="200px" className="mb-4" />
    <SkeletonLoader variant="text" height="1.5rem" className="mb-2" />
    <SkeletonLoader variant="text" height="1rem" width="60%" />
  </div>
);

export const SkeletonMessageItem = ({
  className = "",
}: {
  className?: string;
}) => (
  <div className={`p-4 border-b border-gray-200 last:border-b-0 ${className}`}>
    <div className="flex items-center gap-3">
      <SkeletonLoader variant="circular" width="40px" height="40px" />
      <div className="flex-1">
        <SkeletonLoader
          variant="text"
          height="1rem"
          width="150px"
          className="mb-1"
        />
        <SkeletonLoader variant="text" height="0.875rem" width="80px" />
      </div>
      <SkeletonLoader variant="text" height="0.75rem" width="60px" />
    </div>
    <SkeletonLoader variant="text" height="1rem" className="mt-2" />
  </div>
);

export default SkeletonLoader;

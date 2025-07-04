interface LiveRegionProps {
  message: string;
  level?: "polite" | "assertive";
  className?: string;
}

const LiveRegion = ({ 
  message, 
  level = "polite", 
  className = "" 
}: LiveRegionProps) => {
  if (!message) return null;

  return (
    <div
      aria-live={level}
      aria-atomic="true"
      className={`sr-only ${className}`}
    >
      {message}
    </div>
  );
};

export default LiveRegion;
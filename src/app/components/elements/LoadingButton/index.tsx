import type { ButtonHTMLAttributes } from "react";
import LoadingSpinner from "../LoadingSpinner";

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "small" | "medium" | "large";
  children: React.ReactNode;
}

const LoadingButton = ({
  loading = false,
  loadingText,
  variant = "primary",
  size = "medium",
  children,
  disabled,
  className = "",
  ...props
}: LoadingButtonProps) => {
  const baseClasses = "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
  };
  
  const sizeClasses = {
    small: "px-3 py-1.5 text-sm",
    medium: "px-4 py-2 text-sm",
    large: "px-6 py-3 text-base"
  };
  
  const spinnerColor = variant === "primary" || variant === "danger" ? "white" : "gray";
  const spinnerSize = size === "large" ? "medium" : "small";
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <LoadingSpinner 
          size={spinnerSize} 
          color={spinnerColor}
        />
      )}
      {loading && loadingText ? loadingText : children}
    </button>
  );
};

export default LoadingButton;
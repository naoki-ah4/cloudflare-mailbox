import { createContext, useContext, type ReactNode } from "react";
import { useToast } from "../hooks/useToast";
import ToastContainer from "../components/elements/ToastContainer";
import type { ToastData, ToastType } from "../components/elements/Toast";

interface ToastContextType {
  toasts: ToastData[];
  addToast: (options: {
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    action?: {
      label: string;
      onClick: () => void;
    };
  }) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  showSuccess: (title: string, message?: string, duration?: number) => string;
  showError: (title: string, message?: string, duration?: number) => string;
  showWarning: (title: string, message?: string, duration?: number) => string;
  showInfo: (title: string, message?: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToastContext must be used within a ToastProvider");
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const toastHook = useToast();

  return (
    <ToastContext.Provider value={toastHook}>
      {children}
      <ToastContainer
        toasts={toastHook.toasts}
        onRemoveToast={toastHook.removeToast}
      />
    </ToastContext.Provider>
  );
};

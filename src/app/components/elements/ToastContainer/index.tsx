import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import Toast, { type ToastData } from "../Toast";

interface ToastContainerProps {
  toasts: ToastData[];
  onRemoveToast: (id: string) => void;
}

const ToastContainer = ({ toasts, onRemoveToast }: ToastContainerProps) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // コンテナ要素を作成または取得
    let toastContainer = document.getElementById("toast-container");

    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toast-container";
      toastContainer.className =
        "fixed top-4 right-4 z-[10000] space-y-2 pointer-events-none";
      toastContainer.setAttribute("aria-live", "polite");
      toastContainer.setAttribute("aria-label", "通知");
      document.body.appendChild(toastContainer);
    }

    setContainer(toastContainer);

    return () => {
      // コンポーネントがアンマウントされても、コンテナは残す
      // （他の場所でも使用される可能性があるため）
    };
  }, []);

  if (!container || toasts.length === 0) {
    return null;
  }

  return createPortal(
    <>
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onClose={onRemoveToast} />
        </div>
      ))}
    </>,
    container
  );
};

export default ToastContainer;

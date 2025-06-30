import { useState, useCallback } from "react";
import { useSubmit } from "react-router";

interface UseFormSubmitOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const useFormSubmit = (options: UseFormSubmitOptions = {}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submit = useSubmit();

  const submitForm = useCallback(async (
    formData: FormData | HTMLFormElement,
    submitOptions?: Parameters<typeof submit>[1]
  ) => {
    try {
      setIsSubmitting(true);
      submit(formData, submitOptions);
      options.onSuccess?.();
    } catch (error) {
      options.onError?.(error as Error);
    } finally {
      // React Routerのsubmitは非同期だが、ローディング状態はnavigationで管理する
      // ここでは即座にfalseにせず、ナビゲーション完了時にリセット
      setTimeout(() => setIsSubmitting(false), 100);
    }
  }, [submit, options]);

  return {
    isSubmitting,
    submitForm,
  };
};
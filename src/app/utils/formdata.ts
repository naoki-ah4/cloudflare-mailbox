import { logger } from "~/utils/logger";

export class SafeFormData extends FormData {
  get(key: string): string | null {
    const value = super.get(key);
    if (typeof value === "string") {
      return value;
    }
    return null;
  }

  getAll(key: string): string[] {
    const values = super.getAll(key);
    return values.filter((value): value is string => typeof value === "string");
  }

  getFile(key: string): File | null {
    const value = super.get(key);
    if (value instanceof File) {
      return value;
    }
    return null;
  }

  getFiles(key: string): File[] {
    const values = super.getAll(key);
    const results = values.filter((value) => value instanceof File);
    if (values.length > results.length) {
      logger.warn(
        "getFilesメソッドでファイル以外の値が含まれています。フィルタリングされました。",
        {
          key,
          originalCount: values.length,
          filteredCount: results.length,
          originalValues: values.map((v) =>
            v instanceof File ? `File${v.name}` : `${typeof v}:${v}`
          ),
        }
      );
    }
    return results;
  }

  static fromObject(
    obj: FormData | Record<string, string | File | Array<string | File>>
  ): SafeFormData {
    const formData = new SafeFormData();
    if (obj instanceof FormData) {
      for (const [key, value] of obj.entries()) {
        if (typeof value === "string") {
          formData.append(key, value);
        } else if (value instanceof File) {
          formData.append(key, value);
        } else if (Array.isArray(value)) {
          for (const item of value as (string | File)[]) {
            if (typeof item === "string" || item instanceof File) {
              formData.append(key, item);
            }
          }
        }
      }
    } else {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
          formData.append(key, value);
        } else if (value instanceof File) {
          formData.append(key, value);
        } else if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === "string" || item instanceof File) {
              formData.append(key, item);
            }
          }
        }
      }
    }
    return formData;
  }
}

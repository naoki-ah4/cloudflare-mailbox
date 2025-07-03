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

  static fromObject(
    obj: FormData | Record<string, string | File | Array<string | File>>
  ): SafeFormData {
    const formData = new SafeFormData();
    if (obj instanceof FormData) {
      for (const [key, value] of obj.entries()) {
        if (typeof value === "string") {
          formData.append(key, value);
        } else if (value instanceof Blob) {
          formData.append(key, value);
        } else if (Array.isArray(value)) {
          for (const item of value as (string | Blob)[]) {
            if (typeof item === "string" || item instanceof Blob) {
              formData.append(key, item);
            }
          }
        }
      }
    } else {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
          formData.append(key, value);
        } else if (value instanceof Blob) {
          formData.append(key, value);
        } else if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === "string" || item instanceof Blob) {
              formData.append(key, item);
            }
          }
        }
      }
    }
    return formData;
  }
}

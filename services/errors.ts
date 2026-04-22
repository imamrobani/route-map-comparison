import { isAxiosError, isCancel } from "axios";

export const isAbortError = (error: unknown): boolean => {
  if (isCancel(error)) return true;
  const anyError = error as { code?: unknown; name?: unknown } | null;
  return (
    anyError?.code === "ERR_CANCELED" ||
    anyError?.name === "CanceledError" ||
    anyError?.name === "AbortError"
  );
};

export const toErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "string" && error.trim().length > 0) return error;

  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (typeof status === "number") {
      if (status === 401 || status === 403)
        return "Request rejected by Mapbox.";
      if (status === 429) return "Rate limit exceeded. Please try again.";
      if (status >= 500)
        return "Mapbox service is unavailable. Please try again.";
    }
    if (error.message?.trim()) return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0)
      return message;
  }

  return fallback;
};

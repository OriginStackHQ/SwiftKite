import { toast } from "sonner";

import { ApiError } from "./axiosInstance";

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (error instanceof ApiError) {
    return error.errors?.[0] ?? error.detail;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

/** Toast the normalized API error (Ankuram-style error handling). */
export default function errorHandler(error: unknown) {
  toast.error(getErrorMessage(error));
}

type FormWithErrors = {
  getAllErrors: () => {
    form: { errors: ReadonlyArray<unknown> };
    fields: Record<string, { errors: ReadonlyArray<unknown> }>;
  };
};

function errorText(error: unknown) {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return undefined;
}

/** Surfaces TanStack Form validation issues as a toast instead of inline text. */
export function toastFormError(form: FormWithErrors) {
  const { form: formErrors, fields } = form.getAllErrors();
  const first = [
    ...formErrors.errors,
    ...Object.values(fields).flatMap((field) => field?.errors ?? []),
  ]
    .map(errorText)
    .find(Boolean);

  toast.error(first ?? "Please check the form and try again.");
}

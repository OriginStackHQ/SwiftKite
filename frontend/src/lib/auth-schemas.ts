import { z } from "zod";

import {
  NAME_MAX_LENGTH,
  PASSWORD_MESSAGE,
  PASSWORD_REGEX,
} from "./validation";

export type AuthMode = "sign-in" | "sign-up" | "forgot";

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .email("Enter a valid email address");

const password = z.string().regex(PASSWORD_REGEX, PASSWORD_MESSAGE);

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}`)
    .max(NAME_MAX_LENGTH, `Use ${NAME_MAX_LENGTH} characters or fewer`);

/**
 * One shape for all three auth screens. Fields that do not apply to the current
 * mode stay empty, so TanStack Form can infer a single stable form type.
 */
export function authSchema(mode: AuthMode) {
  return z
    .object({
      firstName: z.string(),
      lastName: z.string(),
      email,
      password: z.string(),
      confirm: z.string(),
    })
    .superRefine((values, ctx) => {
      if (mode === "forgot") return;

      if (mode === "sign-up") {
        for (const [field, label] of [
          ["firstName", "first name"],
          ["lastName", "last name"],
        ] as const) {
          const result = name(label).safeParse(values[field]);
          if (!result.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [field],
              message: result.error.issues[0]?.message,
            });
          }
        }
        const parsed = password.safeParse(values.password);
        if (!parsed.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["password"],
            message: parsed.error.issues[0]?.message,
          });
        }
      } else if (values.password.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "Enter your password",
        });
      }

      if (mode === "sign-up" && values.confirm !== values.password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirm"],
          message: "Passwords do not match",
        });
      }
    });
}

export const profileSchema = z.object({
  firstName: name("first name"),
  lastName: name("last name"),
});

/**
 * Settings uses one form for both "set" and "change" so the field shape (and
 * therefore TanStack Form's inferred type) does not change when a password is
 * added to an OAuth-only account.
 */
export function passwordFormSchema(hasPassword: boolean) {
  return z
    .object({
      currentPassword: z.string(),
      password,
      confirm: z.string().min(1, "Confirm your new password"),
    })
    .superRefine((values, ctx) => {
      if (hasPassword && values.currentPassword.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["currentPassword"],
          message: "Enter your current password",
        });
      }
      if (values.confirm !== values.password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirm"],
          message: "Passwords do not match",
        });
      }
    });
}

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "This reset link is incomplete"),
    password,
    confirm: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

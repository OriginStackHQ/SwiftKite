"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormPasswordFieldWrapper } from "@/components/ui/custom-form";
import { Brand } from "@/components/swiftkite/ui";
import { useAuth } from "@/lib/auth";
import { resetPasswordRequest } from "@/lib/auth-api";
import { resetPasswordSchema } from "@/lib/auth-schemas";
import errorHandler, { toastFormError } from "@/lib/errorHandler";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { signOut } = useAuth();
  const token = params.get("token") ?? "";

  const resetMutation = useMutation({
    mutationFn: ({
      password,
      confirm,
    }: {
      password: string;
      confirm: string;
    }) => resetPasswordRequest(token, password, confirm),
  });

  const form = useForm({
    defaultValues: { token, password: "", confirm: "" },
    validators: { onSubmit: resetPasswordSchema },
    onSubmitInvalid: ({ formApi }) => toastFormError(formApi),
    onSubmit: async ({ value }) => {
      try {
        await resetMutation.mutateAsync({
          password: value.password,
          confirm: value.confirm,
        });
        // The reset revokes every server session; mirror that locally so the
        // sign-in screen does not bounce an already-signed-in user back.
        await signOut();
        toast.success("Password reset. Sign in with your new password.", {
          id: "password-reset",
        });
        router.replace("/sign-in?reset=1");
      } catch (error) {
        errorHandler(error);
      }
    },
  });

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="SwiftKite home">
          <Brand />
        </Link>
        <div className="surface mt-8 p-8">
          <div className="eyebrow mb-3">Account recovery</div>
          <h1 className="text-2xl font-semibold">Choose a new password</h1>

          {!token ? (
            <>
              <p className="mb-6 mt-2 text-sm text-muted-foreground">
                This reset link is invalid or incomplete. Request a fresh link
                and try again.
              </p>
              <Button asChild className="w-full">
                <Link href="/forgot-password">Request a new link</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="mb-6 mt-2 text-sm text-muted-foreground">
                Use at least 6 characters with an uppercase letter, a lowercase
                letter, a number, and a special character (@#$%^&amp;+=!).
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  form.handleSubmit();
                }}
                className="space-y-5"
              >
                <form.Field name="password">
                  {(field) => (
                    <FormPasswordFieldWrapper
                      label="New password"
                      field={field}
                      inputProps={{ autoComplete: "new-password" }}
                    />
                  )}
                </form.Field>
                <form.Field name="confirm">
                  {(field) => (
                    <FormPasswordFieldWrapper
                      label="Confirm new password"
                      field={field}
                      showStrength={false}
                      inputProps={{ autoComplete: "new-password" }}
                    />
                  )}
                </form.Field>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={resetMutation.isPending}
                >
                  {resetMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  Reset password
                </Button>
              </form>
            </>
          )}

          <div className="mt-6 text-center text-xs text-muted-foreground">
            <Link href="/sign-in" className="text-primary">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

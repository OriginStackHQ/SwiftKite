"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AppLoader } from "@/components/ui/app-loader";
import { useAuth } from "@/lib/auth";
import { forgotPasswordRequest, startGoogleOAuth } from "@/lib/auth-api";
import { authSchema, type AuthMode } from "@/lib/auth-schemas";
import errorHandler, { toastFormError } from "@/lib/errorHandler";
import { Brand } from "./ui";
import { GrowthChart } from "./charts";
import {
  FormFieldWrapper,
  FormPasswordFieldWrapper,
} from "@/components/ui/custom-form";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const signup = mode === "sign-up";
  const forgot = mode === "forgot";
  const router = useRouter();
  const {
    signIn,
    signUp,
    isAuthenticated,
    isLoading,
    isSigningIn,
    isSigningUp,
  } = useAuth();

  const [forgotSent, setForgotSent] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const forgotMutation = useMutation({
    mutationFn: (email: string) => forgotPasswordRequest(email),
    onSuccess: (_data, email) => {
      setSentTo(email);
      setForgotSent(true);
      toast.success(
        "If an account exists for that email, a reset link has been sent.",
      );
    },
  });

  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirm: "",
    },
    validators: { onSubmit: authSchema(mode) },
    onSubmitInvalid: ({ formApi }) => toastFormError(formApi),
    onSubmit: async ({ value }) => {
      try {
        if (forgot) {
          await forgotMutation.mutateAsync(value.email.trim());
          return;
        }
        if (signup) {
          await signUp({
            firstName: value.firstName.trim(),
            lastName: value.lastName.trim(),
            email: value.email.trim(),
            password: value.password,
            confirmPassword: value.confirm,
          });
          toast.success("Account created. Sign in to continue.");
          router.push("/sign-in");
          return;
        }
        await signIn(value.email.trim(), value.password);
        toast.success("Welcome back");
        router.push("/dashboard");
      } catch (cause) {
        errorHandler(cause);
      }
    },
  });

  // Signed-in visitors should not sit on the sign-in/sign-up screens.
  useEffect(() => {
    if (!isLoading && isAuthenticated && !forgot) router.replace("/dashboard");
  }, [isLoading, isAuthenticated, forgot, router]);

  // One-time read of the post-redirect query string (?reset / ?error).
  const handledQuery = useRef(false);
  useEffect(() => {
    if (handledQuery.current) return;
    handledQuery.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get("reset")) {
      toast.success("Password reset. Sign in with your new password.", {
        id: "password-reset",
      });
    }
    if (params.get("error") === "oauth_failed") {
      toast.error("Google sign-in failed. Please try again.", {
        id: "oauth-failed",
      });
    }
  }, []);

  // Avoid flashing the form while the session is checked, and while an
  // already-signed-in visitor is being redirected to the dashboard.
  if (!forgot && (isLoading || isAuthenticated)) {
    return (
      <AppLoader
        label={
          isAuthenticated
            ? "Taking you to your workspace…"
            : "Checking your session…"
        }
      />
    );
  }

  const busy = forgot
    ? forgotMutation.isPending
    : signup
      ? isSigningUp
      : isSigningIn;

  const resetForgot = () => {
    setForgotSent(false);
    setSentTo("");
    form.reset();
  };

  return (
    <div className="auth-layout">
      <div className="auth-form-side">
        <Link href="/">
          <Brand />
        </Link>
        <div className="auth-form">
          <div className="eyebrow mb-4">
            {signup
              ? "Your next chapter starts here"
              : forgot
                ? "Let’s get you back in"
                : "Good to see you again"}
          </div>
          <h1 className="text-3xl font-semibold">
            {signup
              ? "Create your account"
              : forgot
                ? "Forgot your password?"
                : "Welcome back"}
          </h1>
          <p className="mb-8 mt-3 text-sm text-muted-foreground">
            {signup
              ? "A thoughtful home for your newsletter."
              : forgot
                ? "Enter your email and we’ll send you a reset link."
                : "Sign in to continue to your workspace."}
          </p>

          {forgot && forgotSent ? (
            <div className="surface p-6 text-center">
              <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Mail />
              </span>
              <h2 className="text-xl font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                If an account exists for {sentTo}, we sent a link to reset your
                password.
              </p>
              <Button
                type="button"
                variant="ghost"
                className="mt-4 w-full"
                onClick={resetForgot}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                form.handleSubmit();
              }}
              className="space-y-5"
            >
              {signup && (
                <div className="form-grid">
                  <form.Field name="firstName">
                    {(field) => (
                      <FormFieldWrapper
                        label="First name"
                        field={field}
                        inputProps={{ autoComplete: "given-name" }}
                      />
                    )}
                  </form.Field>
                  <form.Field name="lastName">
                    {(field) => (
                      <FormFieldWrapper
                        label="Last name"
                        field={field}
                        inputProps={{ autoComplete: "family-name" }}
                      />
                    )}
                  </form.Field>
                </div>
              )}

              <form.Field name="email">
                {(field) => (
                  <FormFieldWrapper
                    label="Email address"
                    field={field}
                    inputProps={{
                      type: "email",
                      autoComplete: "email",
                      placeholder: "you@example.com",
                    }}
                  />
                )}
              </form.Field>

              {!forgot && (
                <form.Field name="password">
                  {(field) => (
                    <FormPasswordFieldWrapper
                      label="Password"
                      field={field}
                      showStrength={signup}
                      inputProps={{
                        autoComplete: signup
                          ? "new-password"
                          : "current-password",
                      }}
                    />
                  )}
                </form.Field>
              )}

              {signup && (
                <form.Field name="confirm">
                  {(field) => (
                    <FormPasswordFieldWrapper
                      label="Confirm password"
                      field={field}
                      showStrength={false}
                      inputProps={{ autoComplete: "new-password" }}
                    />
                  )}
                </form.Field>
              )}

              {mode === "sign-in" && (
                <div className="flex justify-end text-xs">
                  <Link href="/forgot-password" className="text-primary">
                    Forgot password?
                  </Link>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                {forgot
                  ? "Send reset link"
                  : signup
                    ? "Create account"
                    : "Sign in"}
                {!busy && !forgot && <ArrowRight />}
              </Button>

              {!forgot && (
                <>
                  <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span className="h-px flex-1 bg-muted-foreground/20" />
                    or
                    <span className="h-px flex-1 bg-muted-foreground/20" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={startGoogleOAuth}
                    disabled={busy}
                  >
                    <GoogleIcon />
                    Continue with Google
                  </Button>
                </>
              )}
            </form>
          )}

          <div className="mt-7 text-center text-xs text-muted-foreground">
            {signup ? (
              <>
                Already have an account?{" "}
                <Link href="/sign-in" className="text-primary">
                  Sign in
                </Link>
              </>
            ) : forgot ? (
              <Link href="/sign-in" className="text-primary">
                Back to sign in
              </Link>
            ) : (
              <>
                New to NewsFlow?{" "}
                <Link href="/sign-up" className="text-primary">
                  Create an account
                </Link>
              </>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">© 2026 NewsFlow</p>
      </div>
      <aside className="auth-visual">
        <div className="eyebrow mb-5">For people with something to say</div>
        <h2>
          Your voice.
          <br />
          Your audience.
          <br />
          <span className="text-primary">Your next chapter.</span>
        </h2>
        <p className="mt-5 max-w-sm leading-7 text-muted-foreground">
          A little less complexity. A little more connection.
        </p>
        <div className="surface max-w-lg p-6">
          <p className="mb-2 font-semibold">A growing conversation</p>
          <p className="subtle-note">Subscriber growth · demo data</p>
          <GrowthChart mini />
        </div>
      </aside>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.09 3.58-5.17 3.58-8.85Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.58 1.79l3.42-3.42A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.63l3.98 3.09C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}

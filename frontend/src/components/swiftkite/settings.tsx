"use client";

import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormFieldWrapper,
  FormPasswordFieldWrapper,
} from "@/components/ui/custom-form";
import { useAuth } from "@/lib/auth";
import {
  providersRequest,
  startGoogleLink,
  unlinkProviderRequest,
} from "@/lib/auth-api";
import { passwordFormSchema, profileSchema } from "@/lib/auth-schemas";
import errorHandler, { toastFormError } from "@/lib/errorHandler";
import { authKeys } from "@/lib/query-keys";
import { PageHeading } from "./ui";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const {
    user,
    updateProfile,
    refreshUser,
    isUpdatingProfile,
  } = useAuth();

  const providersQuery = useQuery({
    queryKey: authKeys.providers,
    queryFn: providersRequest,
  });
  const providers = providersQuery.data;

  useEffect(() => {
    if (providersQuery.isError) errorHandler(providersQuery.error);
  }, [providersQuery.isError, providersQuery.error]);

  const invalidateProviders = () =>
    queryClient.invalidateQueries({ queryKey: authKeys.providers });

  const linkGoogleMutation = useMutation({
    mutationFn: startGoogleLink,
    onError: (error) => errorHandler(error),
  });

  const unlinkGoogleMutation = useMutation({
    mutationFn: () => unlinkProviderRequest("google"),
    onSuccess: async () => {
      toast.success("Google disconnected");
      await Promise.all([invalidateProviders(), refreshUser()]);
    },
    onError: (error) => errorHandler(error),
  });

  const profileForm = useForm({
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
    },
    validators: { onSubmit: profileSchema },
    onSubmitInvalid: ({ formApi }) => toastFormError(formApi),
    onSubmit: async ({ value }) => {
      try {
        await updateProfile(value.firstName.trim(), value.lastName.trim());
        toast.success("Profile updated");
      } catch (error) {
        errorHandler(error);
      }
    },
  });

  const displayName = user ? `${user.firstName} ${user.lastName}` : "";
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "U";
  const hasPassword = providers?.hasPassword ?? user?.hasPassword ?? false;
  const googleLinked =
    providers?.providers.some((item) => item.provider === "GOOGLE") ?? false;
  const securityBusy =
    linkGoogleMutation.isPending || unlinkGoogleMutation.isPending;

  return (
    <>
      <PageHeading
        title="Settings"
        description="Your profile, sign-in methods and password."
      />
      <section className="max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <span className="avatar h-16 w-16 text-lg">{initials}</span>
          <div>
            <p className="font-semibold">{displayName}</p>
            <p className="subtle-note">{user?.email}</p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            profileForm.handleSubmit();
          }}
          className="space-y-5"
        >
          <div className="form-grid">
            <profileForm.Field name="firstName">
              {(field) => (
                <FormFieldWrapper
                  label="First name"
                  field={field}
                  inputProps={{ autoComplete: "given-name" }}
                />
              )}
            </profileForm.Field>
            <profileForm.Field name="lastName">
              {(field) => (
                <FormFieldWrapper
                  label="Last name"
                  field={field}
                  inputProps={{ autoComplete: "family-name" }}
                />
              )}
            </profileForm.Field>
          </div>
          <div className="form-field">
            <label htmlFor="profile-email">Email address</label>
            <Input id="profile-email" type="email" value={user?.email ?? ""} readOnly />
            <p className="text-[10px] text-muted-foreground">
              Email changes require verification and are not available yet.
            </p>
          </div>
          <Button type="submit" disabled={isUpdatingProfile}>
            {isUpdatingProfile ? <Loader2 className="animate-spin" /> : null}
            Save profile
          </Button>
        </form>

        <div className="space-y-4 border-t pt-6">
          <div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock size={14} />
              Sign-in methods
            </p>
            <p className="subtle-note mt-2">
              An account must keep at least one way to sign in.
            </p>
          </div>

          {providersQuery.isPending ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="animate-spin" size={14} />
              Loading sign-in methods...
            </div>
          ) : providersQuery.isError ? (
            <div className="flex justify-end rounded-lg border p-4">
              <Button
                variant="outline"
                onClick={() => providersQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Google</p>
                <p className="subtle-note">
                  {googleLinked ? "Connected" : "Not connected"}
                </p>
              </div>
              {googleLinked ? (
                <Button
                  variant="outline"
                  onClick={() => unlinkGoogleMutation.mutate()}
                  disabled={securityBusy}
                >
                  {unlinkGoogleMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => linkGoogleMutation.mutate()}
                  disabled={securityBusy}
                >
                  {linkGoogleMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  Connect
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="border-t pt-6">
          <h3 className="text-sm font-semibold">
            {hasPassword ? "Change password" : "Set a password"}
          </h3>
          <p className="subtle-note mt-2">
            {hasPassword
              ? "Changing your password signs out other devices."
              : "Add a password so you can sign in without Google."}
          </p>
          <PasswordForm
            key={hasPassword ? "change" : "set"}
            hasPassword={hasPassword}
          />
        </div>
      </section>
    </>
  );
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const queryClient = useQueryClient();
  const {
    setPassword,
    changePassword,
    isSettingPassword,
    isChangingPassword,
  } = useAuth();

  const form = useForm({
    defaultValues: { currentPassword: "", password: "", confirm: "" },
    validators: { onSubmit: passwordFormSchema(hasPassword) },
    onSubmitInvalid: ({ formApi }) => toastFormError(formApi),
    onSubmit: async ({ value }) => {
      try {
        if (hasPassword) {
          await changePassword(
            value.currentPassword,
            value.password,
            value.confirm,
          );
          toast.success("Password changed");
        } else {
          await setPassword(value.password, value.confirm);
          toast.success(
            "Password set. You can now sign in with email and password.",
          );
        }
        form.reset();
        await queryClient.invalidateQueries({
          queryKey: authKeys.providers,
        });
      } catch (error) {
        errorHandler(error);
      }
    },
  });

  const busy = hasPassword ? isChangingPassword : isSettingPassword;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
      className="mt-4 space-y-5"
    >
      {hasPassword && (
        <form.Field name="currentPassword">
          {(field) => (
            <FormPasswordFieldWrapper
              label="Current password"
              field={field}
              showStrength={false}
              inputProps={{ autoComplete: "current-password" }}
            />
          )}
        </form.Field>
      )}
      <form.Field name="password">
        {(field) => (
          <FormPasswordFieldWrapper
            label={hasPassword ? "New password" : "Password"}
            field={field}
            inputProps={{ autoComplete: "new-password" }}
          />
        )}
      </form.Field>
      <form.Field name="confirm">
        {(field) => (
          <FormPasswordFieldWrapper
            label={hasPassword ? "Confirm new password" : "Confirm password"}
            field={field}
            showStrength={false}
            inputProps={{ autoComplete: "new-password" }}
          />
        )}
      </form.Field>

      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        {hasPassword ? "Change password" : "Set password"}
      </Button>
    </form>
  );
}

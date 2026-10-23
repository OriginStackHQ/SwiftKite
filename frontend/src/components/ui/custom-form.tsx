"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordStrength } from "@/components/swiftkite/password-strength";
import { cn } from "@/lib/utils";

type FieldLike = {
  name: string;
  state: {
    value: string;
    meta: { errors: ReadonlyArray<unknown> };
  };
  handleChange: (value: string) => void;
  handleBlur: () => void;
};

/**
 * TanStack Form field wrappers mirroring Ankuram's custom-form inputs.
 * Validation feedback is toasted (see errorHandler) rather than rendered inline.
 */
export function FormFieldWrapper({
  label,
  field,
  inputProps,
}: {
  label: string;
  field: FieldLike;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}) {
  const { onChange, ...rest } = inputProps ?? {};
  const invalid = field.state.meta.errors.length > 0;

  return (
    <div className="form-field">
      <label htmlFor={field.name}>{label}</label>
      <Input
        {...rest}
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => {
          field.handleChange(event.target.value);
          onChange?.(event);
        }}
        aria-invalid={invalid || undefined}
      />
    </div>
  );
}

export function FormPasswordFieldWrapper({
  label,
  field,
  inputProps,
  showStrength = true,
}: {
  label: string;
  field: FieldLike;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  showStrength?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const { className, onChange, ...rest } = inputProps ?? {};
  const invalid = field.state.meta.errors.length > 0;

  return (
    <div className="form-field">
      <label htmlFor={field.name}>{label}</label>
      <div className="relative">
        <Input
          {...rest}
          id={field.name}
          name={field.name}
          type={showPassword ? "text" : "password"}
          autoComplete={rest.autoComplete ?? "current-password"}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(event) => {
            field.handleChange(event.target.value);
            onChange?.(event);
          }}
          aria-invalid={invalid || undefined}
          className={cn("pr-10", className)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setShowPassword((current) => !current)}
          className="absolute right-0 top-0"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      {showStrength && field.state.value.length > 0 && (
        <PasswordStrength password={field.state.value} />
      )}
    </div>
  );
}

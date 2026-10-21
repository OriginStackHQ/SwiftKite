"use client";

import { Check } from "lucide-react";

import { PASSWORD_MIN_LENGTH } from "@/lib/validation";

export function PasswordStrength({ password }: { password: string }) {
  const req = [
    [`At least ${PASSWORD_MIN_LENGTH} characters`, password.length >= PASSWORD_MIN_LENGTH],
    ["An uppercase letter", /[A-Z]/.test(password)],
    ["A lowercase letter", /[a-z]/.test(password)],
    ["A number", /[0-9]/.test(password)],
    ["A special character (@#$%^&+=!)", /[@#$%^&+=!]/.test(password)],
    ["No spaces", password.length > 0 && !/\s/.test(password)],
  ] as const;

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {req.map(([text, ok]) => (
          <span
            key={text}
            className={`h-1 flex-1 rounded ${ok ? "bg-success" : "bg-muted"}`}
          />
        ))}
      </div>
      <div className="space-y-1">
        {req.map(([text, ok]) => (
          <p
            key={text}
            className={`flex items-center gap-2 text-[10px] ${ok ? "text-success" : "text-muted-foreground"}`}
          >
            <Check size={11} />
            {text}
          </p>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAddRecipients } from "@/hooks/use-campaigns";
import type { RecipientInput } from "@/lib/campaign-types";
import errorHandler from "@/lib/errorHandler";

const example = `[
  {"email":"asha@acme.test","data":{"name":"Asha","company":"Acme"}},
  {"email":"noah@northstar.test","data":{"name":"Noah","company":"Northstar"}}
]`;

type Parsed = {
  inputs: RecipientInput[];
  invalid: number;
  errors: string[];
};

function parseJson(value: string): Parsed {
  const errors: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return { inputs: [], invalid: 0, errors: ["Paste valid JSON."] };
  }
  if (!Array.isArray(raw)) {
    return { inputs: [], invalid: 0, errors: ["The top level must be an array."] };
  }
  if (raw.length > 500) {
    return { inputs: [], invalid: 0, errors: ["At most 500 recipients per batch."] };
  }
  const inputs: RecipientInput[] = [];
  let invalid = 0;
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      invalid += 1;
      errors.push(`Row ${index + 1}: expected an object.`);
      return;
    }
    const row = item as { email?: unknown; data?: unknown };
    if (
      typeof row.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())
    ) {
      invalid += 1;
      errors.push(`Row ${index + 1}: invalid email.`);
      return;
    }
    const data: Record<string, string> = {};
    if (row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
      for (const [key, entry] of Object.entries(row.data)) {
        if (entry === null || entry === undefined) continue;
        data[key] = String(entry);
      }
    }
    inputs.push({ email: row.email.trim(), data });
  });
  return { inputs, invalid, errors: errors.slice(0, 5) };
}

export function RecipientImportDialog({
  open,
  onOpenChange,
  campaignId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
}) {
  const addRecipients = useAddRecipients(campaignId);
  const [json, setJson] = useState(example);

  const parsed = parseJson(json);
  const busy = addRecipients.isPending;

  const submit = () => {
    if (parsed.inputs.length === 0) {
      toast.error("No valid recipients to add.");
      return;
    }
    addRecipients.mutate(parsed.inputs, {
      onSuccess: (response) => {
        const skipped = response.skipped + parsed.invalid;
        toast.success(
          `${response.inserted} added, ${skipped} skipped${
            parsed.invalid ? `, ${parsed.invalid} invalid` : ""
          }`,
        );
        setJson(example);
        onOpenChange(false);
      },
      onError: (error) => errorHandler(error),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add recipients</DialogTitle>
          <DialogDescription>
            Add up to 500 recipients per batch. Duplicate emails are skipped
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="subtle-note">
            Paste an array of {"{ email, data }"} objects. Data keys become
            placeholders, so you can put anything you need per person.
          </p>
          <Textarea
            aria-label="Recipients JSON"
            className="min-h-52 font-mono text-xs"
            value={json}
            onChange={(event) => setJson(event.target.value)}
          />
          <div className="rounded-md border bg-muted/30 p-3 text-[11px]">
            <p>
              <span className="font-medium">{parsed.inputs.length}</span> valid
              {parsed.invalid > 0 && (
                <span className="text-destructive"> · {parsed.invalid} invalid</span>
              )}
            </p>
            {parsed.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-destructive">
                {parsed.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
          <span className="text-[11px] text-muted-foreground">
            Max 500 per batch · duplicates skipped
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={busy || parsed.inputs.length === 0}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Plus />}
              Add recipients
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

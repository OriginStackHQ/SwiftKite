"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/swiftkite/ui";
import { useCampaignDefaults, useCreateCampaign } from "@/hooks/use-campaigns";
import errorHandler from "@/lib/errorHandler";

export function NewCampaign() {
  const create = useCreateCampaign();
  const defaults = useCampaignDefaults();
  const router = useRouter();
  const [name, setName] = useState("");
  // null means "not touched yet"; the configured default fills the field.
  const [fromName, setFromName] = useState<string | null>(null);

  const resolvedFromName = fromName ?? defaults.data?.fromName ?? "";
  const fromEmail = defaults.data?.fromEmail ?? "";
  const canSubmit = !create.isPending && !defaults.isLoading;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading
        title="Create a campaign"
        description="Start with a name and sender. You can edit the message and recipients before sending."
      />
      <form
        className="surface p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          create.mutate(
            {
              name: name.trim() || "Untitled campaign",
              subjectTemplate: "A quick update for {{company}}",
              previewText: null,
              bodyTemplate:
                "<p>Hi {{name}},</p><p>This is your campaign body. Add <strong>{{placeholders}}</strong> and a real message before sending.</p><p>— The SwiftKite team</p>",
              fromName: resolvedFromName.trim(),
            },
            {
              onSuccess: (campaign) =>
                router.push(`/dashboard/campaigns/${campaign.id}`),
              onError: (error) => errorHandler(error),
            },
          );
        }}
      >
        <div className="form-field">
          <label htmlFor="campaign-name">Campaign name</label>
          <Input
            id="campaign-name"
            autoFocus
            placeholder="e.g. Spring launch"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="subtle-note">
            This is internal. The email subject is set in the next step.
          </p>
        </div>

        <div className="mt-5 form-grid">
          <div className="form-field">
            <label htmlFor="campaign-from-name">From name</label>
            <Input
              id="campaign-from-name"
              placeholder="SwiftKite"
              value={resolvedFromName}
              onChange={(event) => setFromName(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="campaign-from-email">From email</label>
            <Input
              id="campaign-from-email"
              type="email"
              readOnly
              className="bg-muted/50 text-muted-foreground"
              placeholder={defaults.isLoading ? "Loading…" : "Fixed by SwiftKite"}
              value={fromEmail}
            />
          </div>
        </div>
        <p className="subtle-note mt-2">
          SwiftKite sends through its own verified provider address, so the email is fixed.
          You can still choose the display name.
        </p>

        {defaults.isError && (
          <p className="mt-3 text-[11px] text-destructive">
            Could not load the sender address. Refresh to retry.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t pt-5">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Create draft
            <ArrowRight />
          </Button>
        </div>
      </form>
    </div>
  );
}

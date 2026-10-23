"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  useCampaign,
  useCampaignAction,
  useDeleteCampaign,
  useDeleteRecipient,
  useDeliveries,
  useDuplicateCampaign,
  useRecipients,
  useRemoveRecipientFields,
  useRenameRecipientField,
  useSendCampaign,
  useUpdateCampaign,
  useUpdateRecipient,
} from "@/hooks/use-campaigns";
import errorHandler from "@/lib/errorHandler";
import { RecipientImportDialog } from "./recipient-import-dialog";
import {
  ConfirmDialog,
  CopyButton,
  EmptyState,
  InfoTip,
  PageHeading,
  PageSkeleton,
  PausedBanner,
  PlaceholderChips,
  ProgressBar,
  StatusBadge,
  compactDeliverySegments,
  statusLabel,
} from "./ui";
import {
  DELIVERY_STATUS_INFO,
  DELIVERY_STATUS_LABELS,
  FAILURE_CODE_LABELS,
  formatDate,
  formatDateTime,
  normalizeCounts,
  percent,
  sumCounts,
  type CampaignDetail as CampaignDetailResponse,
  type CampaignWrite,
  type Delivery,
  type DeliveryStatus,
  type Recipient,
} from "@/lib/campaign-types";

type DraftFields = {
  name: string;
  subjectTemplate: string;
  previewText: string;
  bodyTemplate: string;
  fromEmail: string;
  fromName: string;
};

const toDraft = (campaign: CampaignDetailResponse): DraftFields => ({
  name: campaign.name,
  subjectTemplate: campaign.subjectTemplate,
  previewText: campaign.previewText ?? "",
  bodyTemplate: campaign.bodyTemplate,
  fromEmail: campaign.fromEmail,
  fromName: campaign.fromName,
});

const serializeDraft = (draft: DraftFields) =>
  JSON.stringify([
    draft.name,
    draft.subjectTemplate,
    draft.previewText,
    draft.bodyTemplate,
    draft.fromEmail,
    draft.fromName,
  ]);

const hasEmptyPlaceholder = (text: string) => /\{\{\s*\}\}/.test(text);

const canPersist = (draft: DraftFields) =>
  !!draft.name.trim() &&
  !!draft.subjectTemplate.trim() &&
  !!draft.bodyTemplate.trim() &&
  !hasEmptyPlaceholder(draft.subjectTemplate) &&
  !hasEmptyPlaceholder(draft.bodyTemplate) &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.fromEmail.trim());

const toPayload = (draft: DraftFields): CampaignWrite => ({
  name: draft.name.trim(),
  subjectTemplate: draft.subjectTemplate.trim(),
  previewText: draft.previewText.trim() ? draft.previewText : null,
  bodyTemplate: draft.bodyTemplate,
  fromName: draft.fromName.trim(),
});

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const dataValue = (recipient: Recipient | undefined, key: string) => {
  const value = recipient?.data?.[key];
  if (value === undefined || value === null) return "";
  return String(value);
};

export function CampaignDetail({ id }: { id: string }) {
  const campaignQuery = useCampaign(id);

  if (campaignQuery.isPending) return <PageSkeleton />;

  if (campaignQuery.isError || !campaignQuery.data) {
    return (
      <EmptyState
        title="Campaign not found"
        text="This campaign may have been removed, or the API is unreachable."
        action={
          <Button asChild>
            <Link href="/dashboard/campaigns">Back to campaigns</Link>
          </Button>
        }
      />
    );
  }

  const campaign = campaignQuery.data;
  return campaign.status === "DRAFT" ? <DraftEditor campaign={campaign} /> : <ProgressView campaign={campaign} />;
}

// ---------------------------------------------------------------------------
// Draft editor
// ---------------------------------------------------------------------------

function DraftEditor({ campaign }: { campaign: CampaignDetailResponse }) {
  const recipientsQuery = useRecipients(campaign.id);
  const update = useUpdateCampaign(campaign.id);
  const send = useSendCampaign(campaign.id);
  const updateRecipient = useUpdateRecipient(campaign.id);
  const removeRecipient = useDeleteRecipient(campaign.id);
  const renameField = useRenameRecipientField(campaign.id);
  const removeFields = useRemoveRecipientFields(campaign.id);

  const [draft, setDraft] = useState<DraftFields>(() => toDraft(campaign));
  const lastSaved = useRef(serializeDraft(toDraft(campaign)));
  const [tab, setTab] = useState("message");
  const [previewId, setPreviewId] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [editing, setEditing] = useState<Recipient | null>(null);
  const [renameKey, setRenameKey] = useState<string | null>(null);
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const [removeFromTemplate, setRemoveFromTemplate] = useState(true);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientPage, setRecipientPage] = useState(1);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const recipients = useMemo(() => recipientsQuery.data ?? [], [recipientsQuery.data]);

  // Debounced autosave: drafts are the only editable state, so save as you type.
  useEffect(() => {
    const snapshot = serializeDraft(draft);
    if (snapshot === lastSaved.current || !canPersist(draft)) return;
    const timer = setTimeout(() => {
      update.mutate(toPayload(draft), {
        onSuccess: () => {
          lastSaved.current = snapshot;
        },
        onError: (error) => errorHandler(error),
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [draft, update]);

  const update$ = (patch: Partial<DraftFields>) => setDraft((current) => ({ ...current, ...patch }));

  const previewRecipient = recipients.find((recipient) => recipient.id === previewId) ?? recipients[0];

  const placeholders = useMemo(() => {
    const found = new Set<string>();
    for (const text of [draft.subjectTemplate, draft.bodyTemplate]) {
      for (const match of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
        if (match[1]) found.add(match[1]);
      }
    }
    return [...found];
  }, [draft.subjectTemplate, draft.bodyTemplate]);

  // Show a column for every template placeholder even when no recipient has it yet,
  // so a newly added placeholder is visible (and renameable) for everyone.
  const dataKeys = useMemo(() => {
    const keys = new Set<string>(placeholders);
    for (const recipient of recipients) {
      Object.keys(recipient.data ?? {}).forEach((key) => keys.add(key));
    }
    return [...keys].sort();
  }, [placeholders, recipients]);

  const missingByKey = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const key of placeholders) {
      const missing = recipients
        .filter((recipient) => !dataValue(recipient, key).trim())
        .map((recipient) => recipient.email);
      if (missing.length > 0) result.set(key, missing);
    }
    return result;
  }, [placeholders, recipients]);

  const checklist = [
    {
      label: "Sender name and email are set",
      pass: !!draft.fromName.trim() && !!draft.fromEmail.trim(),
    },
    { label: "Subject is set", pass: !!draft.subjectTemplate.trim() },
    { label: "Body is set", pass: !!draft.bodyTemplate.trim() },
    { label: "At least one recipient", pass: recipients.length > 0 },
    {
      label: "Every placeholder has a value for every recipient",
      pass: missingByKey.size === 0,
    },
    {
      label: "No empty placeholders like {{}}",
      pass:
        !hasEmptyPlaceholder(draft.subjectTemplate) &&
        !hasEmptyPlaceholder(draft.bodyTemplate),
    },
  ];
  const canSend = checklist.every((item) => item.pass);

  const insertPlaceholder = (field: "subject" | "body") => {
    const element = field === "subject" ? subjectRef.current : bodyRef.current;
    const value = field === "subject" ? draft.subjectTemplate : draft.bodyTemplate;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    return (token: string) => {
      const next = value.slice(0, start) + token + value.slice(end);
      update$(field === "subject" ? { subjectTemplate: next } : { bodyTemplate: next });
      requestAnimationFrame(() => {
        element?.focus();
        element?.setSelectionRange(start + token.length, start + token.length);
      });
    };
  };

  const filteredRecipients = recipients.filter((recipient) =>
    recipient.email.toLowerCase().includes(recipientSearch.trim().toLowerCase()),
  );
  const perPage = 12;
  const pages = Math.max(1, Math.ceil(filteredRecipients.length / perPage));
  const activePage = Math.min(recipientPage, pages);
  const visibleRecipients = filteredRecipients.slice((activePage - 1) * perPage, activePage * perPage);

  const dirty = serializeDraft(draft) !== lastSaved.current;
  const saveLabel = update.isPending ? "Saving…" : dirty ? "Unsaved changes" : "Saved";

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button size="icon" variant="ghost" asChild>
            <Link href="/dashboard/campaigns" aria-label="Back to campaigns">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <input
              aria-label="Campaign name"
              className="w-full max-w-96 border-0 bg-transparent text-xl font-semibold outline-none"
              value={draft.name}
              onChange={(event) => update$({ name: event.target.value })}
            />
            <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Check size={11} />
              {saveLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={campaign.status} info={false} />
          <Button
            onClick={() => setSendOpen(true)}
            disabled={!canSend}
            title={canSend ? "Send campaign" : "Complete the review checklist before sending."}
          >
            <Send />
            Send
          </Button>
        </div>
      </div>

      <div className="tab-row" aria-label="Draft sections">
        {[
          ["message", "Message"],
          ["recipients", `Recipients${recipients.length ? ` (${recipients.length})` : ""}`],
          ["review", "Review"],
        ].map(([key, label]) => (
          <Button key={key} variant="ghost" className={tab === key ? "active" : ""} onClick={() => setTab(key!)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === "message" && (
        <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
          <section className="surface p-5">
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="from-name">From name</label>
                <Input
                  id="from-name"
                  value={draft.fromName}
                  onChange={(event) => update$({ fromName: event.target.value })}
                />
              </div>
              <div className="form-field">
                <label htmlFor="from-email">From email</label>
                <Input
                  id="from-email"
                  type="email"
                  value={draft.fromEmail}
                  readOnly
                  className="bg-muted/50 text-muted-foreground"
                />
                <p className="subtle-note">
                  SwiftKite sends through its own verified provider address, so this can&apos;t
                  be changed.
                </p>
              </div>
            </div>
            <div className="mt-5 form-field">
              <div className="flex justify-between gap-3">
                <label htmlFor="campaign-subject">Subject</label>
                <span className="text-[10px] text-muted-foreground">{draft.subjectTemplate.length}/140</span>
              </div>
              <Input
                id="campaign-subject"
                ref={subjectRef}
                maxLength={140}
                value={draft.subjectTemplate}
                onChange={(event) => update$({ subjectTemplate: event.target.value })}
              />
              <PlaceholderChips text={draft.subjectTemplate} onInsert={insertPlaceholder("subject")} />
              {hasEmptyPlaceholder(draft.subjectTemplate) && (
                <p className="text-[11px] text-destructive">
                  Remove empty placeholders like <span className="font-mono">{"{{}}"}</span>.
                </p>
              )}
            </div>
            <div className="mt-5 form-field">
              <label htmlFor="campaign-preview-text">Preview text</label>
              <Input
                id="campaign-preview-text"
                maxLength={200}
                placeholder="Shown in the inbox next to the subject"
                value={draft.previewText}
                onChange={(event) => update$({ previewText: event.target.value })}
              />
            </div>
            <div className="mt-5 form-field">
              <label htmlFor="campaign-body">Body</label>
              <Textarea
                id="campaign-body"
                ref={bodyRef}
                className="min-h-80 font-mono text-xs leading-6"
                value={draft.bodyTemplate}
                onChange={(event) => update$({ bodyTemplate: event.target.value })}
              />
              <PlaceholderChips text={draft.bodyTemplate} onInsert={insertPlaceholder("body")} />
              {hasEmptyPlaceholder(draft.bodyTemplate) && (
                <p className="text-[11px] text-destructive">
                  Remove empty placeholders like <span className="font-mono">{"{{}}"}</span>.
                </p>
              )}
            </div>
          </section>

          <section className="surface overflow-hidden xl:sticky xl:top-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3 text-xs">
              <span className="font-medium">Live preview</span>
              <div className="flex items-center gap-2">
                {recipients.length > 0 && (
                  <select
                    className="native-select h-8 text-[11px]"
                    aria-label="Preview as recipient"
                    value={previewRecipient?.id ?? ""}
                    onChange={(event) => setPreviewId(event.target.value)}
                  >
                    {recipients.map((recipient) => (
                      <option key={recipient.id} value={recipient.id}>
                        {recipient.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <Preview draft={draft} recipient={previewRecipient} missing={missingByKey} />
          </section>
        </div>
      )}

      {tab === "recipients" && (
        <>
          <div className="filter-toolbar">
            <div className="relative mr-auto w-full max-w-sm">
              <Input
                aria-label="Search recipients"
                placeholder="Search recipients..."
                className="pl-3"
                value={recipientSearch}
                onChange={(event) => {
                  setRecipientSearch(event.target.value);
                  setRecipientPage(1);
                }}
              />
            </div>
            <Button onClick={() => setImportOpen(true)}>
              <Plus />
              Add recipients
            </Button>
          </div>
          <p className="subtle-note mb-4">
            Recipients can only be changed while the campaign is a draft. A column header&rsquo;s menu lets you rename a
            column &mdash; the values move with it and, if you want, the subject and body are updated too &mdash; or
            remove a column you no longer need.
          </p>
          <section className="surface overflow-hidden">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    {dataKeys.map((key) => {
                      const isPlaceholder = placeholders.includes(key);
                      const missing = missingByKey.get(key)?.length ?? 0;
                      return (
                        <th key={key}>
                          <span className="flex items-center gap-1.5">
                            <span className="max-w-[150px] truncate font-mono font-normal" title={key}>
                              {key}
                            </span>
                            {isPlaceholder ? (
                              missing > 0 ? (
                                <span
                                  className="badge badge-error h-[18px] px-1.5 text-[10px]"
                                  title={`{{${key}}} is missing for ${missing} recipients`}
                                >
                                  {missing} missing
                                </span>
                              ) : (
                                <Check size={12} className="text-success" aria-label={`${key} is set for everyone`} />
                              )
                            ) : (
                              <span
                                className="rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground"
                                title="Not used in the subject or body"
                              >
                                unused
                              </span>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="rounded p-0.5 text-muted-foreground opacity-60 transition hover:bg-background hover:text-foreground hover:opacity-100"
                                  aria-label={`Column actions for ${key}`}
                                >
                                  <MoreHorizontal size={13} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-44">
                                <DropdownMenuLabel className="font-mono text-[11px]">{key}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setRenameKey(key)}>
                                  <Pencil size={13} />
                                  Rename column…
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setRemoveFromTemplate(true);
                                    setRemoveKey(key);
                                  }}
                                >
                                  <Trash2 size={13} />
                                  Remove column
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </span>
                        </th>
                      );
                    })}
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecipients.map((recipient) => (
                    <tr key={recipient.id}>
                      <td>
                        <span className="block max-w-[240px] truncate font-mono text-[11px]" title={recipient.email}>
                          {recipient.email}
                        </span>
                      </td>
                      {dataKeys.map((key) => {
                        const value = dataValue(recipient, key);
                        if (value) {
                          return (
                            <td key={key}>
                              <span className="block max-w-[220px] truncate" title={value}>
                                {value}
                              </span>
                            </td>
                          );
                        }
                        return (
                          <td key={key}>
                            {placeholders.includes(key) ? (
                              <span className="badge badge-error text-[10px]">Missing</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit ${recipient.email}`}
                            onClick={() => setEditing(recipient)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            aria-label={`Remove ${recipient.email}`}
                            disabled={removeRecipient.isPending}
                            onClick={() =>
                              removeRecipient.mutate(recipient.id, {
                                onSuccess: () => toast.success("Recipient removed"),
                                onError: (error) => errorHandler(error),
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {recipients.length === 0 && (
              <EmptyState
                title="No recipients yet"
                text={recipientsQuery.isPending ? "Loading recipients..." : "Add recipients by pasting JSON."}
                action={
                  <Button onClick={() => setImportOpen(true)}>
                    <Plus />
                    Add recipients
                  </Button>
                }
              />
            )}
            <div className="table-footer">
              <span>
                {filteredRecipients.length === 0
                  ? `0 recipients${recipientSearch ? " match" : ""}`
                  : `Showing ${(activePage - 1) * perPage + 1}–${Math.min(
                      activePage * perPage,
                      filteredRecipients.length,
                    )} of ${filteredRecipients.length}${
                      recipientSearch ? ` (filtered from ${recipients.length})` : ""
                    } recipients`}{" "}
                · {dataKeys.length} fields
              </span>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activePage === 1}
                  onClick={() => setRecipientPage(activePage - 1)}
                >
                  Previous
                </Button>
                <span>
                  {activePage}/{pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activePage === pages}
                  onClick={() => setRecipientPage(activePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </section>
        </>
      )}

      {tab === "review" && (
        <div className="mx-auto max-w-3xl">
          <section className="surface p-6">
            <h2 className="text-lg font-semibold">Before you send</h2>
            <p className="subtle-note mt-1">
              Review is a checklist, not a guarantee. Every email is snapshotted at send time.
            </p>
            <div className="mt-5 space-y-3">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-start gap-3 border-b py-3 last:border-0">
                  {item.pass ? (
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" />
                  ) : (
                    <XCircle size={17} className="mt-0.5 shrink-0 text-destructive" />
                  )}
                  <span className={item.pass ? "text-xs" : "text-xs text-destructive"}>{item.label}</span>
                </div>
              ))}
            </div>
            {missingByKey.size > 0 && (
              <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-xs font-medium text-destructive">Some recipients are missing placeholder values</p>
                <div className="mt-3 space-y-2">
                  {[...missingByKey.entries()].map(([key, missing]) => (
                    <div key={key} className="text-[11px]">
                      <span className="font-mono">{`{{${key}}}`}</span> missing for {missing.length} recipient
                      {missing.length === 1 ? "" : "s"}:{" "}
                      <span className="text-muted-foreground">{missing.slice(0, 4).join(", ")}</span>
                      {missing.length > 4 && " ..."}
                    </div>
                  ))}
                </div>
                <Button className="mt-4" size="sm" variant="outline" onClick={() => setTab("recipients")}>
                  Show in table
                </Button>
              </div>
            )}
            <dl className="mt-6 divide-y border-y">
              {[
                ["From", `${draft.fromName} <${draft.fromEmail}>`],
                ["Subject", draft.subjectTemplate],
                ["Recipients", `${recipients.length} recipients`],
                ["Template", "Locked after send"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_1fr] gap-3 py-3 text-xs">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-all font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="subtle-note max-w-md">
                After sending, the template and recipients are locked. You can pause or stop at any time.
              </p>
              <Button
                disabled={!canSend}
                onClick={() => setSendOpen(true)}
                title={canSend ? "Send campaign" : "Complete the checklist first."}
              >
                <Send />
                Send campaign
              </Button>
            </div>
          </section>
        </div>
      )}

      <RecipientImportDialog open={importOpen} onOpenChange={setImportOpen} campaignId={campaign.id} />

      <RecipientEditDialog
        recipient={editing}
        placeholders={placeholders}
        busy={updateRecipient.isPending}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSave={(email, data) => {
          if (!editing) return;
          updateRecipient.mutate(
            { recipientId: editing.id, email, data },
            {
              onSuccess: () => {
                toast.success("Recipient updated");
                setEditing(null);
              },
              onError: (error) => errorHandler(error),
            },
          );
        }}
      />

      <RenameFieldDialog
        current={renameKey}
        usedInTemplate={
          !!renameKey &&
          (draft.subjectTemplate.includes(`{{${renameKey}}}`) || draft.bodyTemplate.includes(`{{${renameKey}}}`))
        }
        busy={renameField.isPending}
        onOpenChange={(open) => {
          if (!open) setRenameKey(null);
        }}
        onApply={(to, overwrite, alsoTemplate) => {
          const from = renameKey;
          if (!from) return;
          renameField.mutate(
            { from, to, overwrite },
            {
              onSuccess: (result) => {
                if (alsoTemplate) {
                  update$({
                    subjectTemplate: swapPlaceholder(draft.subjectTemplate, from, `{{${to}}}`),
                    bodyTemplate: swapPlaceholder(draft.bodyTemplate, from, `{{${to}}}`),
                  });
                }
                toast.success(`Renamed to ${to} on ${result.updated} recipient${result.updated === 1 ? "" : "s"}`);
                setRenameKey(null);
              },
              onError: (error) => errorHandler(error),
            },
          );
        }}
      />

      <ConfirmDialog
        open={!!removeKey}
        onOpenChange={(open) => {
          if (!open) setRemoveKey(null);
        }}
        title={`Remove "${removeKey}" column?`}
        description={`This removes the "${removeKey}" column from every recipient.`}
        action="Remove column"
        destructive
        onConfirm={() => {
          const key = removeKey;
          if (!key) return;
          const alsoTemplate = removeFromTemplate && placeholders.includes(key);
          removeFields.mutate([key], {
            onSuccess: (result) => {
              if (alsoTemplate) {
                update$({
                  subjectTemplate: swapPlaceholder(draft.subjectTemplate, key, ""),
                  bodyTemplate: swapPlaceholder(draft.bodyTemplate, key, ""),
                });
              }
              toast.success(`Removed ${key} from ${result.updated} recipient${result.updated === 1 ? "" : "s"}`);
              setRemoveKey(null);
            },
            onError: (error) => errorHandler(error),
          });
        }}
      >
        {removeKey && placeholders.includes(removeKey) && (
          <label className="mt-4 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={removeFromTemplate}
              onChange={(event) => setRemoveFromTemplate(event.target.checked)}
            />
            Also remove <span className="font-mono">{`{{${removeKey}}}`}</span> from the subject and body
          </label>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        title="Send this campaign?"
        description={`You are about to send to ${recipients.length} recipients. After sending, the template and recipients are locked and each email is saved as a snapshot. You can pause or stop at any time.`}
        action="Send campaign"
        onConfirm={() =>
          send.mutate(undefined, {
            onSuccess: () => toast.success("Sending started"),
            onError: (error) => errorHandler(error),
          })
        }
      />
    </>
  );
}

function RenameFieldDialog({
  current,
  usedInTemplate,
  busy,
  onOpenChange,
  onApply,
}: {
  current: string | null;
  usedInTemplate: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (to: string, overwrite: boolean, alsoTemplate: boolean) => void;
}) {
  const [to, setTo] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [alsoTemplate, setAlsoTemplate] = useState(usedInTemplate);

  useEffect(() => {
    if (current) {
      setTo("");
      setOverwrite(false);
      setAlsoTemplate(usedInTemplate);
    }
  }, [current, usedInTemplate]);

  const valid = /^[A-Za-z0-9_]+$/.test(to) && to !== current;

  return (
    <Dialog open={!!current} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename column</DialogTitle>
          <DialogDescription>
            Rename <span className="font-mono">{current}</span> for every recipient. The stored values move with it and
            the old column is removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="form-field">
            <label htmlFor="rename-column">New column name</label>
            <Input
              id="rename-column"
              autoFocus
              value={to}
              placeholder={`${current}`}
              onChange={(event) => setTo(event.target.value)}
            />
            {to.length > 0 && !valid && (
              <p className="text-[11px] text-destructive">
                Use letters, numbers and underscores only, and pick a different name.
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
            Overwrite a recipient&rsquo;s value if the new column already exists
          </label>

          {usedInTemplate && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={alsoTemplate}
                onChange={(event) => setAlsoTemplate(event.target.checked)}
              />
              Also rename <span className="font-mono">{`{{${current}}}`}</span> in the subject and body
            </label>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !valid} onClick={() => onApply(to.trim(), overwrite, alsoTemplate)}>
            {busy && <Loader2 className="animate-spin" />}
            Rename column
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Replaces `{{key}}` (and `{{ key }}`) tokens in a template. */
function swapPlaceholder(text: string, key: string, replacement: string) {
  return text.split(`{{${key}}}`).join(replacement).split(`{{ ${key} }}`).join(replacement);
}

type FieldRow = { key: string; value: string; custom: boolean };

function RecipientEditDialog({
  recipient,
  placeholders,
  busy,
  onOpenChange,
  onSave,
}: {
  recipient: Recipient | null;
  placeholders: string[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (email: string, data: Record<string, unknown>) => void;
}) {
  const [email, setEmail] = useState("");
  const [rows, setRows] = useState<FieldRow[]>([]);

  useEffect(() => {
    if (!recipient) return;
    const keys: string[] = [];
    const push = (key: string) => {
      if (key && !keys.includes(key)) keys.push(key);
    };
    placeholders.forEach(push);
    Object.keys(recipient.data ?? {}).forEach(push);
    setEmail(recipient.email);
    setRows(
      keys.map((key) => ({
        key,
        value: dataValue(recipient, key),
        custom: false,
      })),
    );
  }, [recipient, placeholders]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const trimmedKeys = rows.map((row) => row.key.trim());
  const keysValid = trimmedKeys.every(Boolean) && new Set(trimmedKeys).size === trimmedKeys.length;

  const patch = (index: number, value: Partial<FieldRow>) =>
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...value } : row)));

  const save = () => {
    if (!emailValid || !keysValid) return;
    const data: Record<string, unknown> = {};
    rows.forEach((row) => {
      const key = row.key.trim();
      if (key) data[key] = row.value;
    });
    onSave(email.trim(), data);
  };

  return (
    <Dialog open={!!recipient} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit recipient</DialogTitle>
          <DialogDescription>
            Fields are the current template placeholders plus this person&rsquo;s own data. Add a value for a newly
            introduced placeholder to make the email ready for them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="form-field">
            <label htmlFor="recipient-email">Email</label>
            <Input id="recipient-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            {email.length > 0 && !emailValid && <p className="text-[11px] text-destructive">Enter a valid email.</p>}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Placeholder values</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRows((current) => [...current, { key: "", value: "", custom: true }])}
              >
                <Plus />
                Add field
              </Button>
            </div>

            {rows.map((row, index) => (
              <div key={`${row.custom ? "custom" : "fixed"}-${index}`} className="flex items-center gap-2">
                {row.custom ? (
                  <Input
                    aria-label="Field key"
                    className="w-32 shrink-0 font-mono text-xs"
                    placeholder="key"
                    value={row.key}
                    onChange={(event) => patch(index, { key: event.target.value })}
                  />
                ) : (
                  <span className="w-32 shrink-0 truncate font-mono text-[11px]">
                    {row.key}
                    {placeholders.includes(row.key) && (
                      <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] uppercase text-muted-foreground">
                        tpl
                      </span>
                    )}
                  </span>
                )}
                <Input
                  aria-label={`${row.key || "field"} value`}
                  className="flex-1"
                  placeholder={!row.custom && placeholders.includes(row.key) ? "Missing value" : undefined}
                  value={row.value}
                  onChange={(event) => patch(index, { value: event.target.value })}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  aria-label={`Remove ${row.key || "field"}`}
                  onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                >
                  <X size={14} />
                </Button>
              </div>
            ))}

            {rows.length === 0 && (
              <p className="text-[11px] text-muted-foreground">This recipient has no data fields yet.</p>
            )}
            {!keysValid && <p className="text-[11px] text-destructive">Field keys must be non-empty and unique.</p>}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !emailValid || !keysValid}>
            {busy && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Preview({
  draft,
  recipient,
  missing,
}: {
  draft: DraftFields;
  recipient: Recipient | undefined;
  missing: Map<string, string[]>;
}) {
  const email = recipient?.email ?? "preview@example.com";
  const render = (template: string) =>
    template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
      const value = dataValue(recipient, key);
      if (!value.trim()) {
        return `<mark class="placeholder-missing" title="Missing for this recipient">${match}</mark>`;
      }
      return escapeHtml(value);
    });
  const subject = render(draft.subjectTemplate);
  const body = render(draft.bodyTemplate);
  return (
    <div className="p-6">
      <div className="rounded-lg border bg-muted/40 p-4 text-xs">
        <p>
          <span className="text-muted-foreground">From: </span>
          {draft.fromName} &lt;{draft.fromEmail}&gt;
        </p>
        <p className="mt-1.5">
          <span className="text-muted-foreground">Subject: </span>
          <span dangerouslySetInnerHTML={{ __html: subject }} />
        </p>
        <p className="mt-1.5 text-muted-foreground">To: {email}</p>
      </div>
      <article
        className="campaign-preview mt-4"
        dangerouslySetInnerHTML={{
          __html: body || "<p class='text-muted-foreground'>Nothing here yet.</p>",
        }}
      />
      {missing.size > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-destructive/5 p-3 text-[11px] text-destructive">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Missing for {email}: {[...missing.keys()].map((key) => `{{${key}}}`).join(", ")}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress view
// ---------------------------------------------------------------------------

function ProgressView({ campaign }: { campaign: CampaignDetailResponse }) {
  const router = useRouter();
  const [status, setStatus] = useState<DeliveryStatus | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const polling = campaign.status === "SENDING" || campaign.status === "STOPPING";
  const deliveriesQuery = useDeliveries(campaign.id, status, page, 20, polling);
  const pause = useCampaignAction("pause");
  const resume = useCampaignAction("resume");
  const stop = useCampaignAction("stop");
  const remove = useDeleteCampaign();
  const duplicate = useDuplicateCampaign();

  const counts = useMemo(() => normalizeCounts(campaign.counts), [campaign.counts]);
  const total = sumCounts(counts);
  const terminal = counts.DELIVERED + counts.FAILED + counts.BOUNCED + counts.COMPLAINED + counts.CANCELLED;
  const processed = percent(terminal, total);
  const failed = counts.FAILED;
  const segments = compactDeliverySegments(counts);

  const deliveries = deliveriesQuery.data?.content ?? [];
  const totalPages = deliveriesQuery.data?.totalPages ?? 0;

  const run = (mutation: { mutate: (id: string, options?: object) => void }, label: string) =>
    mutation.mutate(campaign.id, {
      onSuccess: () => toast.success(label),
      onError: (error: unknown) => errorHandler(error),
    });

  return (
    <>
      <Link href="/dashboard/campaigns" className="mb-5 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowLeft size={13} />
        Back to campaigns
      </Link>
      <PageHeading
        title={campaign.name}
        description={`${campaign.fromName} <${campaign.fromEmail}> · ${formatDate(campaign.createdAt)} · ${total} recipients`}
      >
        <StatusBadge status={campaign.status} reason={campaign.pausedReason ?? undefined} />
        {campaign.status === "SENDING" && (
          <>
            <Button variant="outline" onClick={() => run(pause, "Campaign paused")}>
              <Pause />
              Pause
            </Button>
            <Button variant="outline" onClick={() => setStopOpen(true)}>
              Stop
            </Button>
          </>
        )}
        {campaign.status === "PAUSED" && (
          <>
            <Button onClick={() => run(resume, "Campaign resumed")}>
              <Play />
              Resume
            </Button>
            <Button variant="outline" onClick={() => setStopOpen(true)}>
              Stop
            </Button>
          </>
        )}
        {campaign.status === "STOPPING" && (
          <span className="text-[11px] text-muted-foreground">Waiting for in-flight emails to finish...</span>
        )}
        {(campaign.status === "STOPPED" || campaign.status === "COMPLETED") && (
          <>
            <Button
              variant="outline"
              disabled={duplicate.isPending}
              onClick={() =>
                duplicate.mutate(campaign.id, {
                  onSuccess: (created) => {
                    toast.success("Campaign duplicated as a draft");
                    router.push(`/dashboard/campaigns/${created.id}`);
                  },
                  onError: (error) => errorHandler(error),
                })
              }
            >
              <Copy />
              Duplicate
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 />
              Delete
            </Button>
          </>
        )}
      </PageHeading>

      {campaign.status === "PAUSED" && campaign.pausedReason && (
        <div className="mb-6">
          <PausedBanner
            reason={campaign.pausedReason}
            pending={counts.PENDING}
            onResume={() => run(resume, "Campaign resumed")}
          />
        </div>
      )}

      <section className="surface p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title">Delivery progress</h2>
            <p className="subtle-note mt-1">Every recipient accounted for.</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-semibold">{processed}</span>
            <p className="text-[10px] text-muted-foreground">
              {terminal} of {total} processed
            </p>
          </div>
        </div>
        <ProgressBar segments={segments} total={total} />
        <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          <span>{counts.DELIVERED} delivered</span>
          <span>{counts.ACCEPTED} accepted</span>
          <span>{counts.PENDING} pending</span>
          <span>{failed} failed</span>
          <span>{counts.CANCELLED} cancelled</span>
        </div>
      </section>

      <div className="my-6 grid grid-cols-2 gap-x-6 gap-y-5 border-y py-6 md:grid-cols-4 xl:grid-cols-8">
        {(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((key) => (
          <div
            key={key}
            role="button"
            tabIndex={0}
            className={`cursor-pointer text-left ${status === key ? "text-primary" : ""}`}
            onClick={() => {
              setStatus(status === key ? "ALL" : key);
              setPage(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setStatus(status === key ? "ALL" : key);
                setPage(0);
              }
            }}
          >
            <span className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {DELIVERY_STATUS_LABELS[key]}
              <InfoTip text={DELIVERY_STATUS_INFO[key]} />
            </span>
            <span className="text-2xl font-semibold">{counts[key]}</span>
            <span className="ml-2 text-[10px] text-muted-foreground">{percent(counts[key], total)}</span>
          </div>
        ))}
      </div>

      {failed > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-xs">
          <div className="flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">{failed} failed deliveries</p>
              <p className="mt-1 text-muted-foreground">SwiftKite never retries a failed email automatically.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setExplainerOpen(true)}>
            Why aren’t these retried?
          </Button>
        </div>
      )}

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b p-5">
          <div className="mr-auto">
            <h2 className="section-title">Deliveries</h2>
            <p className="subtle-note mt-1">One immutable snapshot per recipient.</p>
          </div>
          <select
            className="native-select"
            aria-label="Filter deliveries by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as DeliveryStatus | "ALL");
              setPage(0);
            }}
          >
            <option value="ALL">All statuses</option>
            {(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((key) => (
              <option key={key} value={key}>
                {DELIVERY_STATUS_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Provider message ID</th>
                <th>Accepted at</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="cursor-pointer" onClick={() => setSelected(delivery)}>
                  <td className="font-mono text-[11px]">{delivery.email}</td>
                  <td>
                    <StatusBadge status={delivery.status} failure={delivery.failureCode ?? undefined} info={false} />
                  </td>
                  <td className="font-mono text-[10px] text-muted-foreground">{delivery.providerMessageId ?? "—"}</td>
                  <td className="text-muted-foreground">
                    {delivery.acceptedAt ? formatDateTime(delivery.acceptedAt) : "—"}
                  </td>
                  <td className="max-w-52 truncate text-muted-foreground" title={delivery.detail ?? undefined}>
                    {delivery.detail ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!deliveriesQuery.isPending && deliveries.length === 0 && (
          <EmptyState
            title="No deliveries match"
            text="Try another status filter, or wait for the first batch to be created."
          />
        )}
        <div className="table-footer">
          <span>{deliveriesQuery.data?.totalElements ?? 0} deliveries</span>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))}>
              Previous
            </Button>
            <span>
              {Math.min(page + 1, Math.max(1, totalPages))}/{Math.max(1, totalPages)}
            </span>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      </section>

      <DeliverySheet delivery={selected} onClose={() => setSelected(null)} />
      <ExplainDialog open={explainerOpen} onOpenChange={setExplainerOpen} />
      <ConfirmDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        title="Stop this campaign?"
        description={`Stopping is permanent. ${counts.PENDING} pending emails will be cancelled. Emails already being sent will finish.`}
        action="Stop campaign"
        destructive
        onConfirm={() => run(stop, "Stop requested")}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this campaign?"
        description="This permanently deletes the campaign, its recipients and all delivery records. This cannot be undone."
        action="Delete campaign"
        destructive
        onConfirm={() =>
          remove.mutate(campaign.id, {
            onSuccess: () => {
              toast.success("Campaign deleted");
              router.push("/dashboard/campaigns");
            },
            onError: (error) => errorHandler(error),
          })
        }
      />
    </>
  );
}

function DeliverySheet({ delivery, onClose }: { delivery: Delivery | null; onClose: () => void }) {
  return (
    <Sheet open={!!delivery} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-card sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Delivery detail</SheetTitle>
          <SheetDescription>
            {delivery?.email} · {delivery ? statusLabel(delivery.status) : ""}
          </SheetDescription>
        </SheetHeader>
        {delivery && (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={delivery.status} failure={delivery.failureCode ?? undefined} />
              {delivery.failureCode && (
                <span className="badge badge-error">{FAILURE_CODE_LABELS[delivery.failureCode]}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-[10px] text-muted-foreground">Created at</p>
                <p className="mt-1">{formatDateTime(delivery.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Accepted at</p>
                <p className="mt-1">{delivery.acceptedAt ? formatDateTime(delivery.acceptedAt) : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Last updated</p>
                <p className="mt-1">{formatDateTime(delivery.updatedAt)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Recipient ID</p>
                <p className="mt-1 break-all font-mono text-[10px]">{delivery.recipientId}</p>
              </div>
            </div>
            {delivery.providerMessageId && (
              <div>
                <p className="mb-2 text-[10px] text-muted-foreground">Provider message ID</p>
                <div className="flex items-center gap-2">
                  <code className="break-all rounded bg-muted px-2 py-1 text-[11px]">{delivery.providerMessageId}</code>
                  <CopyButton value={delivery.providerMessageId} label="Copy" />
                </div>
              </div>
            )}
            {delivery.detail && (
              <div>
                <p className="mb-1 text-[10px] text-muted-foreground">Detail</p>
                <p className="text-xs">{delivery.detail}</p>
              </div>
            )}
            <div>
              <p className="mb-3 text-xs font-semibold">Status timeline</p>
              <div className="space-y-3">
                {(["PENDING", "ACCEPTED", "DELIVERED"] as DeliveryStatus[]).map((step) => {
                  const reached =
                    step === "PENDING" ||
                    (step === "ACCEPTED" &&
                      (!!delivery.acceptedAt ||
                        ["ACCEPTED", "DELIVERED", "BOUNCED", "COMPLAINED"].includes(delivery.status))) ||
                    (step === "DELIVERED" && delivery.status === "DELIVERED");
                  return (
                    <div key={step} className="flex items-center gap-2 text-[11px]">
                      <span
                        className={
                          reached
                            ? "h-1.5 w-1.5 rounded-full bg-primary"
                            : "h-1.5 w-1.5 rounded-full bg-muted-foreground/30"
                        }
                      />
                      <span className={reached ? "" : "text-muted-foreground"}>{DELIVERY_STATUS_LABELS[step]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ExplainDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>Why aren’t these retried?</DialogTitle>
          <DialogDescription>SwiftKite prefers a missed email over a duplicate email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-xs leading-6 text-muted-foreground">
          <p>
            <strong className="text-foreground">Rejected by provider</strong> means the provider refused the message. It
            was never sent, so it is not retried automatically.
          </p>
          <p>
            <strong className="text-foreground">Unknown outcome</strong> means we could not confirm whether the provider
            accepted the message. Retrying could send a duplicate, so we leave it flagged and wait for a provider event
            that can resolve it.
          </p>
          <p>A delivery event can still move an unknown outcome forward. It is never silently retried.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

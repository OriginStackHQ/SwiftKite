"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Ban, Check, Copy, Info, Send, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  CAMPAIGN_STATUS_INFO,
  CAMPAIGN_STATUS_LABELS,
  DELIVERY_STATUS_INFO,
  DELIVERY_STATUS_LABELS,
  FAILURE_CODE_LABELS,
  PAUSED_REASON_LABELS,
  percent,
  type CampaignStatus,
  type DeliveryStatus,
  type FailureCode,
  type PausedReason,
} from "@/lib/campaign-types";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden>
        <Send size={15} strokeWidth={2.6} />
      </span>
      {!compact && <span className="sidebar-brand-name">SwiftKite</span>}
    </span>
  );
}

const statusTone: Record<string, string> = {
  DRAFT: "",
  STOPPED: "",
  CANCELLED: "",
  PENDING: "",
  SENDING: "badge-info",
  ACCEPTED: "badge-info",
  ATTEMPTING: "badge-info",
  PAUSED: "badge-warning",
  STOPPING: "badge-warning",
  COMPLETED: "badge-success",
  DELIVERED: "badge-success",
  BOUNCED: "badge-error",
  FAILED: "badge-error",
  COMPLAINED: "badge-complaint",
};

export function statusLabel(status: string) {
  return (
    CAMPAIGN_STATUS_LABELS[status as CampaignStatus] ??
    DELIVERY_STATUS_LABELS[status as DeliveryStatus] ??
    status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function statusInfo(status: string) {
  return (
    CAMPAIGN_STATUS_INFO[status as CampaignStatus] ??
    DELIVERY_STATUS_INFO[status as DeliveryStatus] ??
    "Current status."
  );
}

export function StatusBadge({
  status,
  reason,
  failure,
  info = true,
  className,
}: {
  status: string;
  reason?: PausedReason | undefined;
  failure?: FailureCode | undefined;
  info?: boolean;
  className?: string;
}) {
  const label = statusLabel(status);
  const bounced = status === "BOUNCED";
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <span className={cn("badge", statusTone[status])}>
        {bounced ? <Ban size={11} aria-hidden /> : <span className="badge-dot" aria-hidden />}
        {label}
        {info && <InfoTip text={statusInfo(status)} />}
      </span>
      {reason && (
        <span className="badge badge-warning">
          <span className="badge-dot" aria-hidden />
          {PAUSED_REASON_LABELS[reason]}
        </span>
      )}
      {failure && (
        <span className="badge badge-error" title={FAILURE_CODE_LABELS[failure]}>
          {FAILURE_CODE_LABELS[failure]}
        </span>
      )}
    </span>
  );
}

export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div className="min-w-0">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">{children}</div>}
    </div>
  );
}

export type Metric = {
  label: string;
  value: string;
  change?: string;
  good?: boolean;
  info?: string;
  series?: number[];
};

export function MetricStrip({ items }: { items: Metric[] }) {
  return (
    <section className="metrics" aria-label="Key metrics">
      {items.map((item) => (
        <div className="metric" key={item.label}>
          <div className="metric-label">
            {item.label}
            {item.info && <InfoTip text={item.info} />}
          </div>
          <div className="metric-value">{item.value}</div>
          {item.change && (
            <div className={cn("metric-change", item.good === false && "text-destructive")}>
              {item.good === false ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
              {item.change}
              <span className="text-muted-foreground">vs. prior</span>
            </div>
          )}
          {item.series && (
            <div className="metric-spark" aria-hidden>
              <ResponsiveContainer>
                <AreaChart data={item.series.map((v) => ({ v }))}>
                  <Area
                    dataKey="v"
                    stroke="var(--primary)"
                    fill="var(--primary-soft)"
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex text-muted-foreground" aria-label={text}>
            <Info size={13} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 bg-foreground text-background">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          toast.error("Could not copy. Select the text and copy it manually.");
          return;
        }
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  action,
  confirmText,
  onConfirm,
  destructive = false,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  action: string;
  confirmText?: string;
  onConfirm: () => void;
  destructive?: boolean;
  children?: ReactNode;
}) {
  const [typed, setTyped] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTyped("");
      }}
    >
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {confirmText && (
          <div className="form-field">
            <label htmlFor="typed-confirm">
              Type <span className="font-mono">{confirmText}</span> to confirm
            </label>
            <Input id="typed-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        )}
        {children}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!!confirmText && typed !== confirmText}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
              setTyped("");
            }}
          >
            {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PageSkeleton() {
  return (
    <div aria-label="Loading" className="space-y-6">
      <div className="skeleton-block h-12 w-72" />
      <div className="skeleton-block h-28" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="skeleton-block h-80 lg:col-span-2" />
        <div className="skeleton-block h-80" />
      </div>
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export type ProgressSegment = {
  key: string;
  label: string;
  value: number;
  className: string;
};

export function ProgressBar({
  segments,
  total,
  compact = false,
  label = "Delivery progress",
}: {
  segments: ProgressSegment[];
  total: number;
  compact?: boolean;
  label?: string;
}) {
  const summary = useMemo(
    () =>
      segments
        .filter((segment) => segment.value > 0)
        .map((segment) => `${segment.label}: ${segment.value}`)
        .join(", "),
    [segments],
  );
  const safeTotal = Math.max(1, total);
  return (
    <div
      className={cn("progress-segmented", compact ? "h-1.5" : "h-3")}
      role="img"
      aria-label={`${label}. ${summary}`}
      title={summary}
    >
      {segments.map((segment) => (
        <span
          key={segment.key}
          className={segment.className}
          style={{ width: `${(segment.value / safeTotal) * 100}%` }}
        />
      ))}
    </div>
  );
}

export function compactDeliverySegments(counts: Record<DeliveryStatus, number>): ProgressSegment[] {
  return [
    { key: "DELIVERED", label: "Delivered", value: counts.DELIVERED, className: "bg-success" },
    { key: "ACCEPTED", label: "Accepted", value: counts.ACCEPTED, className: "bg-info" },
    {
      key: "IN_FLIGHT",
      label: "In flight",
      value: counts.ATTEMPTING,
      className: "bg-warning",
    },
    { key: "PENDING", label: "Pending", value: counts.PENDING, className: "bg-muted-foreground/30" },
    {
      key: "FAILED",
      label: "Failed or bounced",
      value: counts.FAILED + counts.BOUNCED + counts.COMPLAINED,
      className: "bg-destructive",
    },
    { key: "CANCELLED", label: "Cancelled", value: counts.CANCELLED, className: "bg-muted" },
  ];
}

export function PausedBanner({
  reason,
  pending,
  onResume,
}: {
  reason: PausedReason;
  pending: number;
  onResume?: () => void;
}) {
  const copy =
    reason === "USER"
      ? `You paused this campaign. ${pending} email${pending === 1 ? "" : "s"} are still pending and will send when you resume.`
      : reason === "PROVIDER"
        ? "SwiftKite paused this campaign because the email provider rejected the last send. Fix the provider setup, then resume."
        : "SwiftKite paused this campaign because the provider rate limit was reached. Wait a moment, then resume.";
  return (
    <div className="paused-banner" role="status">
      <div>
        <p className="font-medium">Paused · {PAUSED_REASON_LABELS[reason]}</p>
        <p className="mt-1">{copy}</p>
        <p className="mt-2 text-[11px] font-medium">Paused campaigns never resume automatically.</p>
      </div>
      {onResume && (
        <Button size="sm" onClick={onResume}>
          Resume
        </Button>
      )}
    </div>
  );
}

export function PlaceholderChips({
  text,
  onInsert,
}: {
  text: string;
  onInsert: (placeholder: string) => void;
}) {
  const placeholders = useMemo(() => {
    const found = new Set<string>();
    for (const match of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
      if (match[1]) found.add(match[1]);
    }
    return [...found];
  }, [text]);
  if (placeholders.length === 0) {
    return <p className="text-[11px] text-muted-foreground">Use {"{{name}}"} to personalize this field.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">Placeholders</span>
      {placeholders.map((placeholder) => (
        <button
          type="button"
          key={placeholder}
          className="placeholder-chip"
          onClick={() => onInsert(`{{${placeholder}}}`)}
        >
          {`{{${placeholder}}}`}
        </button>
      ))}
    </div>
  );
}

export function LockNote({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span aria-hidden>🔒</span>
      {children}
    </p>
  );
}

export function Ratio({ value, total }: { value: number; total: number }) {
  return (
    <span>
      {value.toLocaleString("en-US")}
      <span className="text-muted-foreground"> / {total.toLocaleString("en-US")}</span>
      {total > 0 && <span className="ml-2 text-muted-foreground">({percent(value, total)})</span>}
    </span>
  );
}

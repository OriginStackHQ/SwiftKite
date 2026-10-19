"use client";
import { useState, type ReactNode } from "react";
import Image from "next/image";
import {
  Check,
  Copy,
  Info,
  MailOpen,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden>
        <MailOpen size={16} strokeWidth={2.4} />
      </span>
      {!compact && <span className="sidebar-brand-name">NewsFlow</span>}
    </span>
  );
}
const tone: Record<string, string> = {
  Active: "success",
  Completed: "success",
  Delivered: "success",
  Verified: "success",
  Pending: "warning",
  Paused: "warning",
  Scheduled: "info",
  Sending: "info",
  Accepted: "info",
  Attempting: "info",
  Bounced: "error",
  Failed: "error",
  Complained: "complaint",
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("badge", tone[status] && `badge-${tone[status]}`)}>
      <span className="badge-dot" aria-hidden />
      {status}
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
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && (
        <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
          {children}
        </div>
      )}
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
            <div
              className={cn("metric-change", !item.good && "text-destructive")}
            >
              {item.good ? (
                <TrendingUp size={13} />
              ) : (
                <TrendingDown size={13} />
              )}
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
          <button
            className="inline-flex text-muted-foreground"
            aria-label={text}
          >
            <Info size={13} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 bg-foreground text-background">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
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
export function embedSnippet(id: string) {
  return `<form action="https://api.yourapp.com/api/v1/public/subscribe" method="POST">
  <input type="hidden" name="publicationId" value="${id}" />
  <input type="email" name="email" placeholder="you@example.com" required />
  <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off" />
  <button type="submit">Subscribe</button>
</form>`;
}
export function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <div className="absolute right-3 top-3">
        <CopyButton value={code} />
      </div>
      <pre className="code-block" aria-label="Embed form code">
        <code>{code}</code>
      </pre>
    </div>
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  action: string;
  confirmText?: string;
  onConfirm: () => void;
  destructive?: boolean;
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
            <Input
              id="typed-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}
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
export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function NewsletterPreview({
  subject,
  html,
  publication = "Tech Insights",
  image,
}: {
  subject: string;
  html: string;
  publication?: string | undefined;
  image?: string | undefined;
}) {
  return (
    <article className="newsletter">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{publication}</span>
        <span className="text-xs text-muted-foreground">October 16, 2026</span>
      </div>
      <h1>{subject || "Untitled campaign"}</h1>
      {image && (
        <Image
          src={image}
          alt="Sunlit desk with a laptop, plant and coffee"
          width={1280}
          height={768}
          loading="lazy"
        />
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <Button
        className="mt-3"
        size="sm"
        onClick={() => toast.info("You’re viewing the full demo issue")}
      >
        Read the full issue
      </Button>
      <footer>
        You are receiving this because you subscribed to {publication}.{" "}
        <a className="underline" href="/unsubscribe">
          Unsubscribe
        </a>
        <br />
        Unsubscribe link is added automatically.
      </footer>
    </article>
  );
}

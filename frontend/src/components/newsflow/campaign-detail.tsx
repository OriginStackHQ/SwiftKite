"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pause,
  Play,
  MoreHorizontal,
  RotateCcw,
  RefreshCw,
  Copy,
  ArrowLeft,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDemo } from "./store";
import {
  ConfirmDialog,
  EmptyState,
  InfoTip,
  MetricStrip,
  NewsletterPreview,
  PageHeading,
  StatusBadge,
} from "./ui";
import {
  date,
  percent,
  type Campaign,
  type RecipientStateCounts,
} from "@/data/mock";
const newCampaignId = () => `cmp_${Date.now()}`;
export const stepCampaign = (c: Campaign): Campaign => {
  if (c.status !== "Sending") return c;
  const counts = { ...c.counts };
  if (counts.Accepted > 0) {
    counts.Delivered += counts.Accepted;
    counts.Accepted = 0;
  } else if (counts.Attempting > 0) {
    counts.Accepted += counts.Attempting;
    counts.Attempting = 0;
  } else if (counts.Queued > 0) {
    const take = Math.min(3, counts.Queued);
    counts.Queued -= take;
    counts.Attempting += take;
  }
  const done = counts.Queued + counts.Attempting + counts.Accepted === 0;
  return {
    ...c,
    counts,
    delivered: counts.Delivered,
    accepted: counts.Delivered + counts.Accepted,
    status: done ? "Completed" : "Sending",
    opened: Math.floor(counts.Delivered * 0.43),
    clicked: Math.floor(counts.Delivered * 0.14),
  };
};
const explanations: Record<keyof RecipientStateCounts, string> = {
  Queued: "Waiting for the next delivery batch.",
  Attempting: "A delivery attempt is in progress.",
  Accepted: "Handed to the email provider, but not yet confirmed delivered.",
  Delivered:
    "Confirmed delivered by the provider. This does not guarantee inbox placement.",
  Bounced: "Rejected by the provider. Hard bounces are suppressed.",
  Complained: "A spam complaint was received; the subscriber is suppressed.",
  Failed: "A delivery attempt failed and can be retried.",
  Skipped: "Not eligible or excluded from sending.",
};
export function CampaignDetail({ id }: { id: string }) {
  const { campaigns, setCampaigns, publications } = useDemo();
  const campaign = campaigns.find((c) => c.id === id);
  const [playing, setPlaying] = useState(false),
    [cancel, setCancel] = useState(false),
    [initial] = useState(campaign),
    [events, setEvents] = useState([
      "Campaign created in demo workspace",
      "Recipient eligibility checked",
    ]);
  const router = useRouter();
  useEffect(() => {
    if (!playing || campaign?.status !== "Sending") return;
    const timer = setInterval(() => {
      setCampaigns((all) =>
        all.map((c) => (c.id === id ? stepCampaign(c) : c)),
      );
      setEvents((e) =>
        [...e, "Demo batch progressed without duplicate recipients"].slice(-8),
      );
    }, 2000);
    return () => clearInterval(timer);
  }, [playing, campaign?.status, id, setCampaigns]);
  if (!campaign)
    return (
      <EmptyState
        title="Campaign not found"
        text="This campaign may have been removed."
        action={
          <Button asChild>
            <Link href="/dashboard/campaigns">Back to campaigns</Link>
          </Button>
        }
      />
    );
  const c = campaign,
    pub = publications.find((p) => p.id === c.publicationId),
    counts = c.counts;
  const terminal =
    counts.Delivered +
    counts.Bounced +
    counts.Complained +
    counts.Failed +
    counts.Skipped;
  const update = (status: string) => {
    setCampaigns((all) => all.map((x) => (x.id === id ? { ...x, status } : x)));
    toast.success(`Demo campaign ${status.toLowerCase()}`);
  };
  const duplicate = () => {
    const copy = {
      ...c,
      id: newCampaignId(),
      subject: c.subject + " (copy)",
      status: "Draft",
      delivered: 0,
      accepted: 0,
      opened: 0,
      clicked: 0,
      counts: {
        Queued: 0,
        Attempting: 0,
        Accepted: 0,
        Delivered: 0,
        Bounced: 0,
        Complained: 0,
        Failed: 0,
        Skipped: 0,
      },
    };
    setCampaigns((all) => [copy, ...all]);
    router.push(`/dashboard/campaigns/new?draft=${copy.id}`);
  };
  return (
    <>
      <Link
        href="/dashboard/campaigns"
        className="mb-5 inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft size={13} />
        Back to campaigns
      </Link>
      <PageHeading
        title={c.subject}
        description={`${pub?.name} · ${date(c.date)} · ${c.recipients} recipients`}
      >
        <StatusBadge status={c.status} />
        {c.status === "Draft" && (
          <Button asChild>
            <Link href={`/dashboard/campaigns/new?draft=${id}`}>
              Edit draft
            </Link>
          </Button>
        )}
        {c.status === "Completed" && (
          <Button variant="outline" onClick={duplicate}>
            <Copy />
            Duplicate
          </Button>
        )}
        {["Sending", "Paused"].includes(c.status) && (
          <Button
            variant="outline"
            onClick={() =>
              update(c.status === "Sending" ? "Paused" : "Sending")
            }
          >
            {c.status === "Sending" ? <Pause /> : <Play />}
            {c.status === "Sending" ? "Pause" : "Resume"}
          </Button>
        )}
        {["Sending", "Paused", "Scheduled"].includes(c.status) && (
          <Button variant="outline" onClick={() => setCancel(true)}>
            Cancel
          </Button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <MoreHorizontal />
              Demo controls
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 bg-card">
            <p className="mb-3 text-xs font-semibold">
              Deterministic delivery simulation
            </p>
            <Button
              className="w-full justify-start"
              variant="ghost"
              onClick={() => {
                setPlaying(!playing);
                if (c.status === "Paused") update("Sending");
              }}
            >
              {playing ? <Pause /> : <Play />}
              {playing ? "Pause simulation" : "Play simulation"}
            </Button>
            <Button
              className="w-full justify-start"
              variant="ghost"
              onClick={() => {
                setCampaigns((all) =>
                  all.map((x) =>
                    x.id === id
                      ? {
                          ...x,
                          counts: {
                            ...x.counts,
                            Queued: x.counts.Queued + x.counts.Attempting,
                            Attempting: 0,
                          },
                        }
                      : x,
                  ),
                );
                setEvents((e) => [
                  ...e,
                  "Worker restart: attempting recipients returned to queue",
                ]);
                toast.info("Demo worker restarted. No duplicate recipients.");
              }}
            >
              <RefreshCw />
              Simulate worker restart
            </Button>
            <Button
              className="w-full justify-start"
              variant="ghost"
              onClick={() => {
                if (initial)
                  setCampaigns((all) =>
                    all.map((x) => (x.id === id ? initial : x)),
                  );
                setPlaying(false);
                setEvents(["Demo simulation reset"]);
              }}
            >
              <RotateCcw />
              Reset
            </Button>
            <p className="subtle-note mt-3">
              Updates every 2 seconds while playing. No real emails are sent.
            </p>
          </PopoverContent>
        </Popover>
      </PageHeading>
      <section className="surface p-6">
        <div className="mb-5 flex justify-between">
          <div>
            <h2 className="section-title">Delivery progress</h2>
            <p className="subtle-note mt-1">Every recipient accounted for.</p>
          </div>
          <span className="text-xl font-semibold">
            {percent(terminal, c.recipients)}
          </span>
        </div>
        <div
          className="flex h-3 overflow-hidden rounded bg-muted"
          aria-label="Delivery progress"
        >
          {(
            [
              "Delivered",
              "Accepted",
              "Attempting",
              "Queued",
              "Failed",
              "Bounced",
            ] as const
          ).map((key) => (
            <div
              key={key}
              title={`${key}: ${counts[key]}`}
              className={
                key === "Delivered"
                  ? "bg-success"
                  : key === "Accepted"
                    ? "bg-info"
                    : ["Failed", "Bounced"].includes(key)
                      ? "bg-destructive"
                      : key === "Attempting"
                        ? "bg-warning"
                        : "bg-muted"
              }
              style={{ flexGrow: counts[key], flexBasis: 0 }}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded bg-success" />
            {counts.Delivered} delivered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded bg-info" />
            {counts.Accepted} accepted
          </span>
          <span>{counts.Queued} queued</span>
          <span>{counts.Failed} failed</span>
        </div>
      </section>
      <div className="my-6 grid grid-cols-2 gap-x-6 gap-y-5 border-y py-6 md:grid-cols-4">
        {(Object.keys(explanations) as (keyof RecipientStateCounts)[]).map(
          (key) => (
            <div key={key}>
              <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                {key}
                <InfoTip text={explanations[key]} />
              </p>
              <span className="text-2xl font-semibold">{counts[key]}</span>
              <span className="ml-3 text-xs text-muted-foreground">
                {percent(counts[key], c.recipients)}
              </span>
            </div>
          ),
        )}
      </div>
      {counts.Failed > 0 && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-xs">
          <span>
            {counts.Failed} recipient failed. These can be safely retried in the
            demo.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCampaigns((all) =>
                all.map((x) =>
                  x.id === id
                    ? {
                        ...x,
                        status: "Sending",
                        counts: {
                          ...x.counts,
                          Queued: x.counts.Queued + x.counts.Failed,
                          Failed: 0,
                        },
                      }
                    : x,
                ),
              );
              setPlaying(true);
              toast.info("Failed recipients queued for demo retry");
            }}
          >
            <RefreshCw />
            Retry failed (demo)
          </Button>
        </div>
      )}
      <MetricStrip
        items={[
          { label: "Delivery rate", value: percent(c.delivered, c.recipients) },
          {
            label: "Provider accepted",
            value: percent(c.accepted, c.recipients),
            info: explanations.Accepted,
          },
          {
            label: "Est. open rate",
            value: percent(c.opened, c.delivered),
            info: "Opens are estimates, affected by privacy features.",
          },
          {
            label: "Est. click rate",
            value: percent(c.clicked, c.delivered),
            info: "Clicks may include security scanners.",
          },
        ]}
      />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="surface overflow-hidden">
          <div className="border-b p-5">
            <h2 className="section-title">Campaign preview</h2>
          </div>
          <NewsletterPreview
            subject={c.subject}
            html={c.content}
            publication={pub?.name}
          />
        </section>
        <section className="surface p-6">
          <h2 className="section-title mb-5">Event timeline</h2>
          {events.map((event, i) => (
            <div className="flex gap-3 border-l py-3 pl-4" key={i}>
              <Check size={13} className="mt-1 shrink-0 text-success" />
              <div>
                <p className="text-xs leading-5">{event}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Demo event · {i + 1}
                </p>
              </div>
            </div>
          ))}
          <p className="subtle-note mt-5">
            Accepted means handed to the email provider. Delivered means
            confirmed by the provider.
          </p>
        </section>
      </div>
      <ConfirmDialog
        open={cancel}
        onOpenChange={setCancel}
        title="Cancel campaign?"
        description="Remaining queued demo recipients will not be sent this issue."
        action="Cancel campaign"
        destructive
        onConfirm={() => update("Cancelled")}
      />
    </>
  );
}

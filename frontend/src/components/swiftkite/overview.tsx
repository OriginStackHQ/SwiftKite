"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Pause,
  Play,
  Plus,
  Send,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCampaignAction, useCampaigns } from "@/hooks/use-campaigns";
import errorHandler from "@/lib/errorHandler";
import {
  EmptyState,
  InfoTip,
  MetricStrip,
  PageHeading,
  PageSkeleton,
  ProgressBar,
  StatusBadge,
  compactDeliverySegments,
} from "./ui";
import {
  PAUSED_REASON_LABELS,
  formatDate,
  normalizeCounts,
  number,
  percent,
  sumCounts,
  type CampaignStatus,
} from "@/lib/campaign-types";
import { useAuth } from "@/lib/auth";

const DAY = 86_400_000;

export function Overview() {
  const [days, setDays] = useState(30);
  const { user } = useAuth();
  const campaignsQuery = useCampaigns();
  const resume = useCampaignAction("resume");

  const campaigns = campaignsQuery.data?.content ?? [];

  const rows = useMemo(() => {
    const cutoff = Date.now() - days * DAY;
    return campaigns.filter(
      (campaign) => new Date(campaign.createdAt).getTime() >= cutoff,
    );
  }, [campaigns, days]);

  const stats = useMemo(
    () =>
      rows.map((campaign) => ({
        campaign,
        counts: normalizeCounts(campaign.counts),
      })),
    [rows],
  );

  const sent = campaigns.filter((campaign) => campaign.status !== "DRAFT");
  const totals = useMemo(
    () =>
      stats.reduce(
        (acc, { counts }) => {
          acc.recipients += sumCounts(counts);
          acc.delivered += counts.DELIVERED;
          acc.accepted += counts.ACCEPTED;
          acc.attention += counts.FAILED + counts.BOUNCED + counts.COMPLAINED;
          return acc;
        },
        { recipients: 0, delivered: 0, accepted: 0, attention: 0 },
      ),
    [stats],
  );

  const sending = rows.find((campaign) => campaign.status === "SENDING");
  const paused = rows.filter((campaign) => campaign.status === "PAUSED");
  const attentionCampaigns = stats
    .map(({ campaign, counts }) => ({
      campaign,
      counts,
      attention: counts.FAILED + counts.BOUNCED + counts.COMPLAINED,
    }))
    .filter((item) => item.attention > 0)
    .sort((a, b) => b.attention - a.attention)
    .slice(0, 4);

  const chartData = stats
    .filter(({ campaign }) => campaign.status !== "DRAFT")
    .slice(0, 8)
    .map(({ campaign, counts }) => ({
      name:
        campaign.name.length > 18
          ? `${campaign.name.slice(0, 17)}...`
          : campaign.name,
      Delivered: counts.DELIVERED,
      Accepted: counts.ACCEPTED + counts.ATTEMPTING,
      Bounced: counts.BOUNCED + counts.COMPLAINED,
      Failed: counts.FAILED,
    }));

  const runAction = (id: string, label: string) => {
    resume.mutate(id, {
      onSuccess: () => toast.success(label),
      onError: (error) => errorHandler(error),
    });
  };

  if (campaignsQuery.isPending) return <PageSkeleton />;

  if (campaignsQuery.isError) {
    return (
      <EmptyState
        title="Could not load your campaigns"
        text="Check that the API is running, then try again."
        action={
          <Button onClick={() => campaignsQuery.refetch()}>Retry</Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeading
        title={`Good morning, ${user?.firstName || "there"}`}
        description="Here’s what’s happening with your campaigns."
      >
        <select
          className="native-select"
          aria-label="Overview date range"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        >
          {[7, 30, 90].map((value) => (
            <option key={value} value={value}>
              Last {value} days
            </option>
          ))}
        </select>
        <Button asChild>
          <Link href="/dashboard/campaigns/new">
            <Plus />
            Create campaign
          </Link>
        </Button>
      </PageHeading>

      <MetricStrip
        items={[
          {
            label: "Campaigns sent",
            value: number(sent.length),
            change: "All time",
            good: true,
            info: "Campaigns that have moved beyond Draft.",
          },
          {
            label: "Recipients reached",
            value: number(totals.recipients),
            change: "In this range",
            good: true,
            info: "One delivery record created per recipient.",
          },
          {
            label: "Delivered",
            value: percent(totals.delivered, totals.recipients),
            change: `${number(totals.delivered)} confirmed`,
            good: true,
            info: "The provider confirmed delivery. This does not guarantee inbox placement.",
          },
          {
            label: "Needs attention",
            value: number(totals.attention),
            change: "Failed, bounced or complained",
            good: false,
            info: "Deliveries that failed, bounced, or were marked as spam.",
          },
        ]}
      />

      {sending && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border bg-card px-4 py-3 text-xs">
          <Send size={15} className="text-info" />
          <span>
            <span className="font-semibold">Sending now</span> · {sending.name}
          </span>
          <span className="ml-auto text-muted-foreground">
            {normalizeCounts(sending.counts).DELIVERED} delivered
          </span>
          <Link
            href={`/dashboard/campaigns/${sending.id}`}
            className="flex items-center gap-1 text-primary"
          >
            View progress
            <ArrowRight size={13} />
          </Link>
        </div>
      )}

      <div className="my-6 grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <section className="surface chart-panel">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="section-title">Delivery outcomes by campaign</h2>
              <p className="subtle-note mt-1">
                Every recipient is accounted for.
              </p>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Last {days} days
            </span>
          </div>
          {chartData.length > 0 ? (
            <div className="chart-wrap">
              <ResponsiveContainer>
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    height={55}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: 6,
                      fontSize: 11,
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar dataKey="Delivered" stackId="outcome" fill="var(--success)" />
                  <Bar dataKey="Accepted" stackId="outcome" fill="var(--info)" />
                  <Bar dataKey="Bounced" stackId="outcome" fill="var(--warning)" />
                  <Bar
                    dataKey="Failed"
                    stackId="outcome"
                    fill="var(--error)"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="No campaigns in this range"
              text="Create a campaign or widen the date range."
            />
          )}
        </section>

        <section className="surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">Needs attention</h2>
            <InfoTip text="Paused campaigns and campaigns with failed, bounced or complained deliveries." />
          </div>
          <div className="space-y-4">
            {paused.map((campaign) => (
              <div key={campaign.id} className="border-t pt-4">
                <div className="flex items-start gap-2">
                  <Pause size={14} className="mt-0.5 text-warning" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/campaigns/${campaign.id}`}
                      className="text-xs font-medium"
                    >
                      {campaign.name}
                    </Link>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {campaign.pausedReason
                        ? PAUSED_REASON_LABELS[campaign.pausedReason]
                        : "Paused"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resume.isPending}
                    onClick={() => runAction(campaign.id, "Campaign resumed")}
                  >
                    <Play />
                    Resume
                  </Button>
                </div>
              </div>
            ))}
            {attentionCampaigns.map(({ campaign, counts, attention }) => (
              <div key={campaign.id} className="border-t pt-4">
                <div className="flex items-start gap-2">
                  <BellRing size={14} className="mt-0.5 text-warning" />
                  <div>
                    <Link
                      href={`/dashboard/campaigns/${campaign.id}`}
                      className="text-xs font-medium"
                    >
                      {campaign.name}
                    </Link>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {attention} need attention ({counts.FAILED} failed,{" "}
                      {counts.BOUNCED} bounced, {counts.COMPLAINED} complained)
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {paused.length === 0 && attentionCampaigns.length === 0 && (
              <EmptyState
                title="Nothing needs attention"
                text="Your campaigns are clear."
              />
            )}
          </div>
        </section>
      </div>

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <div>
            <h2 className="section-title">Recent campaigns</h2>
            <p className="subtle-note mt-1">Every campaign, at a glance</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/campaigns">
              All campaigns
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Progress</th>
                <th>Delivered</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stats.slice(0, 6).map(({ campaign, counts }) => (
                <tr key={campaign.id}>
                  <td>
                    <Link
                      href={`/dashboard/campaigns/${campaign.id}`}
                      className="font-medium"
                    >
                      {campaign.name}
                    </Link>
                    <p className="mt-1 max-w-64 truncate text-[10px] text-muted-foreground">
                      {campaign.subjectTemplate}
                    </p>
                  </td>
                  <td>
                    <StatusBadge
                      status={campaign.status}
                      reason={campaign.pausedReason ?? undefined}
                      info={false}
                    />
                  </td>
                  <td>{sumCounts(counts)}</td>
                  <td className="min-w-32">
                    {campaign.status === "DRAFT" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ProgressBar
                        segments={compactDeliverySegments(counts)}
                        total={sumCounts(counts)}
                        compact
                        label={`${campaign.name} progress`}
                      />
                    )}
                  </td>
                  <td>
                    {percent(counts.DELIVERED, sumCounts(counts))}
                  </td>
                  <td className="text-muted-foreground">
                    {formatDate(campaign.createdAt)}
                  </td>
                  <td>
                    <RowActions
                      id={campaign.id}
                      name={campaign.name}
                      status={campaign.status}
                      onResume={() => runAction(campaign.id, "Campaign resumed")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {stats.length === 0 && (
          <EmptyState
            title="No campaigns yet"
            text="Create your first campaign to start sending."
            action={
              <Button asChild>
                <Link href="/dashboard/campaigns/new">
                  Create campaign
                  <ArrowUpRight />
                </Link>
              </Button>
            }
          />
        )}
      </section>
    </>
  );
}

function RowActions({
  id,
  name,
  status,
  onResume,
}: {
  id: string;
  name: string;
  status: CampaignStatus;
  onResume: () => void;
}) {
  const pause = useCampaignAction("pause");
  const stop = useCampaignAction("stop");
  const run = (mutation: { mutate: (id: string, opts?: object) => void }, label: string) =>
    mutation.mutate(id, {
      onSuccess: () => toast.success(label),
      onError: (error: unknown) => errorHandler(error),
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
          ⋯
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/campaigns/${id}`}>View</Link>
        </DropdownMenuItem>
        {status === "SENDING" && (
          <>
            <DropdownMenuItem onSelect={() => run(pause, "Campaign paused")}>
              Pause
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run(stop, "Stop requested")}>
              Stop
            </DropdownMenuItem>
          </>
        )}
        {status === "PAUSED" && (
          <>
            <DropdownMenuItem onSelect={onResume}>Resume</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run(stop, "Stop requested")}>
              Stop
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

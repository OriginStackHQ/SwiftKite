"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Info, X, ArrowDownUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDemo } from "./store";
import { PublicationSelect } from "./publications";
import { EmptyState, PageHeading, StatusBadge } from "./ui";
import { GrowthChart, PerformanceChart } from "./charts";
import { date, percent } from "@/data/mock";
export function Analytics() {
  const { campaigns, publicationId } = useDemo();
  const [days, setDays] = useState(30),
    [campaign, setCampaign] = useState("all"),
    [notice, setNotice] = useState(true),
    [metric, setMetric] = useState("Open rate"),
    [sort, setSort] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-hydration read of localStorage; reading it during render would cause a hydration mismatch
    setNotice(localStorage.getItem("newsflow-analytics-dismissed") !== "true");
  }, []);
  const rows = campaigns.filter(
    (c) =>
      (publicationId === "all" || c.publicationId === publicationId) &&
      (campaign === "all" || c.id === campaign) &&
      new Date(c.date).getTime() >= Date.UTC(2026, 9, 16 - days) &&
      c.delivered > 0,
  );
  const sum = (
    key: "recipients" | "delivered" | "accepted" | "opened" | "clicked",
  ) => rows.reduce((n, c) => n + c[key], 0);
  const attempted = sum("recipients"),
    delivered = sum("delivered"),
    accepted = sum("accepted"),
    bounced = rows.reduce((n, c) => n + c.counts.Bounced, 0),
    complaints = rows.reduce((n, c) => n + c.counts.Complained, 0);
  return (
    <>
      <PageHeading
        title="Analytics"
        description="A clearer picture of what resonates."
      >
        <PublicationSelect />
        <select
          className="native-select"
          aria-label="Analytics date range"
          value={days}
          onChange={(e) => setDays(+e.target.value)}
        >
          {[7, 30, 90].map((n) => (
            <option key={n} value={n}>
              Last {n} days
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={() => toast.info("Demo analytics export prepared")}
        >
          <Download />
          Export
        </Button>
      </PageHeading>
      {notice && (
        <div className="mb-6 flex items-start gap-3 rounded-md border bg-card p-4 text-[11px] leading-6 text-muted-foreground">
          <Info size={16} className="mt-1 shrink-0 text-info" />
          <p>
            Opens are estimates and can be inflated by email privacy features.
            Clicks may include security scanners. Delivered means confirmed by
            the provider; it does not guarantee inbox placement.
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Dismiss analytics notice"
            onClick={() => {
              setNotice(false);
              localStorage.setItem("newsflow-analytics-dismissed", "true");
            }}
          >
            <X />
          </Button>
        </div>
      )}
      <div className="mb-5 flex justify-between">
        <p className="eyebrow">Delivery & list health</p>
        <select
          className="native-select"
          aria-label="Analytics campaign"
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
        >
          <option value="all">All campaigns</option>
          {campaigns
            .filter(
              (c) =>
                publicationId === "all" || c.publicationId === publicationId,
            )
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.subject}
              </option>
            ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-y-5 border-y bg-card py-6 md:grid-cols-6">
        {[
          ["Recipients attempted", attempted],
          ["Provider accepted", accepted],
          ["Delivered", delivered],
          ["Bounced", bounced],
          ["Complaints", complaints],
          ["Unsubscribes", 0],
        ].map(([label, value]) => (
          <div className="border-r px-5 last:border-0" key={label}>
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="my-6 flex flex-wrap items-center gap-10">
        <p className="eyebrow">Engagement (estimated)</p>
        <p className="text-xs text-muted-foreground">
          Opens{" "}
          <strong className="ml-3 text-xl font-semibold text-foreground">
            {percent(sum("opened"), delivered)}
          </strong>
        </p>
        <p className="text-xs text-muted-foreground">
          Clicks{" "}
          <strong className="ml-3 text-xl font-semibold text-foreground">
            {percent(sum("clicked"), delivered)}
          </strong>
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No performance data for these filters"
          text="Choose another publication, campaign or date range."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="surface chart-panel">
              <h2 className="section-title">Delivery performance</h2>
              <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
                <span>— Accepted</span>
                <span className="text-primary">— Delivered</span>
                <span className="text-destructive">— Bounced</span>
              </div>
              <PerformanceChart
                days={days}
                multiplier={publicationId === "all" ? 1 : 0.34}
              />
            </section>
            <section className="surface chart-panel">
              <h2 className="section-title">Subscriber growth</h2>
              <p className="subtle-note mt-2">
                Total and new subscribers over time
              </p>
              <GrowthChart
                days={days}
                multiplier={publicationId === "all" ? 1 : 0.34}
              />
            </section>
            <section className="surface chart-panel">
              <h2 className="section-title">Campaign engagement</h2>
              <div className="mt-2 flex gap-4 text-[10px]">
                <span className="text-primary">■ Est. opens</span>
                <span className="text-success">■ Est. clicks</span>
              </div>
              <PerformanceChart days={days} kind="engagement" />
            </section>
            <section className="surface p-6">
              <div className="mb-7 flex items-center justify-between">
                <h2 className="section-title">Top-performing campaigns</h2>
                <select
                  className="native-select"
                  aria-label="Top campaigns metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  {["Open rate", "Click rate", "Delivery rate"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              {[...rows]
                .sort((a, b) =>
                  metric === "Open rate"
                    ? b.opened / b.delivered - a.opened / a.delivered
                    : metric === "Click rate"
                      ? b.clicked / b.delivered - a.clicked / a.delivered
                      : b.delivered / b.recipients - a.delivered / a.recipients,
                )
                .slice(0, 5)
                .map((c) => {
                  const val =
                    metric === "Open rate"
                      ? c.opened / c.delivered
                      : metric === "Click rate"
                        ? c.clicked / c.delivered
                        : c.delivered / c.recipients;
                  return (
                    <div className="mb-5" key={c.id}>
                      <div className="mb-2 flex justify-between gap-3 text-xs">
                        <span className="truncate">{c.subject}</span>
                        <strong>{(val * 100).toFixed(1)}%</strong>
                      </div>
                      <progress
                        max={1}
                        value={val}
                        aria-label={`${c.subject} ${metric}`}
                        className="h-2 w-full accent-primary"
                      />
                    </div>
                  );
                })}
            </section>
          </div>
          <section className="my-7 grid gap-8 border-y py-6 md:grid-cols-[1fr_1fr_1fr]">
            <div>
              <h2 className="section-title">List health</h2>
              <p className="subtle-note mt-2">
                Healthy lists start with clear consent.
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Bounce rate{" "}
                <strong className="float-right text-foreground">
                  {percent(bounced, attempted)}
                </strong>
              </p>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded">
                <span className="w-2/3 bg-success" />
                <span className="w-1/6 bg-warning" />
                <span className="w-1/6 bg-destructive" />
              </div>
              <p className="subtle-note mt-2">
                Aim for under 2%. Above 5% needs attention.
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Complaint rate{" "}
                <strong className="float-right text-foreground">
                  {percent(complaints, attempted)}
                </strong>
              </p>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded">
                <span className="w-3/4 bg-success" />
                <span className="w-1/4 bg-warning" />
              </div>
              <p className="subtle-note mt-2">Keep complaints below 0.1%.</p>
            </div>
          </section>
          <section className="surface overflow-hidden">
            <div className="p-5">
              <h2 className="section-title">Campaign performance</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <button
                        className="flex gap-2"
                        onClick={() => setSort(!sort)}
                      >
                        Campaign
                        <ArrowDownUp size={12} />
                      </button>
                    </th>
                    <th>Date</th>
                    <th>Recipients</th>
                    <th>Delivery</th>
                    <th>Est. opens</th>
                    <th>Est. clicks</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows]
                    .sort((a, b) =>
                      sort
                        ? a.subject.localeCompare(b.subject)
                        : b.date.localeCompare(a.date),
                    )
                    .map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link
                            className="font-medium"
                            href={`/dashboard/campaigns/${c.id}`}
                          >
                            {c.subject}
                          </Link>
                        </td>
                        <td className="text-muted-foreground">
                          {date(c.date)}
                        </td>
                        <td>{c.recipients}</td>
                        <td>{percent(c.delivered, c.recipients)}</td>
                        <td>{percent(c.opened, c.delivered)}</td>
                        <td>{percent(c.clicked, c.delivered)}</td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

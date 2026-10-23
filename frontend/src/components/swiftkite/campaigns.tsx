"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MoreHorizontal, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCampaignAction,
  useCampaigns,
  useDeleteCampaign,
  useDuplicateCampaign,
} from "@/hooks/use-campaigns";
import {
  ConfirmDialog,
  EmptyState,
  PageHeading,
  PageSkeleton,
  ProgressBar,
  StatusBadge,
  compactDeliverySegments,
} from "./ui";
import {
  CAMPAIGN_STATUS_LABELS,
  formatDate,
  normalizeCounts,
  sumCounts,
  type CampaignStatus,
  type CampaignSummary,
} from "@/lib/campaign-types";
import errorHandler from "@/lib/errorHandler";

const filters: Array<"ALL" | CampaignStatus> = [
  "ALL",
  "DRAFT",
  "SENDING",
  "PAUSED",
  "STOPPING",
  "STOPPED",
  "COMPLETED",
];

export function Campaigns() {
  const campaignsQuery = useCampaigns();
  const pause = useCampaignAction("pause");
  const resume = useCampaignAction("resume");
  const stop = useCampaignAction("stop");
  const remove = useDeleteCampaign();
  const duplicate = useDuplicateCampaign();
  const router = useRouter();

  const campaigns = campaignsQuery.data?.content ?? [];
  const [status, setStatus] = useState<"ALL" | CampaignStatus>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Newest");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [deleting, setDeleting] = useState<CampaignSummary | null>(null);

  const filtered = useMemo(() => {
    return campaigns
      .filter((campaign) => status === "ALL" || campaign.status === status)
      .filter((campaign) => {
        const needle = search.trim().toLowerCase();
        return (
          !needle ||
          campaign.name.toLowerCase().includes(needle) ||
          campaign.subjectTemplate.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        if (sort === "Name") return a.name.localeCompare(b.name);
        if (sort === "Oldest") return a.createdAt.localeCompare(b.createdAt);
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [campaigns, status, search, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const active = Math.min(page, pages);
  const rows = filtered.slice((active - 1) * size, active * size);

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: campaigns.length };
    for (const campaign of campaigns) {
      result[campaign.status] = (result[campaign.status] ?? 0) + 1;
    }
    return result;
  }, [campaigns]);

  const run = (
    mutation: { mutate: (id: string, options?: object) => void },
    id: string,
    label: string,
  ) =>
    mutation.mutate(id, {
      onSuccess: () => toast.success(label),
      onError: (error: unknown) => errorHandler(error),
    });

  const duplicateCampaign = (campaign: CampaignSummary) =>
    duplicate.mutate(campaign.id, {
      onSuccess: (created) => {
        toast.success("Campaign duplicated as a draft");
        router.push(`/dashboard/campaigns/${created.id}`);
      },
      onError: (error) => errorHandler(error),
    });

  const requestDelete = (campaign: CampaignSummary) => {
    if (!["DRAFT", "COMPLETED", "STOPPED"].includes(campaign.status)) {
      toast.error("Stop the campaign first.");
      return;
    }
    setDeleting(campaign);
  };

  if (campaignsQuery.isPending) return <PageSkeleton />;

  if (campaignsQuery.isError) {
    return (
      <EmptyState
        title="Could not load campaigns"
        text="Check that the API is running, then try again."
        action={<Button onClick={() => campaignsQuery.refetch()}>Retry</Button>}
      />
    );
  }

  return (
    <>
      <PageHeading
        title="Campaigns"
        description="Create, send and track email campaigns."
      >
        <Button asChild>
          <Link href="/dashboard/campaigns/new">
            <Plus />
            Create campaign
          </Link>
        </Button>
      </PageHeading>

      <div className="tab-row" aria-label="Filter campaigns by status">
        {filters.map((item) => (
          <Button
            variant="ghost"
            className={status === item ? "active" : ""}
            key={item}
            onClick={() => {
              setStatus(item);
              setPage(1);
            }}
          >
            {item === "ALL" ? "All" : CAMPAIGN_STATUS_LABELS[item]}
            <span className="ml-1 rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
              {counts[item] ?? 0}
            </span>
          </Button>
        ))}
      </div>

      <div className="filter-toolbar">
        <div className="relative mr-auto w-full max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-2.5 text-muted-foreground"
          />
          <Input
            aria-label="Search campaigns"
            placeholder="Search campaigns..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <select
          className="native-select"
          aria-label="Sort campaigns"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          {["Newest", "Oldest", "Name"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>

      <section className="surface overflow-hidden">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Progress</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((campaign) => {
                const statusCounts = normalizeCounts(campaign.counts);
                const total = sumCounts(statusCounts);
                return (
                  <tr key={campaign.id}>
                    <td>
                      <Link
                        href={`/dashboard/campaigns/${campaign.id}`}
                        className="font-medium"
                      >
                        {campaign.name}
                      </Link>
                      <p className="mt-1 max-w-72 truncate text-[10px] text-muted-foreground">
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
                    <td>{total}</td>
                    <td className="min-w-36">
                      {campaign.status === "DRAFT" ? (
                        <span className="text-muted-foreground">Not sent</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <ProgressBar
                            segments={compactDeliverySegments(statusCounts)}
                            total={total}
                            compact
                            label={`${campaign.name} progress`}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {total}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="text-muted-foreground">
                      {formatDate(campaign.createdAt)}
                    </td>
                    <td>
                      <RowActions
                        campaign={campaign}
                        busy={duplicate.isPending}
                        onPause={() => run(pause, campaign.id, "Campaign paused")}
                        onResume={() =>
                          run(resume, campaign.id, "Campaign resumed")
                        }
                        onStop={() => run(stop, campaign.id, "Stop requested")}
                        onDuplicate={() => duplicateCampaign(campaign)}
                        onDelete={() => requestDelete(campaign)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <EmptyState
            title={search ? "No matching campaigns" : "Create your first campaign"}
            text={
              search
                ? "Try another search or status filter."
                : "Write a template, add recipients, and send when you are ready."
            }
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

        <div className="table-footer">
          <span>{filtered.length} campaigns</span>
          <div className="flex items-center gap-3">
            <select
              className="native-select"
              aria-label="Campaign rows per page"
              value={size}
              onChange={(event) => {
                setSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={active === 1}
              onClick={() => setPage(active - 1)}
            >
              Previous
            </Button>
            <span>
              {active}/{pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={active === pages}
              onClick={() => setPage(active + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this campaign?"
        description="This permanently deletes the campaign, its recipients and all delivery records. This cannot be undone."
        action="Delete campaign"
        destructive
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Campaign deleted");
              setDeleting(null);
            },
            onError: (error) => errorHandler(error),
          });
        }}
      />
    </>
  );
}

function RowActions({
  campaign,
  busy,
  onPause,
  onResume,
  onStop,
  onDuplicate,
  onDelete,
}: {
  campaign: CampaignSummary;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const editable = campaign.status === "DRAFT";
  const deletable = ["DRAFT", "COMPLETED", "STOPPED"].includes(campaign.status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${campaign.name}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/campaigns/${campaign.id}`}>
            {editable ? "Edit draft" : "View progress"}
          </Link>
        </DropdownMenuItem>
        {campaign.status === "SENDING" && (
          <>
            <DropdownMenuItem onSelect={onPause}>Pause</DropdownMenuItem>
            <DropdownMenuItem onSelect={onStop}>Stop</DropdownMenuItem>
          </>
        )}
        {campaign.status === "PAUSED" && (
          <>
            <DropdownMenuItem onSelect={onResume}>Resume</DropdownMenuItem>
            <DropdownMenuItem onSelect={onStop}>Stop</DropdownMenuItem>
          </>
        )}
        {campaign.status === "STOPPING" && (
          <DropdownMenuItem disabled>Stopping...</DropdownMenuItem>
        )}
        {(campaign.status === "STOPPED" || campaign.status === "COMPLETED") && (
          <DropdownMenuItem disabled={busy} onSelect={onDuplicate}>
            Duplicate
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {deletable ? (
          <DropdownMenuItem className="text-destructive" onSelect={onDelete}>
            Delete
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled title="Stop the campaign first.">
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

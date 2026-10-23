/** API types mirroring the Spring Boot campaign/recipient/delivery DTOs. */

export type CampaignStatus =
  | "DRAFT"
  | "SENDING"
  | "PAUSED"
  | "STOPPING"
  | "STOPPED"
  | "COMPLETED";

export type PausedReason = "USER" | "PROVIDER" | "RATE_LIMITED";

export type DeliveryStatus =
  | "PENDING"
  | "ATTEMPTING"
  | "ACCEPTED"
  | "FAILED"
  | "DELIVERED"
  | "BOUNCED"
  | "COMPLAINED"
  | "CANCELLED";

export type FailureCode = "PROVIDER_REJECTED" | "OUTCOME_UNKNOWN";

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type CampaignSummary = {
  id: string;
  name: string;
  subjectTemplate: string;
  fromEmail: string;
  fromName: string;
  status: CampaignStatus;
  pausedReason: PausedReason | null;
  createdAt: string;
  updatedAt: string;
  counts: Record<string, number>;
};

/** Raw campaign body returned by create/update/pause/resume/stop. */
export type CampaignResponse = {
  id: string;
  name: string;
  subjectTemplate: string;
  previewText: string | null;
  bodyTemplate: string;
  fromEmail: string;
  fromName: string;
  status: CampaignStatus;
  pausedReason: PausedReason | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignDetail = CampaignResponse & {
  counts: Record<string, number>;
};

export type CampaignWrite = {
  name: string;
  subjectTemplate: string;
  previewText?: string | null;
  bodyTemplate: string;
  fromName: string;
};

/** Default sender the editor starts from (GET /api/campaigns/defaults). */
export type CampaignDefaults = {
  fromEmail: string;
  fromName: string;
};

export type Recipient = {
  id: string;
  email: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export type RecipientInput = {
  email: string;
  data?: Record<string, unknown>;
};

export type AddRecipientsResponse = {
  inserted: number;
  skipped: number;
};

/** Result of a bulk recipient-field edit (rename / remove). */
export type FieldUpdateResponse = {
  updated: number;
};

export type Delivery = {
  id: string;
  recipientId: string;
  email: string;
  status: DeliveryStatus;
  failureCode: FailureCode | null;
  providerMessageId: string | null;
  detail: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PreviewResponse = {
  subject: string;
  body: string;
};

export type SendCampaignResponse = {
  id: string;
  status: CampaignStatus;
  recipients: number;
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Draft",
  SENDING: "Sending",
  PAUSED: "Paused",
  STOPPING: "Stopping",
  STOPPED: "Stopped",
  COMPLETED: "Completed",
};

export const PAUSED_REASON_LABELS: Record<PausedReason, string> = {
  USER: "Paused by you",
  PROVIDER: "Provider error",
  RATE_LIMITED: "Rate limited",
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: "Pending",
  ATTEMPTING: "Attempting",
  ACCEPTED: "Accepted",
  FAILED: "Failed",
  DELIVERED: "Delivered",
  BOUNCED: "Bounced",
  COMPLAINED: "Complained",
  CANCELLED: "Cancelled",
};

export const FAILURE_CODE_LABELS: Record<FailureCode, string> = {
  PROVIDER_REJECTED: "Rejected by provider",
  OUTCOME_UNKNOWN: "Unknown outcome",
};

export const CAMPAIGN_STATUS_INFO: Record<CampaignStatus, string> = {
  DRAFT: "Editable. No emails created yet.",
  SENDING: "Workers are sending emails now.",
  PAUSED: "Sending is stopped. Waiting for you to resume.",
  STOPPING: "Stop requested. Waiting for in-flight emails to finish.",
  STOPPED: "Permanently stopped. Unsent emails were cancelled.",
  COMPLETED: "Nothing left to send. Some emails may still have failed or bounced.",
};

export const DELIVERY_STATUS_INFO: Record<DeliveryStatus, string> = {
  PENDING: "Waiting to be picked up by a worker.",
  ATTEMPTING: "A worker is sending this email right now.",
  ACCEPTED: "Handed to the email provider. Not yet confirmed delivered.",
  DELIVERED: "Provider confirmed delivery.",
  FAILED: "Not sent. Check the failure code for the reason.",
  BOUNCED: "The recipient's server rejected it.",
  COMPLAINED: "The recipient marked it as spam.",
  CANCELLED: "The campaign was stopped before this email was sent.",
};

const DELIVERY_STATUS_ORDER: DeliveryStatus[] = [
  "DELIVERED",
  "ACCEPTED",
  "ATTEMPTING",
  "PENDING",
  "FAILED",
  "BOUNCED",
  "COMPLAINED",
  "CANCELLED",
];

export const DELIVERY_STATUSES = DELIVERY_STATUS_ORDER;

export const isTerminal = (status: DeliveryStatus) =>
  ["DELIVERED", "FAILED", "BOUNCED", "COMPLAINED", "CANCELLED"].includes(status);

export const number = (value: number) => value.toLocaleString("en-US");

export const percent = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "—";

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const ZERO_COUNTS: Record<DeliveryStatus, number> = {
  PENDING: 0,
  ATTEMPTING: 0,
  ACCEPTED: 0,
  FAILED: 0,
  DELIVERED: 0,
  BOUNCED: 0,
  COMPLAINED: 0,
  CANCELLED: 0,
};

/** Turns the API's status-name map into a fully populated status → count map. */
export function normalizeCounts(
  counts: Record<string, number> | undefined | null,
): Record<DeliveryStatus, number> {
  const result = { ...ZERO_COUNTS };
  if (!counts) return result;
  for (const [key, value] of Object.entries(counts)) {
    if (key in result) result[key as DeliveryStatus] = value;
  }
  return result;
}

export function sumCounts(counts: Record<string, number> | undefined | null) {
  if (!counts) return 0;
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

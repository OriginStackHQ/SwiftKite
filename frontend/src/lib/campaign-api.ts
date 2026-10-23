import axiosInstance from "./axiosInstance";
import type {
  AddRecipientsResponse,
  CampaignDefaults,
  CampaignDetail,
  CampaignResponse,
  CampaignSummary,
  CampaignWrite,
  Delivery,
  DeliveryStatus,
  FieldUpdateResponse,
  PageResponse,
  PreviewResponse,
  Recipient,
  RecipientInput,
  SendCampaignResponse,
} from "./campaign-types";

const base = (campaignId: string) => `/api/campaigns/${campaignId}`;

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                  */
/* -------------------------------------------------------------------------- */

export async function listCampaignsRequest(page = 0, size = 100) {
  const { data } = await axiosInstance.get<PageResponse<CampaignSummary>>(
    "/api/campaigns",
    { params: { page, size } },
  );
  return data;
}

export async function getCampaignRequest(id: string) {
  const { data } = await axiosInstance.get<CampaignDetail>(`/api/campaigns/${id}`);
  return data;
}

export async function getCampaignDefaultsRequest() {
  const { data } = await axiosInstance.get<CampaignDefaults>(
    "/api/campaigns/defaults",
  );
  return data;
}

export async function createCampaignRequest(payload: CampaignWrite) {
  const { data } = await axiosInstance.post<CampaignResponse>(
    "/api/campaigns",
    payload,
  );
  return data;
}

export async function updateCampaignRequest(id: string, payload: CampaignWrite) {
  const { data } = await axiosInstance.put<CampaignResponse>(
    `/api/campaigns/${id}`,
    payload,
  );
  return data;
}

export async function deleteCampaignRequest(id: string) {
  await axiosInstance.delete(`/api/campaigns/${id}`);
}

export async function sendCampaignRequest(id: string) {
  const { data } = await axiosInstance.post<SendCampaignResponse>(
    `/api/campaigns/${id}/send`,
  );
  return data;
}

export async function pauseCampaignRequest(id: string) {
  const { data } = await axiosInstance.post<CampaignResponse>(
    `/api/campaigns/${id}/pause`,
  );
  return data;
}

export async function resumeCampaignRequest(id: string) {
  const { data } = await axiosInstance.post<CampaignResponse>(
    `/api/campaigns/${id}/resume`,
  );
  return data;
}

export async function stopCampaignRequest(id: string) {
  const { data } = await axiosInstance.post<CampaignResponse>(
    `/api/campaigns/${id}/stop`,
  );
  return data;
}

/**
 * No backend duplicate endpoint exists: read the source, create a draft copy and
 * copy its recipients across (batched to the 500-per-call limit).
 */
export async function duplicateCampaignRequest(id: string) {
  const detail = await getCampaignRequest(id);
  const created = await createCampaignRequest({
    name: `${detail.name} (copy)`,
    subjectTemplate: detail.subjectTemplate,
    previewText: detail.previewText,
    bodyTemplate: detail.bodyTemplate,
    fromName: detail.fromName,
  });

  const recipients = await listAllRecipientsRequest(id);
  for (let index = 0; index < recipients.length; index += 500) {
    await addRecipientsRequest(
      created.id,
      recipients.slice(index, index + 500).map((recipient) => ({
        email: recipient.email,
        data: recipient.data,
      })),
    );
  }

  return created;
}

/* -------------------------------------------------------------------------- */
/* Recipients                                                                 */
/* -------------------------------------------------------------------------- */

export async function listRecipientsRequest(
  campaignId: string,
  page = 0,
  size = 100,
) {
  const { data } = await axiosInstance.get<PageResponse<Recipient>>(
    `${base(campaignId)}/recipients`,
    { params: { page, size } },
  );
  return data;
}

/** Pages through the size-100 cap so the editor can see every recipient. */
export async function listAllRecipientsRequest(campaignId: string) {
  const recipients: Recipient[] = [];
  let page = 0;
  for (;;) {
    const chunk = await listRecipientsRequest(campaignId, page, 100);
    recipients.push(...chunk.content);
    if (page + 1 >= chunk.totalPages || chunk.content.length === 0) break;
    page += 1;
  }
  return recipients;
}

export async function addRecipientsRequest(
  campaignId: string,
  recipients: RecipientInput[],
) {
  const { data } = await axiosInstance.post<AddRecipientsResponse>(
    `${base(campaignId)}/recipients`,
    { recipients },
  );
  return data;
}

export async function renameRecipientFieldRequest(
  campaignId: string,
  payload: { from: string; to: string; overwrite?: boolean },
) {
  const { data } = await axiosInstance.post<FieldUpdateResponse>(
    `${base(campaignId)}/recipients/fields/rename`,
    payload,
  );
  return data;
}

export async function removeRecipientFieldsRequest(
  campaignId: string,
  keys: string[],
) {
  const { data } = await axiosInstance.post<FieldUpdateResponse>(
    `${base(campaignId)}/recipients/fields/remove`,
    { keys },
  );
  return data;
}

export async function updateRecipientRequest(
  campaignId: string,
  recipientId: string,
  payload: { email: string; data: Record<string, unknown> },
) {
  const { data } = await axiosInstance.put<Recipient>(
    `${base(campaignId)}/recipients/${recipientId}`,
    payload,
  );
  return data;
}

export async function deleteRecipientRequest(
  campaignId: string,
  recipientId: string,
) {
  await axiosInstance.delete(`${base(campaignId)}/recipients/${recipientId}`);
}

export async function previewRequest(
  campaignId: string,
  body: { email?: string; data?: Record<string, unknown> },
) {
  const { data } = await axiosInstance.post<PreviewResponse>(
    `${base(campaignId)}/preview`,
    body,
  );
  return data;
}

/* -------------------------------------------------------------------------- */
/* Deliveries                                                                 */
/* -------------------------------------------------------------------------- */

export async function listDeliveriesRequest(
  campaignId: string,
  params: { status?: DeliveryStatus; page?: number; size?: number } = {},
) {
  const { data } = await axiosInstance.get<PageResponse<Delivery>>(
    `${base(campaignId)}/deliveries`,
    { params },
  );
  return data;
}

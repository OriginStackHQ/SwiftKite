"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addRecipientsRequest,
  createCampaignRequest,
  deleteCampaignRequest,
  deleteRecipientRequest,
  duplicateCampaignRequest,
  getCampaignRequest,
  getCampaignDefaultsRequest,
  listAllRecipientsRequest,
  listCampaignsRequest,
  listDeliveriesRequest,
  pauseCampaignRequest,
  previewRequest,
  removeRecipientFieldsRequest,
  renameRecipientFieldRequest,
  resumeCampaignRequest,
  sendCampaignRequest,
  stopCampaignRequest,
  updateCampaignRequest,
  updateRecipientRequest,
} from "@/lib/campaign-api";
import type {
  CampaignWrite,
  DeliveryStatus,
  RecipientInput,
} from "@/lib/campaign-types";
import { campaignKeys } from "@/lib/query-keys";

const POLLING_STATUSES = new Set(["SENDING", "STOPPING"]);
const POLL_INTERVAL = 2500;

export function useCampaigns() {
  return useQuery({
    queryKey: campaignKeys.list(),
    queryFn: () => listCampaignsRequest(0, 100),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => getCampaignRequest(id),
    enabled: !!id,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && POLLING_STATUSES.has(status) ? POLL_INTERVAL : false;
    },
  });
}

/** Default sender from the backend env; used to pre-fill the create form. */
export function useCampaignDefaults() {
  return useQuery({
    queryKey: campaignKeys.defaults(),
    queryFn: getCampaignDefaultsRequest,
    staleTime: Infinity,
    retry: false,
  });
}

export function useRecipients(id: string, enabled = true) {
  return useQuery({
    queryKey: campaignKeys.recipients(id),
    queryFn: () => listAllRecipientsRequest(id),
    enabled: !!id && enabled,
  });
}

export function useDeliveries(
  id: string,
  status: DeliveryStatus | "ALL",
  page = 0,
  size = 20,
  poll = false,
) {
  return useQuery({
    queryKey: campaignKeys.deliveries(id, status, page),
    queryFn: () =>
      listDeliveriesRequest(id, {
        ...(status === "ALL" ? {} : { status }),
        page,
        size,
      }),
    enabled: !!id,
    refetchInterval: poll ? POLL_INTERVAL : false,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CampaignWrite) => createCampaignRequest(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useUpdateCampaign(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CampaignWrite) => updateCampaignRequest(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCampaignRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useDuplicateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateCampaignRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useSendCampaign(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sendCampaignRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useCampaignAction(action: "pause" | "resume" | "stop") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      action === "pause"
        ? pauseCampaignRequest(id)
        : action === "resume"
          ? resumeCampaignRequest(id)
          : stopCampaignRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useAddRecipients(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipients: RecipientInput[]) =>
      addRecipientsRequest(id, recipients),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.recipients(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
    },
  });
}

export function useRenameRecipientField(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { from: string; to: string; overwrite?: boolean }) =>
      renameRecipientFieldRequest(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.recipients(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
    },
  });
}

export function useRemoveRecipientFields(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keys: string[]) => removeRecipientFieldsRequest(id, keys),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.recipients(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
    },
  });
}

export function useUpdateRecipient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      recipientId: string;
      email: string;
      data: Record<string, unknown>;
    }) => updateRecipientRequest(id, vars.recipientId, {
      email: vars.email,
      data: vars.data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.recipients(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
    },
  });
}

export function useDeleteRecipient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipientId: string) => deleteRecipientRequest(id, recipientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignKeys.recipients(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: campaignKeys.list() });
    },
  });
}

export function usePreview(id: string) {
  return useMutation({
    mutationFn: (body: { email?: string; data?: Record<string, unknown> }) =>
      previewRequest(id, body),
  });
}

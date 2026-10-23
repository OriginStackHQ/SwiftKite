package com.swiftkite.services.interfaces;

import com.swiftkite.dto.campaign.CampaignDefaultsResponse;
import com.swiftkite.dto.campaign.CampaignDetailResponse;
import com.swiftkite.dto.campaign.CampaignResponse;
import com.swiftkite.dto.campaign.CampaignSummaryResponse;
import com.swiftkite.dto.campaign.CreateCampaignRequest;
import com.swiftkite.dto.campaign.SendCampaignResponse;
import com.swiftkite.dto.campaign.UpdateCampaignRequest;
import com.swiftkite.dto.common.PageResponse;
import jakarta.validation.Valid;
import java.util.UUID;

public interface ICampaignService {
    CampaignResponse create(UUID userId, @Valid CreateCampaignRequest request);

    /** Default sender the editor starts from; not campaign specific. */
    CampaignDefaultsResponse defaults();

    PageResponse<CampaignSummaryResponse> list(UUID userId, int page, int size);

    CampaignDetailResponse get(UUID userId, UUID campaignId);

    CampaignResponse update(
            UUID userId, UUID campaignId, @Valid UpdateCampaignRequest request);

    SendCampaignResponse send(UUID userId, UUID campaignId);

    CampaignResponse pause(UUID userId, UUID campaignId);

    CampaignResponse resume(UUID userId, UUID campaignId);

    CampaignResponse stop(UUID userId, UUID campaignId);

    void delete(UUID userId, UUID campaignId);
}

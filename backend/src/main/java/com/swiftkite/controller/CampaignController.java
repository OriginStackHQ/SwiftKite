package com.swiftkite.controller;

import com.swiftkite.dto.campaign.CampaignDefaultsResponse;
import com.swiftkite.dto.campaign.CampaignDetailResponse;
import com.swiftkite.dto.campaign.CampaignResponse;
import com.swiftkite.dto.campaign.CampaignSummaryResponse;
import com.swiftkite.dto.campaign.CreateCampaignRequest;
import com.swiftkite.dto.campaign.SendCampaignResponse;
import com.swiftkite.dto.campaign.UpdateCampaignRequest;
import com.swiftkite.dto.common.PageResponse;
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.services.interfaces.ICampaignService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/campaigns")
public class CampaignController {

    private final ICampaignService campaignService;

    public CampaignController(ICampaignService campaignService) {
        this.campaignService = campaignService;
    }

    @PostMapping
    public ResponseEntity<CampaignResponse> create(
            @AuthenticationPrincipal ApplicationUser user,
            @Valid @RequestBody CreateCampaignRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(campaignService.create(user.getId(), request));
    }

    @GetMapping
    public PageResponse<CampaignSummaryResponse> list(
            @AuthenticationPrincipal ApplicationUser user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return campaignService.list(user.getId(), page, size);
    }

    /** Literal path, so it wins over {@code /{id}} for the editor's sender default. */
    @GetMapping("/defaults")
    public CampaignDefaultsResponse defaults() {
        return campaignService.defaults();
    }

    @GetMapping("/{id}")
    public CampaignDetailResponse get(
            @AuthenticationPrincipal ApplicationUser user, @PathVariable UUID id) {
        return campaignService.get(user.getId(), id);
    }

    @PutMapping("/{id}")
    public CampaignResponse update(
            @AuthenticationPrincipal ApplicationUser user,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateCampaignRequest request) {
        return campaignService.update(user.getId(), id, request);
    }

    @PostMapping("/{id}/send")
    public ResponseEntity<SendCampaignResponse> send(
            @AuthenticationPrincipal ApplicationUser user, @PathVariable UUID id) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(campaignService.send(user.getId(), id));
    }

    @PostMapping("/{id}/pause")
    public CampaignResponse pause(
            @AuthenticationPrincipal ApplicationUser user, @PathVariable UUID id) {
        return campaignService.pause(user.getId(), id);
    }

    @PostMapping("/{id}/resume")
    public CampaignResponse resume(
            @AuthenticationPrincipal ApplicationUser user, @PathVariable UUID id) {
        return campaignService.resume(user.getId(), id);
    }

    @PostMapping("/{id}/stop")
    public CampaignResponse stop(
            @AuthenticationPrincipal ApplicationUser user, @PathVariable UUID id) {
        return campaignService.stop(user.getId(), id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal ApplicationUser user, @PathVariable UUID id) {
        campaignService.delete(user.getId(), id);
        return ResponseEntity.noContent().build();
    }
}

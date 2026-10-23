package com.swiftkite.controller;

import com.swiftkite.dto.common.PageResponse;
import com.swiftkite.dto.delivery.DeliveryResponse;
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.enums.DeliveryStatus;
import com.swiftkite.services.interfaces.IDeliveryService;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/campaigns/{campaignId}/deliveries")
public class DeliveryController {

    private final IDeliveryService deliveryService;

    public DeliveryController(IDeliveryService deliveryService) {
        this.deliveryService = deliveryService;
    }

    @GetMapping
    public PageResponse<DeliveryResponse> list(
            @AuthenticationPrincipal ApplicationUser user,
            @PathVariable UUID campaignId,
            @RequestParam(required = false) DeliveryStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return deliveryService.list(user.getId(), campaignId, status, page, size);
    }
}

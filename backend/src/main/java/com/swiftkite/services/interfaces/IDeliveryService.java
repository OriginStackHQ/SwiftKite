package com.swiftkite.services.interfaces;

import com.swiftkite.dto.common.PageResponse;
import com.swiftkite.dto.delivery.DeliveryResponse;
import com.swiftkite.enums.DeliveryStatus;
import java.util.UUID;

public interface IDeliveryService {
    PageResponse<DeliveryResponse> list(
            UUID userId, UUID campaignId, DeliveryStatus status, int page, int size);
}

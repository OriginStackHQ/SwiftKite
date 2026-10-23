package com.swiftkite.services.implementation;

import com.swiftkite.dto.common.PageResponse;
import com.swiftkite.dto.delivery.DeliveryResponse;
import com.swiftkite.entity.NotificationDelivery;
import com.swiftkite.enums.DeliveryStatus;
import com.swiftkite.exception.NotFoundException;
import com.swiftkite.repository.CampaignRepository;
import com.swiftkite.repository.NotificationDeliveryRepository;
import com.swiftkite.services.interfaces.IDeliveryService;
import com.swiftkite.util.Pagination;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class DeliveryService implements IDeliveryService {

    private final CampaignRepository campaignRepository;
    private final NotificationDeliveryRepository deliveryRepository;

    public DeliveryService(
            CampaignRepository campaignRepository,
            NotificationDeliveryRepository deliveryRepository) {
        this.campaignRepository = campaignRepository;
        this.deliveryRepository = deliveryRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<DeliveryResponse> list(
            UUID userId, UUID campaignId, DeliveryStatus status, int page, int size) {
        campaignRepository
                .findByIdAndUserId(campaignId, userId)
                .orElseThrow(() -> new NotFoundException("Campaign not found."));

        PageRequest pageable = Pagination.of(
                page, size, Sort.by(Sort.Direction.ASC, "createdAt", "id"));
        Page<NotificationDelivery> deliveries = status == null
                ? deliveryRepository.findByCampaignId(campaignId, pageable)
                : deliveryRepository.findByCampaignIdAndStatus(campaignId, status, pageable);
        return PageResponse.from(deliveries.map(this::toResponse));
    }

    private DeliveryResponse toResponse(NotificationDelivery delivery) {
        return new DeliveryResponse(
                delivery.getId(),
                delivery.getRecipientId(),
                delivery.getEmail(),
                delivery.getStatus(),
                delivery.getFailureCode(),
                delivery.getProviderMessageId(),
                delivery.getDetail(),
                delivery.getAcceptedAt(),
                delivery.getCreatedAt(),
                delivery.getUpdatedAt());
    }
}

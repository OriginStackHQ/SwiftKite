package com.swiftkite.services.implementation;

import com.swiftkite.dto.common.PageResponse;
import com.swiftkite.dto.recipient.AddRecipientsRequest;
import com.swiftkite.dto.recipient.AddRecipientsResponse;
import com.swiftkite.dto.recipient.FieldUpdateResponse;
import com.swiftkite.dto.recipient.PreviewRequest;
import com.swiftkite.dto.recipient.PreviewResponse;
import com.swiftkite.dto.recipient.RecipientResponse;
import com.swiftkite.dto.recipient.RemoveRecipientFieldsRequest;
import com.swiftkite.dto.recipient.RenameRecipientFieldRequest;
import com.swiftkite.dto.recipient.UpdateRecipientRequest;
import com.swiftkite.entity.Campaign;
import com.swiftkite.entity.CampaignRecipient;
import com.swiftkite.enums.CampaignStatus;
import com.swiftkite.exception.AppException;
import com.swiftkite.exception.MissingPlaceholderException;
import com.swiftkite.exception.NotFoundException;
import com.swiftkite.repository.CampaignRecipientRepository;
import com.swiftkite.repository.CampaignRepository;
import com.swiftkite.services.interfaces.IRecipientService;
import com.swiftkite.util.Pagination;
import com.swiftkite.util.TemplateRenderer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class RecipientService implements IRecipientService {

    private final CampaignRepository campaignRepository;
    private final CampaignRecipientRepository recipientRepository;

    public RecipientService(
            CampaignRepository campaignRepository,
            CampaignRecipientRepository recipientRepository) {
        this.campaignRepository = campaignRepository;
        this.recipientRepository = recipientRepository;
    }

    @Override
    @Transactional
    public AddRecipientsResponse addRecipients(
            UUID userId, UUID campaignId, AddRecipientsRequest request) {
        // Row lock serializes this with Send, which changes the campaign status.
        requireDraftCampaignForUpdate(userId, campaignId);

        Map<String, Map<String, Object>> unique = new LinkedHashMap<>();
        int skipped = 0;

        for (AddRecipientsRequest.RecipientInput input : request.getRecipients()) {
            String email = normalizeEmail(input.getEmail());
            if (unique.containsKey(email)) {
                skipped++;
                continue;
            }
            Map<String, Object> data =
                    input.getData() == null
                            ? new LinkedHashMap<>()
                            : new LinkedHashMap<>(input.getData());
            unique.put(email, data);
        }

        if (unique.isEmpty()) {
            return new AddRecipientsResponse(0, skipped);
        }

        Set<String> existing = new HashSet<>(
                recipientRepository.findExistingEmails(campaignId, unique.keySet()));
        List<CampaignRecipient> toInsert = new ArrayList<>();

        for (Map.Entry<String, Map<String, Object>> entry : unique.entrySet()) {
            if (existing.contains(entry.getKey())) {
                skipped++;
                continue;
            }
            CampaignRecipient recipient = new CampaignRecipient();
            recipient.setCampaignId(campaignId);
            recipient.setEmail(entry.getKey());
            recipient.setData(entry.getValue());
            toInsert.add(recipient);
        }

        recipientRepository.saveAll(toInsert);
        return new AddRecipientsResponse(toInsert.size(), skipped);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<RecipientResponse> listRecipients(
            UUID userId, UUID campaignId, int page, int size) {
        requireOwned(userId, campaignId);
        Page<CampaignRecipient> recipients = recipientRepository.findByCampaignId(
                campaignId,
                Pagination.of(page, size, Sort.by(Sort.Direction.ASC, "createdAt", "id")));
        return PageResponse.from(recipients.map(this::toResponse));
    }

    @Override
    @Transactional
    public RecipientResponse updateRecipient(
            UUID userId, UUID campaignId, UUID recipientId, UpdateRecipientRequest request) {
        // Draft-only and row-locked so this cannot race a Send that snapshots recipients.
        requireDraftCampaignForUpdate(userId, campaignId);

        CampaignRecipient recipient = requireRecipient(campaignId, recipientId);
        String email = normalizeEmail(request.getEmail());

        recipientRepository
                .findByCampaignIdAndEmail(campaignId, email)
                .filter(existing -> !existing.getId().equals(recipientId))
                .ifPresent(existing -> {
                    throw new AppException(
                            "Another recipient already uses this email.",
                            HttpStatus.CONFLICT);
                });

        recipient.setEmail(email);
        recipient.setData(request.getData() == null
                ? new LinkedHashMap<>()
                : new LinkedHashMap<>(request.getData()));
        return toResponse(recipientRepository.save(recipient));
    }

    @Override
    @Transactional
    public void deleteRecipient(UUID userId, UUID campaignId, UUID recipientId) {
        requireDraftCampaignForUpdate(userId, campaignId);
        recipientRepository.delete(requireRecipient(campaignId, recipientId));
    }

    @Override
    @Transactional
    public FieldUpdateResponse renameRecipientField(
            UUID userId, UUID campaignId, RenameRecipientFieldRequest request) {
        requireDraftCampaignForUpdate(userId, campaignId);
        String from = request.getFrom().trim();
        String to = request.getTo().trim();
        if (from.equals(to)) {
            throw new AppException(
                    "Current and new column names must be different.", HttpStatus.BAD_REQUEST);
        }
        int updated = recipientRepository.renameField(campaignId, from, to, request.isOverwrite());
        return new FieldUpdateResponse(updated);
    }

    @Override
    @Transactional
    public FieldUpdateResponse removeRecipientFields(
            UUID userId, UUID campaignId, RemoveRecipientFieldsRequest request) {
        requireDraftCampaignForUpdate(userId, campaignId);
        Set<String> keys = new LinkedHashSet<>();
        for (String raw : request.getKeys()) {
            keys.add(raw.trim());
        }
        int updated = 0;
        for (String key : keys) {
            updated += recipientRepository.removeField(campaignId, key);
        }
        return new FieldUpdateResponse(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public PreviewResponse preview(UUID userId, UUID campaignId, PreviewRequest request) {
        Campaign campaign = requireOwned(userId, campaignId);

        String email = isBlank(request.getEmail()) ? null : normalizeEmail(request.getEmail());
        Map<String, Object> data = new LinkedHashMap<>();

        if (request.getData() != null) {
            data.putAll(request.getData());
        } else if (email != null) {
            CampaignRecipient recipient = recipientRepository
                    .findByCampaignIdAndEmail(campaignId, email)
                    .orElseThrow(() -> new NotFoundException("Recipient not found in this campaign."));
            data.putAll(recipient.getData());
        } else {
            throw new AppException(
                    "Provide a recipient email or inline data.", HttpStatus.BAD_REQUEST);
        }

        if (email == null && data.get("email") != null) {
            email = String.valueOf(data.get("email"));
        }

        Set<String> missing = new LinkedHashSet<>();
        missing.addAll(TemplateRenderer.missingKeys(campaign.getSubjectTemplate(), data, email));
        missing.addAll(TemplateRenderer.missingKeys(campaign.getBodyTemplate(), data, email));

        if (!missing.isEmpty()) {
            throw new MissingPlaceholderException(List.of(
                    new MissingPlaceholderException.MissingPlaceholder(
                            null, email, Set.copyOf(missing))));
        }

        String subject = TemplateRenderer
                .render(campaign.getSubjectTemplate(), data, email, false)
                .value();
        String body = TemplateRenderer
                .render(campaign.getBodyTemplate(), data, email, true)
                .value();
        return new PreviewResponse(subject, body);
    }

    private Campaign requireOwned(UUID userId, UUID campaignId) {
        return campaignRepository
                .findByIdAndUserId(campaignId, userId)
                .orElseThrow(() -> new NotFoundException("Campaign not found."));
    }

    private CampaignRecipient requireRecipient(UUID campaignId, UUID recipientId) {
        return recipientRepository
                .findById(recipientId)
                .filter(recipient -> recipient.getCampaignId().equals(campaignId))
                .orElseThrow(() -> new NotFoundException("Recipient not found."));
    }

    private Campaign requireDraftCampaignForUpdate(UUID userId, UUID campaignId) {
        Campaign campaign = campaignRepository
                .findByIdAndUserIdForUpdate(campaignId, userId)
                .orElseThrow(() -> new NotFoundException("Campaign not found."));
        if (campaign.getStatus() != CampaignStatus.DRAFT) {
            throw new AppException(
                    "Recipients can only be changed while the campaign is DRAFT.",
                    HttpStatus.CONFLICT);
        }
        return campaign;
    }

    private RecipientResponse toResponse(CampaignRecipient recipient) {
        Map<String, Object> data =
                recipient.getData() == null ? Map.of() : recipient.getData();
        return new RecipientResponse(
                recipient.getId(), recipient.getEmail(), data, recipient.getCreatedAt());
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}

package com.swiftkite.services.interfaces;

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
import jakarta.validation.Valid;
import java.util.UUID;

public interface IRecipientService {
    AddRecipientsResponse addRecipients(
            UUID userId, UUID campaignId, @Valid AddRecipientsRequest request);

    PageResponse<RecipientResponse> listRecipients(
            UUID userId, UUID campaignId, int page, int size);

    RecipientResponse updateRecipient(
            UUID userId,
            UUID campaignId,
            UUID recipientId,
            @Valid UpdateRecipientRequest request);

    void deleteRecipient(UUID userId, UUID campaignId, UUID recipientId);

    FieldUpdateResponse renameRecipientField(
            UUID userId,
            UUID campaignId,
            @Valid RenameRecipientFieldRequest request);

    FieldUpdateResponse removeRecipientFields(
            UUID userId,
            UUID campaignId,
            @Valid RemoveRecipientFieldsRequest request);

    PreviewResponse preview(
            UUID userId, UUID campaignId, @Valid PreviewRequest request);
}

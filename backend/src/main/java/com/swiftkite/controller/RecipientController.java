package com.swiftkite.controller;

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
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.services.interfaces.IRecipientService;
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
@RequestMapping("/api/campaigns/{campaignId}")
public class RecipientController {

    private final IRecipientService recipientService;

    public RecipientController(IRecipientService recipientService) {
        this.recipientService = recipientService;
    }

    @PostMapping("/recipients")
    public ResponseEntity<AddRecipientsResponse> add(
            @AuthenticationPrincipal ApplicationUser user,
            @PathVariable UUID campaignId,
            @Valid @RequestBody AddRecipientsRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(recipientService.addRecipients(user.getId(), campaignId, request));
    }

    @GetMapping("/recipients")
    public PageResponse<RecipientResponse> list(
            @AuthenticationPrincipal ApplicationUser user,
            @PathVariable UUID campaignId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return recipientService.listRecipients(user.getId(), campaignId, page, size);
    }

    @PostMapping("/preview")
    public PreviewResponse preview(
            @AuthenticationPrincipal ApplicationUser user,
            @PathVariable UUID campaignId,
            @Valid @RequestBody PreviewRequest request) {
        return recipientService.preview(user.getId(), campaignId, request);
    }

    @PutMapping("/recipients/{recipientId}")
    public RecipientResponse update(
            @AuthenticationPrincipal ApplicationUser user,
            @PathVariable UUID campaignId,
            @PathVariable UUID recipientId,
            @Valid @RequestBody UpdateRecipientRequest request) {
        return recipientService.updateRecipient(user.getId(), campaignId, recipientId, request);
    }

    @DeleteMapping("/recipients/{recipientId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal ApplicationUser user,
            @PathVariable UUID campaignId,
            @PathVariable UUID recipientId) {
        recipientService.deleteRecipient(user.getId(), campaignId, recipientId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/recipients/fields/rename")
    public FieldUpdateResponse renameField(
            @AuthenticationPrincipal ApplicationUser user,
            @PathVariable UUID campaignId,
            @Valid @RequestBody RenameRecipientFieldRequest request) {
        return recipientService.renameRecipientField(user.getId(), campaignId, request);
    }

    @PostMapping("/recipients/fields/remove")
    public FieldUpdateResponse removeFields(
            @AuthenticationPrincipal ApplicationUser user,
            @PathVariable UUID campaignId,
            @Valid @RequestBody RemoveRecipientFieldsRequest request) {
        return recipientService.removeRecipientFields(user.getId(), campaignId, request);
    }
}

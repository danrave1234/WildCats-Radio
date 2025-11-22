package com.wildcastradio.Announcement;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.storage.GcsStorageService;
import com.wildcastradio.storage.GcsStorageService.UploadUrlResponse;

import jakarta.validation.constraints.NotBlank;

@RestController
@RequestMapping("/api/announcements/image")
@Validated
public class AnnouncementImageController {

    private final GcsStorageService gcsStorageService;

    public AnnouncementImageController(GcsStorageService gcsStorageService) {
        this.gcsStorageService = gcsStorageService;
    }

    public static class SignedUrlRequest {
        @NotBlank
        public String fileName;
        @NotBlank
        public String contentType;

        public String getFileName() { return fileName; }
        public String getContentType() { return contentType; }
    }

    @PostMapping("/upload-url")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public ResponseEntity<UploadUrlResponse> getSignedUploadUrl(@RequestBody SignedUrlRequest req) {
        UploadUrlResponse resp = gcsStorageService.createSignedUploadUrl(req.getFileName(), req.getContentType());
        return ResponseEntity.ok(resp);
    }
}

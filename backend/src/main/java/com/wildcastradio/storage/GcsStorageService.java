package com.wildcastradio.storage;

import java.io.ByteArrayInputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.google.auth.Credentials;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.HttpMethod;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.Storage.SignUrlOption;
import com.google.cloud.storage.StorageOptions;

@Service
public class GcsStorageService {

    private static final Logger logger = LoggerFactory.getLogger(GcsStorageService.class);

    private final Storage storage;
    private final String bucketName;
    private final String announcementsPrefix;

    public GcsStorageService(
            @Value("${gcs.bucket-name}") String bucketName,
            @Value("${gcs.credentials.base64:}") String base64Credentials,
            @Value("${gcs.credentials.json:}") String jsonCredentials,
            @Value("${gcs.announcements.prefix:announcements/}") String announcementsPrefix
    ) {
        this.bucketName = bucketName;
        this.announcementsPrefix = announcementsPrefix.endsWith("/") ? announcementsPrefix : announcementsPrefix + "/";
        this.storage = initStorage(base64Credentials, jsonCredentials);
    }

    public boolean isEnabled() {
        return StringUtils.hasText(this.bucketName);
    }

    private Storage initStorage(String base64Credentials, String jsonCredentials) {
        try {
            logger.debug("GCS Storage initialization - base64Credentials present: {}", StringUtils.hasText(base64Credentials));
            logger.debug("GCS Storage initialization - jsonCredentials present: {}", StringUtils.hasText(jsonCredentials));
            
            // Try Base64-encoded credentials first
            if (StringUtils.hasText(base64Credentials)) {
                logger.debug("Using Base64 credentials");
                byte[] json = Base64.getDecoder().decode(base64Credentials.getBytes(StandardCharsets.UTF_8));
                Credentials creds = ServiceAccountCredentials.fromStream(new ByteArrayInputStream(json));
                return StorageOptions.newBuilder().setCredentials(creds).build().getService();
            }
            
            // Try direct JSON credentials
            if (StringUtils.hasText(jsonCredentials)) {
                logger.debug("Using direct JSON credentials");
                try {
                    // Clean and validate JSON - handle single quotes from environment variables
                    String cleanedJson = jsonCredentials.trim();
                    
                    // Remove outer single quotes if present
                    if (cleanedJson.startsWith("'") && cleanedJson.endsWith("'")) {
                        cleanedJson = cleanedJson.substring(1, cleanedJson.length() - 1);
                    }
                    
                    logger.debug("JSON length: {}, starts with: {}", cleanedJson.length(), 
                        cleanedJson.substring(0, Math.min(50, cleanedJson.length())));
                    
                    byte[] json = cleanedJson.getBytes(StandardCharsets.UTF_8);
                    Credentials creds = ServiceAccountCredentials.fromStream(new ByteArrayInputStream(json));
                    return StorageOptions.newBuilder().setCredentials(creds).build().getService();
                } catch (Exception jsonError) {
                    logger.error("JSON parsing error: {}", jsonError.getMessage(), jsonError);
                    // Fall through to default credentials
                }
            }
            
            logger.debug("No credentials provided, using default credentials");
            // Fallback to default credentials (GOOGLE_APPLICATION_CREDENTIALS, GCE metadata, etc.)
            GoogleCredentials defaultCreds = GoogleCredentials.getApplicationDefault();
            return StorageOptions.newBuilder().setCredentials(defaultCreds).build().getService();
        } catch (Exception e) {
            logger.error("Error initializing GCS Storage: {}", e.getMessage(), e);
            // As a last resort, try default instance which will throw on first use if misconfigured
            return StorageOptions.getDefaultInstance().getService();
        }
    }

    // ---------- Signed URL upload flow for announcement images ----------
    public UploadUrlResponse createSignedUploadUrl(String originalFileName, String contentType) {
        if (!StringUtils.hasText(bucketName)) {
            throw new IllegalStateException("GCS bucket name (gcs.bucket-name) is not configured");
        }
        // Basic validation
        if (!StringUtils.hasText(originalFileName)) {
            throw new IllegalArgumentException("fileName is required");
        }
        if (!StringUtils.hasText(contentType) || !contentType.toLowerCase().startsWith("image/")) {
            throw new IllegalArgumentException("Only image uploads are allowed");
        }

        String sanitized = sanitizeFileName(originalFileName);
        String objectName = announcementsPrefix + UUID.randomUUID() + "-" + sanitized;

        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, objectName)
                .setContentType(contentType)
                .build();

        // 15 minute expiry for upload URL
        long minutes = 15;
        Instant expiresAt = Instant.now().plusSeconds(minutes * 60);

        URL signedUrl = storage.signUrl(
                blobInfo,
                minutes,
                TimeUnit.MINUTES,
                SignUrlOption.httpMethod(HttpMethod.PUT),
                SignUrlOption.withV4Signature(),
                SignUrlOption.withContentType()
        );

        String publicUrl = String.format("https://storage.googleapis.com/%s/%s", bucketName, objectName);

        return new UploadUrlResponse(signedUrl.toString(), publicUrl, objectName, expiresAt.toString(), contentType);
    }

    // ---------- Server-side upload flow for Branding banner ----------
    public String uploadBanner(byte[] bytes, String contentType, String originalFileName) {
        if (!StringUtils.hasText(bucketName)) {
            throw new IllegalStateException("GCS bucket name (gcs.bucket-name) is not configured");
        }
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("No bytes to upload");
        }
        String ext = inferExt(originalFileName, contentType);
        String objectName = "branding/banner." + ext;
        BlobInfo.Builder builder = BlobInfo.newBuilder(BlobId.of(bucketName, objectName))
                .setContentType(contentType != null ? contentType : ("image/" + ext))
                .setCacheControl("public, max-age=3600");
        BlobInfo info = builder.build();
        // Upload and make public (requires bucket to allow uniform access or object-level ACLs)
        Blob blob = storage.create(info, bytes);
        // If bucket uses object ACLs, uncomment to force public read:
        // storage.create(info, bytes, Storage.BlobTargetOption.predefinedAcl(Storage.PredefinedAcl.PUBLIC_READ));
        return String.format("https://storage.googleapis.com/%s/%s", bucketName, objectName);
    }

    public boolean deleteBanner() {
        if (!StringUtils.hasText(bucketName)) {
            return false;
        }
        String[] candidates = new String[] {
                "branding/banner.jpg",
                "branding/banner.jpeg",
                "branding/banner.png",
                "branding/banner.webp",
                "branding/banner.gif"
        };
        boolean deletedAny = false;
        for (String key : candidates) {
            boolean deleted = storage.delete(BlobId.of(bucketName, key));
            deletedAny = deletedAny || deleted;
        }
        return deletedAny;
    }

    public String getBannerPublicUrl() {
        if (!StringUtils.hasText(bucketName)) {
            return null;
        }
        // Try known extensions in priority order
        String[] candidates = new String[] {
                "branding/banner.webp",
                "branding/banner.png",
                "branding/banner.jpg",
                "branding/banner.jpeg",
                "branding/banner.gif"
        };
        for (String key : candidates) {
            Blob b = storage.get(BlobId.of(bucketName, key));
            if (b != null && b.exists()) {
                return String.format("https://storage.googleapis.com/%s/%s", bucketName, key);
            }
        }
        return null;
    }

    // ---------- Deletion helpers for announcement images ----------
    /**
     * Deletes an object by its public URL if and only if:
     *  - GCS is enabled, and
     *  - URL belongs to this bucket's https://storage.googleapis.com/<bucket>/ prefix, and
     *  - Object path starts with the configured announcements prefix.
     * Returns true if a deletion was attempted and the object was deleted, false otherwise.
     */
    public boolean deleteByPublicUrl(String publicUrl) {
        if (!isEnabled() || !StringUtils.hasText(publicUrl)) return false;
        String prefix = String.format("https://storage.googleapis.com/%s/", bucketName);
        if (!publicUrl.startsWith(prefix)) {
            // Not our bucket (or unexpected URL host); skip
            return false;
        }
        String objectName = publicUrl.substring(prefix.length());
        if (!StringUtils.hasText(objectName)) return false;
        // Scope deletion to announcements folder only for safety
        if (!objectName.startsWith(announcementsPrefix)) {
            return false;
        }
        return deleteObject(objectName);
    }

    /**
     * Deletes an object by name within the configured bucket. Returns true if deleted.
     */
    public boolean deleteObject(String objectName) {
        if (!isEnabled() || !StringUtils.hasText(objectName)) return false;
        try {
            return storage.delete(BlobId.of(bucketName, objectName));
        } catch (Exception _e) {
            // best-effort; swallow exceptions
            return false;
        }
    }

    private String inferExt(String originalFileName, String contentType) {
        if (StringUtils.hasText(contentType) && contentType.toLowerCase().startsWith("image/")) {
            String ctExt = contentType.substring("image/".length());
            switch (ctExt) {
                case "jpeg": return "jpg";
                case "jpg":
                case "png":
                case "webp":
                case "gif": return ctExt;
                default: break;
            }
        }
        if (StringUtils.hasText(originalFileName)) {
            String name = originalFileName.trim().toLowerCase();
            int dot = name.lastIndexOf('.');
            if (dot > 0 && dot < name.length() - 1) {
                String ext = name.substring(dot + 1);
                switch (ext) {
                    case "jpeg": return "jpg";
                    case "jpg":
                    case "png":
                    case "webp":
                    case "gif": return ext;
                }
            }
        }
        return "jpg";
    }

    private String sanitizeFileName(String name) {
        String n = name.trim().toLowerCase();
        n = n.replaceAll("[^a-z0-9._-]", "-");
        // Limit length
        if (n.length() > 120) n = n.substring(n.length() - 120);
        // Ensure extension exists
        if (!n.contains(".")) {
            n = n + ".bin";
        }
        return n;
    }

    public static class UploadUrlResponse {
        private String uploadUrl;
        private String publicUrl;
        private String objectName;
        private String expiresAt;
        private String requiredContentType;

        public UploadUrlResponse(String uploadUrl, String publicUrl, String objectName, String expiresAt, String requiredContentType) {
            this.uploadUrl = uploadUrl;
            this.publicUrl = publicUrl;
            this.objectName = objectName;
            this.expiresAt = expiresAt;
            this.requiredContentType = requiredContentType;
        }

        public String getUploadUrl() { return uploadUrl; }
        public String getPublicUrl() { return publicUrl; }
        public String getObjectName() { return objectName; }
        public String getExpiresAt() { return expiresAt; }
        public String getRequiredContentType() { return requiredContentType; }
    }
}

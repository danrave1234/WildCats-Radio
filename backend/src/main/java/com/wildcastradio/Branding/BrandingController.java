package com.wildcastradio.Branding;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.wildcastradio.storage.GcsStorageService;

import java.io.IOException;
import java.nio.file.*;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/branding")
public class BrandingController {

    private static final Path UPLOAD_DIR = Paths.get("uploads");
    private static final String BANNER_BASENAME = "banner"; // we'll save as banner.ext

    private final GcsStorageService gcs;

    public BrandingController(GcsStorageService gcs) {
        this.gcs = gcs;
    }

    @GetMapping("/banner")
    public ResponseEntity<Map<String, Object>> getBanner() {
        Map<String, Object> resp = new HashMap<>();
        // Prefer GCS if configured
        if (gcs != null && gcs.isEnabled()) {
            String url = gcs.getBannerPublicUrl();
            resp.put("exists", url != null);
            resp.put("url", url);
            return ResponseEntity.ok(resp);
        }
        // Fallback: local filesystem
        ensureUploadDir();
        try (Stream<Path> files = Files.list(UPLOAD_DIR)) {
            Path banner = files
                    .filter(p -> p.getFileName().toString().startsWith(BANNER_BASENAME + "."))
                    .findFirst()
                    .orElse(null);
            if (banner != null) {
                String filename = banner.getFileName().toString();
                resp.put("exists", true);
                resp.put("url", "/uploads/" + filename);
            } else {
                resp.put("exists", false);
                resp.put("url", null);
            }
            return ResponseEntity.ok(resp);
        } catch (IOException e) {
            return ResponseEntity.ok(Map.of("exists", false, "url", null));
        }
    }

    @PostMapping(value = "/banner", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadBanner(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "File is empty"));
        }
        // Prefer GCS if configured
        if (gcs != null && gcs.isEnabled()) {
            try {
                String original = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "banner");
                String url = gcs.uploadBanner(file.getBytes(), file.getContentType(), original);
                return ResponseEntity.ok(Map.of("url", url));
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to upload to GCS"));
            }
        }
        // Fallback: local filesystem
        ensureUploadDir();
        // remove old banner files
        deleteExistingBannerFiles();
        String original = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "banner");
        String ext = "";
        int dot = original.lastIndexOf('.');
        if (dot > 0 && dot < original.length() - 1) {
            ext = original.substring(dot + 1).toLowerCase();
        }
        if (!(ext.equals("jpg") || ext.equals("jpeg") || ext.equals("png") || ext.equals("gif") || ext.equals("webp"))) {
            // default to jpg if missing/unknown
            ext = "jpg";
        }
        String filename = BANNER_BASENAME + "." + ext;
        Path target = UPLOAD_DIR.resolve(filename);
        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return ResponseEntity.ok(Map.of("url", "/uploads/" + filename));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to save file"));
        }
    }

    @DeleteMapping("/banner")
    public ResponseEntity<?> deleteBanner() {
        // Prefer GCS if configured
        if (gcs != null && gcs.isEnabled()) {
            boolean deleted = gcs.deleteBanner();
            return ResponseEntity.ok(Map.of("deleted", deleted));
        }
        // Fallback: local filesystem
        ensureUploadDir();
        boolean deleted = deleteExistingBannerFiles();
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }

    private static void ensureUploadDir() {
        try {
            if (!Files.exists(UPLOAD_DIR)) {
                Files.createDirectories(UPLOAD_DIR);
            }
        } catch (IOException ignored) {
        }
    }

    private static boolean deleteExistingBannerFiles() {
        boolean any = false;
        try (Stream<Path> files = Files.list(UPLOAD_DIR)) {
            for (Path p : (Iterable<Path>) files::iterator) {
                String name = p.getFileName().toString();
                if (name.startsWith(BANNER_BASENAME + ".")) {
                    try {
                        Files.deleteIfExists(p);
                        any = true;
                    } catch (IOException ignored) {}
                }
            }
        } catch (IOException ignored) {}
        return any;
    }
}

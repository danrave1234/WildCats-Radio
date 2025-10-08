package com.wildcastradio.Announcement;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.Announcement.DTO.AnnouncementDTO;
import com.wildcastradio.Announcement.DTO.CreateAnnouncementRequest;
import com.wildcastradio.Announcement.DTO.ScheduleAnnouncementRequest;
import com.wildcastradio.Announcement.DTO.RejectAnnouncementRequest;
import com.wildcastradio.Announcement.DTO.PublicAnnouncementDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/announcements")
public class AnnouncementController {

    private final AnnouncementService announcementService;
    private final UserService userService;

    public AnnouncementController(AnnouncementService announcementService, UserService userService) {
        this.announcementService = announcementService;
        this.userService = userService;
    }

    /**
     * Get published announcements (public endpoint)
     */
    @GetMapping
    public ResponseEntity<Page<PublicAnnouncementDTO>> getPublishedAnnouncements(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        Page<AnnouncementDTO> announcements = announcementService.getPublishedAnnouncements(page, size);
        Page<PublicAnnouncementDTO> publicPage = announcements.map(PublicAnnouncementDTO::fromDTO);
        return ResponseEntity.ok(publicPage);
    }

    /**
     * Get announcements by status (Moderators/Admins only)
     */
    @GetMapping("/by-status/{status}")
    @PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")
    public ResponseEntity<Page<AnnouncementDTO>> getAnnouncementsByStatus(
            @PathVariable String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        try {
            AnnouncementStatus announcementStatus = AnnouncementStatus.valueOf(status.toUpperCase());
            Page<AnnouncementDTO> announcements = announcementService.getAnnouncementsByStatus(announcementStatus, page, size);
            return ResponseEntity.ok(announcements);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get user's own announcements (for DJs to see their drafts)
     */
    @GetMapping("/my-announcements")
    @PreAuthorize("hasAnyRole('DJ', 'MODERATOR', 'ADMIN')")
    public ResponseEntity<Page<AnnouncementDTO>> getMyAnnouncements(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        UserEntity user = userService.getUserByEmail(authentication.getName())
            .orElseThrow(() -> new RuntimeException("User not found"));

        Page<AnnouncementDTO> announcements = announcementService.getUserAnnouncements(user.getId(), page, size);
        return ResponseEntity.ok(announcements);
    }

    /**
     * Get a single announcement by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getAnnouncementById(@PathVariable Long id) {
        try {
            AnnouncementDTO announcement = announcementService.getAnnouncementById(id);
            // If announcement is PUBLISHED, return public-safe DTO; otherwise return full DTO
            if (announcement.getStatus() == com.wildcastradio.Announcement.AnnouncementStatus.PUBLISHED) {
                return ResponseEntity.ok(PublicAnnouncementDTO.fromDTO(announcement));
            }
            return ResponseEntity.ok(announcement);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Create a new announcement
     * DJs create drafts, Moderators/Admins create published
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('DJ', 'MODERATOR', 'ADMIN')")
    public ResponseEntity<AnnouncementDTO> createAnnouncement(
            @Valid @RequestBody CreateAnnouncementRequest request,
            Authentication authentication) {
        
        UserEntity creator = userService.getUserByEmail(authentication.getName())
            .orElseThrow(() -> new RuntimeException("User not found"));

        AnnouncementDTO created = announcementService.createAnnouncement(request, creator);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Update an announcement
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('DJ', 'MODERATOR', 'ADMIN')")
    public ResponseEntity<?> updateAnnouncement(
            @PathVariable Long id,
            @Valid @RequestBody CreateAnnouncementRequest request,
            Authentication authentication) {
        
        try {
            UserEntity updater = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

            AnnouncementDTO updated = announcementService.updateAnnouncement(id, request, updater);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        }
    }

    /**
     * Publish a draft announcement (Moderators/Admins only)
     */
    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")
    public ResponseEntity<?> publishAnnouncement(
            @PathVariable Long id,
            Authentication authentication) {
        
        try {
            UserEntity publisher = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

            AnnouncementDTO published = announcementService.publishAnnouncement(id, publisher);
            return ResponseEntity.ok(published);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        }
    }

    /**
     * Schedule an announcement for future publication (Moderators/Admins only)
     */
    @PostMapping("/{id}/schedule")
    @PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")
    public ResponseEntity<?> scheduleAnnouncement(
            @PathVariable Long id,
            @Valid @RequestBody ScheduleAnnouncementRequest request,
            Authentication authentication) {
        
        try {
            UserEntity scheduler = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

            AnnouncementDTO scheduled = announcementService.scheduleAnnouncement(id, request, scheduler);
            return ResponseEntity.ok(scheduled);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    /**
     * Pin an announcement (Moderators/Admins only)
     */
    @PostMapping("/{id}/pin")
    @PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")
    public ResponseEntity<?> pinAnnouncement(
            @PathVariable Long id,
            Authentication authentication) {
        
        try {
            UserEntity pinner = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

            AnnouncementDTO pinned = announcementService.pinAnnouncement(id, pinner);
            return ResponseEntity.ok(pinned);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    /**
     * Unpin an announcement (Moderators/Admins only)
     */
    @PostMapping("/{id}/unpin")
    @PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")
    public ResponseEntity<?> unpinAnnouncement(
            @PathVariable Long id,
            Authentication authentication) {
        
        try {
            UserEntity unpinner = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

            AnnouncementDTO unpinned = announcementService.unpinAnnouncement(id, unpinner);
            return ResponseEntity.ok(unpinned);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    /**
     * Archive an announcement (Moderators/Admins only)
     */
    @PostMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")
    public ResponseEntity<?> archiveAnnouncement(
            @PathVariable Long id,
            Authentication authentication) {
        
        try {
            UserEntity archiver = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

            AnnouncementDTO archived = announcementService.archiveAnnouncement(id, archiver);
            return ResponseEntity.ok(archived);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        }
    }

    /**
     * Unarchive an announcement (Moderators/Admins only)
     */
    @PostMapping("/{id}/unarchive")
    @PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")
    public ResponseEntity<?> unarchiveAnnouncement(
            @PathVariable Long id,
            Authentication authentication) {
        
        try {
            UserEntity unarchiver = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

            AnnouncementDTO unarchived = announcementService.unarchiveAnnouncement(id, unarchiver);
            return ResponseEntity.ok(unarchived);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    /**
     * Reject an announcement (Moderators/Admins only)
     */
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('MODERATOR', 'ADMIN')")
    public ResponseEntity<?> rejectAnnouncement(
            @PathVariable Long id,
            @Valid @RequestBody RejectAnnouncementRequest request,
            Authentication authentication) {
        
        try {
            UserEntity rejecter = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

            AnnouncementDTO rejected = announcementService.rejectAnnouncement(
                id, 
                request.getRejectionReason(), 
                rejecter
            );
            return ResponseEntity.ok(rejected);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    /**
     * Resubmit a rejected announcement (DJ only)
     */
    @PostMapping("/{id}/resubmit")
    @PreAuthorize("hasAnyRole('DJ', 'MODERATOR', 'ADMIN')")
    public ResponseEntity<?> resubmitAnnouncement(
            @PathVariable Long id,
            Authentication authentication) {
        
        try {
            UserEntity submitter = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

            AnnouncementDTO resubmitted = announcementService.resubmitAnnouncement(id, submitter);
            return ResponseEntity.ok(resubmitted);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        }
    }

    /**
     * Delete an announcement
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('DJ', 'MODERATOR', 'ADMIN')")
    public ResponseEntity<?> deleteAnnouncement(
            @PathVariable Long id,
            Authentication authentication) {
        
        try {
            UserEntity deleter = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

            announcementService.deleteAnnouncement(id, deleter);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        }
    }
}
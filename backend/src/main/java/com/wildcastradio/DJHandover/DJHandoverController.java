package com.wildcastradio.DJHandover;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.DJHandover.DTO.DJHandoverDTO;
import com.wildcastradio.DJHandover.DTO.HandoverRequestDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;
import com.wildcastradio.User.DTO.UserDTO;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/broadcasts")
public class DJHandoverController {

    private static final Logger logger = LoggerFactory.getLogger(DJHandoverController.class);

    @Autowired
    private DJHandoverService handoverService;

    @Autowired
    private UserService userService;

    /**
     * Initiate a DJ handover for a live broadcast
     * POST /api/broadcasts/{id}/handover
     */
    @PostMapping("/{id}/handover")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public ResponseEntity<DJHandoverDTO> initiateHandover(
            @PathVariable Long id,
            @Valid @RequestBody HandoverRequestDTO request,
            Authentication authentication) {

        if (authentication == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            UserEntity initiator = userService.getUserByEmail(authentication.getName())
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));

            DJHandoverDTO handover = handoverService.initiateHandover(id, request, initiator);
            return ResponseEntity.ok(handover);
        } catch (IllegalArgumentException e) {
            logger.warn("Handover validation failed: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            logger.error("Error initiating handover", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get handover history for a broadcast
     * GET /api/broadcasts/{id}/handovers
     */
    @GetMapping("/{id}/handovers")
    @PreAuthorize("hasAnyRole('DJ','ADMIN','MODERATOR')")
    public ResponseEntity<List<DJHandoverDTO>> getHandoverHistory(@PathVariable Long id) {
        try {
            List<DJHandoverDTO> handovers = handoverService.getHandoverHistory(id);
            return ResponseEntity.ok(handovers);
        } catch (Exception e) {
            logger.error("Error retrieving handover history", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get current active DJ for a broadcast
     * GET /api/broadcasts/{id}/current-dj
     */
    @GetMapping("/{id}/current-dj")
    public ResponseEntity<UserDTO> getCurrentActiveDJ(@PathVariable Long id) {
        try {
            UserDTO currentDJ = handoverService.getCurrentActiveDJ(id);
            if (currentDJ == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(currentDJ);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("Error retrieving current active DJ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}


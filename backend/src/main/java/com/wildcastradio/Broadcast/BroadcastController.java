package com.wildcastradio.Broadcast;

import java.util.Collections;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.Broadcast.DTO.BroadcastDTO;
import com.wildcastradio.Broadcast.DTO.CreateBroadcastRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/broadcasts")
public class BroadcastController {

    @Autowired
    private BroadcastService broadcastService;

    @PostMapping
    public ResponseEntity<BroadcastDTO> createBroadcast(@Valid @RequestBody CreateBroadcastRequest request) {
        // This would call a service method to create a broadcast
        return new ResponseEntity<>(new BroadcastDTO(), HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<BroadcastDTO>> getAllBroadcasts() {
        // This would call a service method to get all broadcasts
        return ResponseEntity.ok(Collections.emptyList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<BroadcastDTO> getBroadcastById(@PathVariable Long id) {
        // This would call a service method to get a broadcast by ID
        return ResponseEntity.ok(new BroadcastDTO());
    }

    @PutMapping("/{id}")
    public ResponseEntity<BroadcastDTO> updateBroadcast(@PathVariable Long id, 
                                                      @Valid @RequestBody CreateBroadcastRequest request) {
        // This would call a service method to update a broadcast
        return ResponseEntity.ok(new BroadcastDTO());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBroadcast(@PathVariable Long id) {
        // This would call a service method to delete a broadcast
        return ResponseEntity.noContent().build();
    }
} 

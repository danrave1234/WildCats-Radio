package com.wildcastradio.Poll;

import java.util.List;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.wildcastradio.Poll.DTO.CreatePollRequest;
import com.wildcastradio.Poll.DTO.PollDTO;
import com.wildcastradio.Poll.DTO.PollResultDTO;
import com.wildcastradio.Poll.DTO.VoteRequest;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;

@RestController
@RequestMapping("/api/polls")
public class PollController {

    private final PollService pollService;
    private final UserService userService;

    public PollController(PollService pollService, UserService userService) {
        this.pollService = pollService;
        this.userService = userService;
    }

    @PostMapping
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<PollDTO> createPoll(@RequestBody CreatePollRequest request, Authentication authentication) {
        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        PollDTO poll = pollService.createPoll(request, user.getId());
        return ResponseEntity.ok(poll);
    }

    @GetMapping("/broadcast/{broadcastId}")
    public ResponseEntity<List<PollDTO>> getPollsForBroadcast(@PathVariable Long broadcastId) {
        List<PollDTO> polls = pollService.getPollsForBroadcast(broadcastId);
        return ResponseEntity.ok(polls);
    }

    @GetMapping("/broadcast/{broadcastId}/active")
    public ResponseEntity<List<PollDTO>> getActivePollsForBroadcast(@PathVariable Long broadcastId) {
        List<PollDTO> polls = pollService.getActivePollsForBroadcast(broadcastId);
        return ResponseEntity.ok(polls);
    }

    @GetMapping("/{pollId}")
    public ResponseEntity<PollDTO> getPoll(@PathVariable Long pollId) {
        PollDTO poll = pollService.getPoll(pollId);
        return ResponseEntity.ok(poll);
    }

    @PostMapping("/{pollId}/vote")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PollResultDTO> vote(@PathVariable Long pollId, @RequestBody VoteRequest request, Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }
        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        // Ensure the pollId in the path matches the one in the request
        if (!pollId.equals(request.getPollId())) {
            return ResponseEntity.badRequest().build();
        }
        
        PollResultDTO result = pollService.vote(request, user.getId());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{pollId}/results")
    public ResponseEntity<PollResultDTO> getPollResults(@PathVariable Long pollId) {
        PollResultDTO results = pollService.getPollResults(pollId);
        return ResponseEntity.ok(results);
    }

    @PostMapping("/{pollId}/end")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<PollDTO> endPoll(@PathVariable Long pollId, Authentication authentication) {
        PollDTO poll = pollService.endPoll(pollId);
        return ResponseEntity.ok(poll);
    }

    @PostMapping("/{pollId}/show")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<PollDTO> showPoll(@PathVariable Long pollId, Authentication authentication) {
        PollDTO poll = pollService.showPoll(pollId);
        return ResponseEntity.ok(poll);
    }

    @DeleteMapping("/{pollId}")
    @PreAuthorize("hasRole('DJ') or hasRole('ADMIN')")
    public ResponseEntity<Void> deletePoll(@PathVariable Long pollId, Authentication authentication) {
        pollService.deletePoll(pollId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{pollId}/has-voted")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Boolean> hasUserVoted(@PathVariable Long pollId, Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }
        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        boolean hasVoted = pollService.hasUserVoted(pollId, user.getId());
        return ResponseEntity.ok(hasVoted);
    }

    @GetMapping("/{pollId}/user-vote")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Long> getUserVote(@PathVariable Long pollId, Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).build();
        }
        UserEntity user = userService.getUserByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Optional<Long> optionId = pollService.getUserVote(pollId, user.getId());
        return optionId.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
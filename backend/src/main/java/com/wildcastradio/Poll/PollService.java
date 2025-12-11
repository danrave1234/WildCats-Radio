package com.wildcastradio.Poll;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.Poll.DTO.CreatePollRequest;
import com.wildcastradio.Poll.DTO.PollDTO;
import com.wildcastradio.Poll.DTO.PollOptionDTO;
import com.wildcastradio.Poll.DTO.PollResultDTO;
import com.wildcastradio.Poll.DTO.VoteRequest;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserRepository;

@Service
public class PollService {

    private final PollRepository pollRepository;
    private final PollOptionRepository optionRepository;
    private final PollVoteRepository voteRepository;
    private final BroadcastRepository broadcastRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public PollService(
            PollRepository pollRepository,
            PollOptionRepository optionRepository,
            PollVoteRepository voteRepository,
            BroadcastRepository broadcastRepository,
            UserRepository userRepository,
            SimpMessagingTemplate messagingTemplate) {
        this.pollRepository = pollRepository;
        this.optionRepository = optionRepository;
        this.voteRepository = voteRepository;
        this.broadcastRepository = broadcastRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public PollDTO createPoll(CreatePollRequest request, Long userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        BroadcastEntity broadcast = broadcastRepository.findById(request.getBroadcastId())
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        // Create the poll as DRAFT (not active until explicitly shown)
        PollEntity poll = new PollEntity(request.getQuestion(), user, broadcast);
        poll.setActive(false); // create as draft
        PollEntity savedPoll = pollRepository.save(poll);

        // Create options
        List<PollOptionEntity> options = new ArrayList<>();
        for (String optionText : request.getOptions()) {
            PollOptionEntity option = new PollOptionEntity(optionText, savedPoll);
            options.add(optionRepository.save(option));
        }

        // Build the response
        PollDTO pollDTO = buildPollDTO(savedPoll, options);

        // Do NOT broadcast yet. Poll will be visible when DJ posts it via showPoll()
        return pollDTO;
    }

    /**
     * Post/show a poll to listeners (make active=true and broadcast NEW_POLL)
     */
    @Transactional
    public PollDTO showPoll(Long pollId) {
        PollEntity poll = pollRepository.findById(pollId)
                .orElseThrow(() -> new RuntimeException("Poll not found"));

        // Ensure only one active poll per broadcast by ending others first
        List<PollEntity> currentlyActive = pollRepository.findByBroadcastAndActiveTrue(poll.getBroadcast());
        for (PollEntity other : currentlyActive) {
            if (!other.getId().equals(pollId)) {
                other.endPoll();
                PollEntity ended = pollRepository.save(other);
                // Broadcast update for ended poll so clients can clear it
                List<PollOptionEntity> endedOptions = optionRepository.findByPollOrderByIdAsc(ended);
                PollDTO endedDTO = buildPollDTO(ended, endedOptions);
                broadcastPollUpdate(ended.getBroadcast().getId(), 
                    new PollWebSocketMessage("POLL_UPDATED", endedDTO, null, null));
            }
        }

        if (!poll.isActive()) {
            poll.setActive(true);
            poll = pollRepository.save(poll);
        }

        List<PollOptionEntity> options = optionRepository.findByPollOrderByIdAsc(poll);
        PollDTO pollDTO = buildPollDTO(poll, options);

        // Notify listeners that a new poll is now visible
        broadcastPollUpdate(poll.getBroadcast().getId(), 
            new PollWebSocketMessage("NEW_POLL", pollDTO, null, null));

        return pollDTO;
    }

    /**
     * Delete a poll and notify listeners to remove it from view
     */
    @Transactional
    public void deletePoll(Long pollId) {
        PollEntity poll = pollRepository.findById(pollId)
                .orElseThrow(() -> new RuntimeException("Poll not found"));
        Long broadcastId = poll.getBroadcast().getId();
        pollRepository.delete(poll);

        // Notify listeners that the poll was deleted
        broadcastPollUpdate(broadcastId, 
            new PollWebSocketMessage("POLL_DELETED", pollId, null));
    }

    @Transactional(readOnly = true)
    public List<PollDTO> getPollsForBroadcast(Long broadcastId) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        List<PollEntity> polls = pollRepository.findByBroadcastOrderByCreatedAtDesc(broadcast);

        return polls.stream()
                .map(poll -> {
                    List<PollOptionEntity> options = optionRepository.findByPollOrderByIdAsc(poll);
                    return buildPollDTO(poll, options);
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PollDTO> getActivePollsForBroadcast(Long broadcastId) {
        BroadcastEntity broadcast = broadcastRepository.findById(broadcastId)
                .orElseThrow(() -> new RuntimeException("Broadcast not found"));

        List<PollEntity> polls = pollRepository.findByBroadcastAndActiveTrue(broadcast);

        return polls.stream()
                .map(poll -> {
                    List<PollOptionEntity> options = optionRepository.findByPollOrderByIdAsc(poll);
                    return buildPollDTO(poll, options);
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PollDTO getPoll(Long pollId) {
        PollEntity poll = pollRepository.findById(pollId)
                .orElseThrow(() -> new RuntimeException("Poll not found"));

        List<PollOptionEntity> options = optionRepository.findByPollOrderByIdAsc(poll);

        return buildPollDTO(poll, options);
    }

    @Transactional
    public PollResultDTO vote(VoteRequest request, Long userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        PollEntity poll = pollRepository.findById(request.getPollId())
                .orElseThrow(() -> new RuntimeException("Poll not found"));

        if (!poll.isActive()) {
            throw new RuntimeException("Poll is no longer active");
        }

        // Check if user has already voted
        if (voteRepository.existsByUserAndPoll(user, poll)) {
            throw new RuntimeException("User has already voted in this poll");
        }

        PollOptionEntity option = optionRepository.findById(request.getOptionId())
                .orElseThrow(() -> new RuntimeException("Option not found"));

        // Ensure option belongs to the poll
        if (!option.getPoll().getId().equals(poll.getId())) {
            throw new RuntimeException("Option does not belong to the poll");
        }

        // Create the vote
        PollVoteEntity vote = new PollVoteEntity(user, poll, option);
        voteRepository.save(vote);

        // Get updated poll results
        PollResultDTO results = getPollResults(poll.getId());

        // Notify all clients about the vote
        broadcastPollUpdate(poll.getBroadcast().getId(), 
            new PollWebSocketMessage("POLL_RESULTS", poll.getId(), results));

        return results;
    }

    @Transactional(readOnly = true)
    public PollResultDTO getPollResults(Long pollId) {
        PollEntity poll = pollRepository.findById(pollId)
                .orElseThrow(() -> new RuntimeException("Poll not found"));

        List<PollOptionEntity> options = optionRepository.findByPollOrderByIdAsc(poll);

        long totalVotes = voteRepository.countByPoll(poll);

        List<PollResultDTO.OptionResult> optionResults = options.stream()
                .map(option -> {
                    long optionVotes = voteRepository.countByOption(option);
                    double percentage = totalVotes > 0 ? (optionVotes * 100.0) / totalVotes : 0;

                    return new PollResultDTO.OptionResult(
                            option.getId(),
                            option.getText(),
                            optionVotes,
                            percentage
                    );
                })
                .collect(Collectors.toList());

        return new PollResultDTO(
                poll.getId(),
                poll.getQuestion(),
                poll.isActive(),
                totalVotes,
                optionResults
        );
    }

    @Transactional
    public PollDTO endPoll(Long pollId) {
        PollEntity poll = pollRepository.findById(pollId)
                .orElseThrow(() -> new RuntimeException("Poll not found"));

        poll.endPoll();
        PollEntity savedPoll = pollRepository.save(poll);

        List<PollOptionEntity> options = optionRepository.findByPollOrderByIdAsc(savedPoll);
        PollDTO pollDTO = buildPollDTO(savedPoll, options);

        // Notify all clients about the poll ending
        broadcastPollUpdate(savedPoll.getBroadcast().getId(), 
            new PollWebSocketMessage("POLL_UPDATED", pollDTO, null, null));

        return pollDTO;
    }

    @Transactional(readOnly = true)
    public boolean hasUserVoted(Long pollId, Long userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        PollEntity poll = pollRepository.findById(pollId)
                .orElseThrow(() -> new RuntimeException("Poll not found"));

        return voteRepository.existsByUserAndPoll(user, poll);
    }

    @Transactional(readOnly = true)
    public Optional<Long> getUserVote(Long pollId, Long userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        PollEntity poll = pollRepository.findById(pollId)
                .orElseThrow(() -> new RuntimeException("Poll not found"));

        Optional<PollVoteEntity> vote = voteRepository.findByUserAndPoll(user, poll);

        return vote.map(v -> v.getOption().getId());
    }

    private PollDTO buildPollDTO(PollEntity poll, List<PollOptionEntity> options) {
        List<PollOptionDTO> optionDTOs = options.stream()
                .map(option -> new PollOptionDTO(
                        option.getId(),
                        option.getText(),
                        voteRepository.countByOption(option)
                ))
                .collect(Collectors.toList());

        return new PollDTO(
                poll.getId(),
                poll.getQuestion(),
                poll.getCreatedAt(),
                poll.getEndedAt(),
                poll.isActive(),
                poll.getCreatedBy().getId(),
                poll.getCreatedBy().getFirstname() + " " + poll.getCreatedBy().getLastname(),
                poll.getBroadcast().getId(),
                optionDTOs,
                voteRepository.countByPoll(poll)
        );
    }

    /**
     * Broadcast poll update to all subscribers
     * Centralized messaging method for controller-based pattern
     * 
     * @param broadcastId The broadcast ID for the topic
     * @param message The poll WebSocket message to broadcast
     */
    public void broadcastPollUpdate(Long broadcastId, PollWebSocketMessage message) {
        messagingTemplate.convertAndSend(
                "/topic/broadcast/" + broadcastId + "/polls",
                message
        );
    }

    public void broadcastPollsCleared(Long broadcastId) {
        try {
            PollWebSocketMessage clearMessage = new PollWebSocketMessage("POLL_CLEARED", null, null);
            messagingTemplate.convertAndSend("/topic/broadcast/" + broadcastId + "/polls", clearMessage);
        } catch (Exception e) {
            // Non-blocking notification
        }
    }
}

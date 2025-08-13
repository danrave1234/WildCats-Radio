package com.wildcastradio.ChatMessage;

import com.wildcastradio.Broadcast.BroadcastEntity;
import com.wildcastradio.Broadcast.BroadcastRepository;
import com.wildcastradio.ChatMessage.DTO.ChatMessageDTO;
import com.wildcastradio.User.UserEntity;
import com.wildcastradio.User.UserService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.lang.reflect.Field;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;

public class ChatMessageControllerSlowModeTest {

    private ChatMessageController newControllerWithMocks(
            ChatMessageService chatMessageService,
            UserService userService,
            BroadcastRepository broadcastRepository
    ) throws Exception {
        ChatMessageController controller = new ChatMessageController();
        setField(controller, "chatMessageService", chatMessageService);
        setField(controller, "userService", userService);
        setField(controller, "broadcastRepository", broadcastRepository);
        return controller;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(fieldName);
        f.setAccessible(true);
        f.set(target, value);
    }

    @Test
    void listenerIsThrottledWhenSlowModeEnabled() throws Exception {
        // Arrange
        long broadcastId = 1L;
        BroadcastEntity broadcast = new BroadcastEntity();
        broadcast.setId(broadcastId);
        broadcast.setSlowModeEnabled(true);
        broadcast.setSlowModeSeconds(3);

        UserEntity listener = new UserEntity();
        listener.setId(100L);
        listener.setEmail("listener@example.com");
        listener.setRole(UserEntity.UserRole.LISTENER);

        ChatMessageService chatMessageService = Mockito.mock(ChatMessageService.class);
        UserService userService = Mockito.mock(UserService.class);
        BroadcastRepository broadcastRepository = Mockito.mock(BroadcastRepository.class);

        Mockito.when(userService.getUserByEmail(listener.getEmail())).thenReturn(Optional.of(listener));
        Mockito.when(broadcastRepository.findById(broadcastId)).thenReturn(Optional.of(broadcast));

        // Return a simple entity when creating a message
        Mockito.when(chatMessageService.createMessage(Mockito.eq(broadcastId), Mockito.eq(listener), Mockito.anyString()))
                .thenAnswer(inv -> new ChatMessageEntity(broadcast, listener, inv.getArgument(2)));

        ChatMessageController controller = newControllerWithMocks(chatMessageService, userService, broadcastRepository);

        Authentication auth = Mockito.mock(Authentication.class);
        Mockito.when(auth.getName()).thenReturn(listener.getEmail());

        ChatMessageController.ChatMessageRequest req = new ChatMessageController.ChatMessageRequest();
        req.setContent("Hello world");

        // Act: First message should succeed (200)
        ResponseEntity<ChatMessageDTO> first = controller.sendMessage(broadcastId, req, auth);

        // Immediate second message should be throttled (429) with Retry-After header
        ResponseEntity<ChatMessageDTO> second = controller.sendMessage(broadcastId, req, auth);

        // Assert
        assertEquals(200, first.getStatusCodeValue(), "First message should be allowed");
        assertEquals(429, second.getStatusCodeValue(), "Second immediate message should be rate limited");
        String retryAfter = second.getHeaders().getFirst("Retry-After");
        assertNotNull(retryAfter, "Retry-After header should be present when throttled");
        int sec = Integer.parseInt(retryAfter);
        assertTrue(sec >= 1, "Retry-After should be at least 1 second");
    }

    @Test
    void djBypassesSlowMode() throws Exception {
        // Arrange
        long broadcastId = 2L;
        BroadcastEntity broadcast = new BroadcastEntity();
        broadcast.setId(broadcastId);
        broadcast.setSlowModeEnabled(true);
        broadcast.setSlowModeSeconds(5);

        UserEntity dj = new UserEntity();
        dj.setId(200L);
        dj.setEmail("dj@example.com");
        dj.setRole(UserEntity.UserRole.DJ);

        ChatMessageService chatMessageService = Mockito.mock(ChatMessageService.class);
        UserService userService = Mockito.mock(UserService.class);
        BroadcastRepository broadcastRepository = Mockito.mock(BroadcastRepository.class);

        Mockito.when(userService.getUserByEmail(dj.getEmail())).thenReturn(Optional.of(dj));
        Mockito.when(broadcastRepository.findById(broadcastId)).thenReturn(Optional.of(broadcast));
        Mockito.when(chatMessageService.createMessage(Mockito.eq(broadcastId), Mockito.eq(dj), Mockito.anyString()))
                .thenAnswer(inv -> new ChatMessageEntity(broadcast, dj, inv.getArgument(2)));

        ChatMessageController controller = newControllerWithMocks(chatMessageService, userService, broadcastRepository);

        Authentication auth = Mockito.mock(Authentication.class);
        Mockito.when(auth.getName()).thenReturn(dj.getEmail());

        ChatMessageController.ChatMessageRequest req = new ChatMessageController.ChatMessageRequest();
        req.setContent("Test message");

        // Act: Send twice immediately
        ResponseEntity<ChatMessageDTO> first = controller.sendMessage(broadcastId, req, auth);
        ResponseEntity<ChatMessageDTO> second = controller.sendMessage(broadcastId, req, auth);

        // Assert: Both should be OK
        assertEquals(200, first.getStatusCodeValue());
        assertEquals(200, second.getStatusCodeValue());
    }
}

# Mobile Troubleshooting Guide

## Network Errors on Emulator
If you are encountering `Network request failed` errors while running on the Android Emulator:

1.  **Correct IP Address:** ensure `mobile/config/environment.ts` uses `10.0.2.2` as the `LOCAL_IP`. This is the special alias for the host machine's `localhost`.
    ```typescript
    const LOCAL_IP = '10.0.2.2';
    ```
2.  **Backend Running:** Ensure your backend server is running on port `8080`.
3.  **Clear Text Traffic:** Android blocks cleartext (HTTP) traffic by default. Ensure `android/app/src/main/AndroidManifest.xml` has `android:usesCleartextTraffic="true"` in the `<application>` tag.

## "Ghost" Chat Messages
If you see empty bubbles or space allocated for chat messages but no content:

1.  **Animation Issue:** The entry animation might have stuck opacity at 0. We have updated `AnimatedMessage.tsx` to use robust `Animated.timing` instead of direct value setting.
2.  **Missing Content:** Ensure the backend is returning a `content` field in the chat message DTO.

## WebSocket Connection
The app uses STOMP over SockJS at `/ws-radio`.
- Check logs for `StompClientManager` output.
- Ensure the backend allows CORS from the emulator's origin (or `*`).

## API Timeouts
We have introduced `fetchWithTimeout` in `mobile/services/apiService.ts` to handle slow network responses gracefully. If you see timeouts:
- Check your internet connection.
- Verify the backend is responsive.

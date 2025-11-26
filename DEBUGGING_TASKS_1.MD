## 6. Slow-mode notifications for users

### Problem
- **Current behavior**: When slow mode is enabled for the chat, users experience delayed message sending without any clear explanation.
- **User impact**: Users may think the app is broken, laggy, or that their messages are not being sent at all. This creates confusion and a poor UX.

### Goal
- **Provide a clear, persistent notification** near the message input whenever slow mode is active, explaining:
  - That **slow mode is enabled**.
  - **How many seconds remain** before the user can send their next message.

### UX / UI Requirements
- **Placement**: A compact notice directly **above the message input bar** in the chat area.
- **Message copy**:
  - Base text: `Slow Mode is enabled.`
  - Dynamic portion: `You can chat in {numberOfSeconds} seconds from now.`
  - Combine into a single line, e.g.:  
    `Slow Mode is enabled. You can chat in 10 seconds from now.`
- **Visibility rules**:
  - Shown **only when slow mode is enabled** for the current chat.
  - Shown **only when the user is currently rate-limited** (i.e., they must wait before sending again).
  - Hidden when:
    - Slow mode is disabled for this chat, or
    - The user is allowed to send a message immediately.
- **Styling**:
  - Match existing frontend framework and theming (light/dark mode, typography, spacing).
  - Use a subtle but noticeable background (e.g., soft warning color that fits existing design system).
  - Keep it compact; do not push the chat area excessively.

### Functional Requirements
- **Inputs / dependencies**:
  - A boolean flag indicating if **slow mode is enabled** for this chat (configured by the DJ).
  - A numeric value for **slow mode interval in seconds** (e.g., 5, 10, 30…).
  - A timestamp or similar token representing **when the user last successfully sent a message**.
- **Logic**:
  1. Compute how much time is left before the user can send their next message:  
     \[
     remainingSeconds = slowModeIntervalSeconds - (now - lastMessageTimestamp)
     \]
  2. If `remainingSeconds > 0` and slow mode is enabled:
     - Show the notification with `remainingSeconds` (rounded up to nearest whole second).
     - Optionally update the countdown every second for a smooth UX.
  3. If `remainingSeconds <= 0` or slow mode is disabled:
     - Hide the notification.
- **Security / abuse considerations**:
  - Do not expose internal identifiers or sensitive data in the message.
  - Ensure slow mode logic is **also enforced on the backend** so that clients cannot bypass it.
  - Avoid logging sensitive message content when handling rate-limited events; log only necessary metadata (e.g., user ID, timestamps, and reason: "slow_mode").

### Implementation Plan (Frontend)
1. **Identify chat input component**
   - Locate the component responsible for rendering the **message input bar** in the user chat UI.
   - Confirm where slow mode state / configuration is currently stored or passed down (e.g., context, props, Redux, or other state store).
2. **Add slow mode state wiring**
   - Ensure the chat input component has access to:
     - `isSlowModeEnabled` (boolean).
     - `slowModeIntervalSeconds` (number).
     - `lastMessageTimestamp` for the current user in this chat.
3. **Introduce a computed `remainingSeconds`**
   - In the chat input component or a dedicated hook, compute `remainingSeconds` using the rules described above.
   - Use a `setInterval` or a similar timing mechanism (cleaned up on unmount) to update the countdown once per second while `remainingSeconds > 0`.
4. **Render the notification bar**
   - Conditionally render a small notification bar **above the input** when:
     - `isSlowModeEnabled === true`, and
     - `remainingSeconds > 0`.
   - Display text:  
     `Slow Mode is enabled. You can chat in {remainingSeconds} seconds from now.`
   - Ensure the bar:
     - Supports theme-specific colors via existing theme/context hooks.
     - Is keyboard- and screen-reader-friendly (e.g., use `aria-live="polite"` if appropriate).
5. **Disable send interaction while rate-limited**
   - While `remainingSeconds > 0`:
     - Disable the send button and/or `Enter` key handling for sending messages.
     - Keep typing allowed so users can prepare their next message.

### Implementation Plan (Backend / API alignment)
- **Verify existing slow mode enforcement**
  - Ensure the backend already tracks rate-limit windows and rejects messages that violate slow mode.
  - Confirm the backend response for rate-limited attempts is explicit (e.g., an error code like `SLOW_MODE_ACTIVE` and the remaining wait time when possible).
- **Align frontend to backend**
  - Use backend-provided remaining wait time, if available, to set or adjust `remainingSeconds`.
  - Ensure that even if the frontend state is out-of-sync, the backend cannot be bypassed.

### Acceptance Criteria
- **UX**
  - When slow mode is off, no new notification is shown and sending behaves as it does now.
  - When slow mode is on and the user hits the limit:
    - A bar appears above the input saying  
      `Slow Mode is enabled. You can chat in {remainingSeconds} seconds from now.`
    - The countdown decreases once per second until it reaches 0, then the bar hides automatically.
- **Behavior**
  - Users cannot send messages faster than the configured slow-mode interval, even if they modify client behavior.
  - No placeholder or mock data is hard-coded; all times and flags are based on real slow-mode configuration and real user activity.
- **Non-functional**
  - Added logic does not noticeably degrade chat performance.
  - The design matches the existing UI style and supports both light and dark themes (if applicable).



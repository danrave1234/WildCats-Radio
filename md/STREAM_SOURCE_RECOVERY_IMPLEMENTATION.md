# Stream Source Recovery Implementation Plan
## Automatic Stream Source Reconnection & Fallback Mechanisms

**Document Version:** 1.1  
**Date:** January 2025  
**Status:** Implementation Plan - Phase 1 Completed  
**Priority:** MEDIUM (Enhancement to existing recovery mechanisms)

---

## Executive Summary

This document outlines the implementation plan for **automatic stream source reconnection** and **fallback mechanisms** to eliminate the need for manual DJ intervention when audio source disconnections occur. This enhancement builds upon the existing WebSocket reconnection and health monitoring systems to provide fully automatic recovery.

**Current State:** ✅ WebSocket reconnection implemented, ⚠️ Manual DJ intervention required for stream source recovery  
**Target State:** ✅ Fully automatic stream source reconnection with fallback to AutoDJ

---

## 1. Current Implementation Analysis

### 1.1 Existing Recovery Mechanisms ✅

#### **WebSocket Connection Recovery** ✅ **IMPLEMENTED**
- **Location:** `frontend/src/utils/WebSocketReconnectManager.js`
- **Features:**
  - Exponential backoff with jitter (1s → 30s max)
  - Max 10 reconnection attempts
  - Prevents thundering herd problem
- **Status:** Fully functional for WebSocket connections

#### **Health Monitoring System** ✅ **IMPLEMENTED**
- **Location:** `backend/src/main/java/com/wildcastradio/Broadcast/BroadcastService.java`
- **Features:**
  - Adaptive health check intervals (5s → 60s)
  - Consecutive unhealthy threshold (3 checks)
  - Startup grace period (60 seconds)
  - Health snapshot caching
- **Status:** Detects stream health issues effectively

#### **Radio Agent Integration** ✅ **IMPLEMENTED**
- **Location:** `backend/src/main/java/com/wildcastradio/radio/RadioAgentClient.java`
- **VM Agent:** Flask-based Python service on port 5000
- **Endpoints Available:**
  - `GET /status` - Check Liquidsoap service status
  - `POST /start` - Start Liquidsoap service
  - `POST /stop` - Stop Liquidsoap service
- **Status:** Basic control available, not integrated with recovery

### 1.2 Missing Recovery Mechanisms ❌

#### **Automatic Stream Source Reconnection** ❌ **NOT IMPLEMENTED**
- **Problem:** When DJ's audio source disconnects (browser crash, network issue), system detects unhealthy stream but requires manual intervention
- **Impact:** Broadcasts remain in "recovering" state indefinitely until DJ manually restarts streaming
- **Industry Standard Gap:** Professional radio systems automatically reconnect sources or switch to fallback

#### **Fallback Source Mechanism** ❌ **NOT IMPLEMENTED**
- **Problem:** No automatic fallback to AutoDJ/music playlist when DJ source fails
- **Impact:** Listeners experience dead air during source disconnections
- **Industry Standard Gap:** Icecast/Liquidsoap support fallback sources for seamless transitions

#### **Source Disconnection Detection** ⚠️ **PARTIAL**
- **Current:** Health checks detect unhealthy stream but don't distinguish between:
  - DJ source disconnection (can auto-recover)
  - Server-side issues (requires admin intervention)
  - Network issues (temporary, can wait)
- **Missing:** Intelligent source state tracking and disconnection classification

---

## 2. Industry Standards Comparison

### 2.1 Professional Radio Broadcasting Systems

| Feature | Industry Standard | WildCats Radio | Gap |
|---------|------------------|----------------|-----|
| **Auto-Reconnect Source** | Automatic reconnection with exponential backoff | Manual DJ intervention | ❌ Critical |
| **Fallback Source** | Automatic switch to backup/AutoDJ | No fallback mechanism | ❌ Critical |
| **Source State Tracking** | Real-time source connection state | Health check only | ⚠️ Medium |
| **Graceful Degradation** | Seamless transition to fallback | Dead air during disconnection | ❌ High |
| **Recovery Notification** | DJ notified of auto-recovery | No notification system | ⚠️ Medium |

### 2.2 Live Streaming Platforms (Twitch, YouTube Live)

| Feature | Industry Standard | WildCats Radio | Gap |
|---------|------------------|----------------|-----|
| **Stream Recovery** | Automatic reconnection attempts | Manual restart required | ❌ High |
| **Fallback Content** | Pre-recorded content during disconnection | Dead air | ❌ High |
| **State Persistence** | Stream state preserved across reconnections | State lost on disconnect | ⚠️ Medium |

---

## 3. Implementation Requirements

### 3.1 Functional Requirements

#### **FR-1: Automatic Source Reconnection**
- **Description:** System must automatically attempt to reconnect DJ's audio source when disconnection is detected
- **Priority:** HIGH
- **Acceptance Criteria:**
  - Reconnection attempts use exponential backoff (1s → 30s)
  - Maximum 5 reconnection attempts before fallback
  - DJ receives notification of reconnection attempts
  - Successful reconnection restores stream seamlessly

#### **FR-2: Fallback Source Mechanism**
- **Description:** System must automatically switch to AutoDJ/music playlist when DJ source cannot be recovered
- **Priority:** HIGH
- **Acceptance Criteria:**
  - Fallback activates after failed reconnection attempts
  - Seamless transition (no dead air)
  - DJ notified of fallback activation
  - DJ can manually override fallback when ready

#### **FR-3: Source State Classification**
- **Description:** System must distinguish between different types of disconnections
- **Priority:** MEDIUM
- **Acceptance Criteria:**
  - Classify: DJ source disconnect vs. server issue vs. network issue
  - Different recovery strategies for each type
  - Appropriate notifications for each scenario

#### **FR-4: Recovery State Persistence**
- **Description:** System must preserve broadcast state during recovery attempts
- **Priority:** MEDIUM
- **Acceptance Criteria:**
  - Broadcast remains LIVE during recovery
  - Duration tracking continues
  - Listener count preserved
  - Chat/polls remain active

### 3.2 Non-Functional Requirements

#### **NFR-1: Performance**
- Recovery attempts must not impact ongoing broadcasts
- Health checks must remain responsive (< 5s detection time)
- Fallback activation must be seamless (< 2s transition)

#### **NFR-2: Reliability**
- Recovery mechanism must not cause false positives
- Must handle concurrent recovery attempts gracefully
- Must prevent infinite recovery loops

#### **NFR-3: User Experience**
- DJ must be informed of all recovery actions
- Listeners should experience minimal disruption
- Recovery should be transparent when possible

---

## 4. Technical Architecture

### 4.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Recovery System Architecture              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────┐
│  Health Monitor │────────▶│ Source State      │
│  (Existing)     │         │ Classifier        │
└─────────────────┘         └──────────────────┘
         │                           │
         │                           ▼
         │                  ┌──────────────────┐
         │                  │ Recovery          │
         │                  │ Orchestrator      │
         │                  └──────────────────┘
         │                           │
         │                           ├──▶ Reconnection Manager
         │                           │    (Exponential Backoff)
         │                           │
         │                           ├──▶ Fallback Manager
         │                           │    (AutoDJ Activation)
         │                           │
         │                           └──▶ Notification Service
         │                                (DJ Alerts)
         │
         ▼
┌─────────────────┐         ┌──────────────────┐
│  Radio Agent    │◀────────│ Broadcast Service │
│  (VM Control)   │         │ (Backend)        │
└─────────────────┘         └──────────────────┘
```

### 4.2 Component Responsibilities

#### **Source State Classifier**
- **Purpose:** Analyze health check data to determine disconnection type
- **Input:** Health check results, Icecast mount status, Radio Agent status
- **Output:** Disconnection classification (DJ source, server, network)
- **Location:** `backend/src/main/java/com/wildcastradio/Broadcast/SourceStateClassifier.java` (NEW)

#### **Recovery Orchestrator**
- **Purpose:** Coordinate recovery attempts based on classification
- **Responsibilities:**
  - Decide recovery strategy
  - Manage recovery state machine
  - Coordinate with reconnection and fallback managers
- **Location:** `backend/src/main/java/com/wildcastradio/Broadcast/RecoveryOrchestrator.java` (NEW)

#### **Reconnection Manager**
- **Purpose:** Handle automatic DJ source reconnection attempts
- **Responsibilities:**
  - Exponential backoff scheduling
  - Reconnection attempt tracking
  - Success/failure detection
- **Location:** `backend/src/main/java/com/wildcastradio/Broadcast/ReconnectionManager.java` (NEW)

#### **Fallback Manager**
- **Purpose:** Manage fallback to AutoDJ when source cannot be recovered
- **Responsibilities:**
  - Activate AutoDJ source
  - Monitor for DJ source return
  - Handle fallback override
- **Location:** `backend/src/main/java/com/wildcastradio/Broadcast/FallbackManager.java` (NEW)

---

## 5. Implementation Plan

### Phase 1: Source State Classification (Week 1) ✅ **COMPLETED**

**Status:** ✅ **COMPLETED** - January 2025

#### **Step 1.1: Create SourceStateClassifier** ✅ **COMPLETED**
```java
public enum SourceDisconnectionType {
    DJ_SOURCE_DISCONNECTED,  // DJ's audio upload stopped
    SERVER_ISSUE,            // Liquidsoap/Icecast problem
    NETWORK_ISSUE,           // Temporary network problem
    UNKNOWN                  // Cannot determine
}

@Component
public class SourceStateClassifier {
    public SourceDisconnectionType classify(
        Map<String, Object> healthCheck,
        boolean icecastReachable,
        boolean liquidsoapRunning,
        boolean mountPointExists,
        boolean hasActiveSource,
        int bitrate
    ) {
        // Classification logic implemented
    }
}
```

**Features Implemented:**
- ✅ `SourceDisconnectionType` enum with helper methods (`supportsAutomaticRecovery()`, `requiresAdminIntervention()`)
- ✅ `SourceStateClassifier` component with comprehensive classification logic
- ✅ Graceful degradation when Radio Agent unavailable
- ✅ Configuration support (`broadcast.recovery.classification.enabled`)

#### **Step 1.2: Enhance Health Check with Source State** ✅ **COMPLETED**
- ✅ Source disconnection type classification integrated into health checks
- ✅ Disconnection type included in health snapshot for unhealthy streams
- ✅ Disconnection type included in audit logs when health check fails
- ✅ Enhanced logging with disconnection type information

#### **Deliverables:** ✅ **ALL COMPLETED**
- ✅ `SourceDisconnectionType.java` enum created
- ✅ `SourceStateClassifier.java` component created
- ✅ Enhanced health check with source state tracking
- ✅ Integration into `BroadcastService.java`
- ✅ Configuration properties added to `application.properties`
- ✅ Comprehensive unit tests (`SourceStateClassifierTest.java`) with 10+ test cases

**Files Created/Modified:**
- `backend/src/main/java/com/wildcastradio/Broadcast/SourceDisconnectionType.java` (NEW)
- `backend/src/main/java/com/wildcastradio/Broadcast/SourceStateClassifier.java` (NEW)
- `backend/src/main/java/com/wildcastradio/Broadcast/BroadcastService.java` (MODIFIED)
- `backend/src/main/resources/application.properties` (MODIFIED)
- `backend/src/test/java/com/wildcastradio/Broadcast/SourceStateClassifierTest.java` (NEW)

---

### Phase 2: Reconnection Manager (Week 2)

#### **Step 2.1: Create ReconnectionManager**
```java
@Component
public class ReconnectionManager {
    private final ScheduledExecutorService scheduler;
    private final Map<Long, ReconnectionAttempt> activeAttempts = new ConcurrentHashMap<>();
    
    public void attemptReconnection(Long broadcastId, UserEntity dj) {
        // Exponential backoff reconnection logic
        // Notify DJ of attempts
        // Track attempt count
    }
    
    private class ReconnectionAttempt {
        private int attemptCount = 0;
        private LocalDateTime lastAttempt;
        private static final int MAX_ATTEMPTS = 5;
        private static final long BASE_DELAY_MS = 1000; // 1 second
        private static final long MAX_DELAY_MS = 30000;  // 30 seconds
    }
}
```

#### **Step 2.2: Integrate with DJ WebSocket**
- Detect when DJ WebSocket reconnects
- Trigger reconnection attempt automatically
- Verify audio source is actually streaming

#### **Step 2.3: Frontend Reconnection Trigger**
- Add automatic reconnection prompt in DJ Dashboard
- "Your stream disconnected. Reconnecting..." notification
- Manual override option

#### **Deliverables:**
- ✅ `ReconnectionManager.java` component
- ✅ Exponential backoff implementation
- ✅ DJ notification system
- ✅ Frontend reconnection UI

---

### Phase 3: Fallback Manager (Week 3)

#### **Step 3.1: Create FallbackManager**
```java
@Component
public class FallbackManager {
    private final RadioAgentClient radioAgentClient;
    private final IcecastService icecastService;
    
    public void activateFallback(Long broadcastId) {
        // Switch Liquidsoap to AutoDJ source
        // Notify DJ of fallback activation
        // Monitor for DJ source return
    }
    
    public void deactivateFallback(Long broadcastId) {
        // Switch back to DJ source
        // Verify DJ source is active
    }
}
```

#### **Step 3.2: Radio Agent Enhancement**
**Update VM Agent (`radio_agent.py`) to support fallback:**
```python
@app.route('/fallback/activate', methods=['POST'])
def activate_fallback():
    # Switch Liquidsoap to AutoDJ playlist
    # Return success status
    pass

@app.route('/fallback/deactivate', methods=['POST'])
def deactivate_fallback():
    # Switch back to DJ source
    # Return success status
    pass
```

#### **Step 3.3: Liquidsoap Configuration**
- Configure fallback source in `radio.liq`
- Ensure seamless source switching
- Test fallback activation/deactivation

#### **Deliverables:**
- ✅ `FallbackManager.java` component
- ✅ Enhanced Radio Agent endpoints
- ✅ Liquidsoap fallback configuration
- ✅ Fallback activation/deactivation logic

---

### Phase 4: Recovery Orchestrator (Week 4)

#### **Step 4.1: Create RecoveryOrchestrator**
```java
@Component
public class RecoveryOrchestrator {
    private final SourceStateClassifier classifier;
    private final ReconnectionManager reconnectionManager;
    private final FallbackManager fallbackManager;
    private final NotificationService notificationService;
    
    public void handleDisconnection(Long broadcastId, Map<String, Object> healthCheck) {
        SourceDisconnectionType type = classifier.classify(healthCheck);
        
        switch (type) {
            case DJ_SOURCE_DISCONNECTED:
                reconnectionManager.attemptReconnection(broadcastId, dj);
                break;
            case SERVER_ISSUE:
                // Log for admin attention
                break;
            case NETWORK_ISSUE:
                // Wait and retry
                break;
        }
    }
}
```

#### **Step 4.2: Integrate with Health Check**
- Hook recovery orchestrator into health check failures
- Trigger recovery when consecutive unhealthy checks detected
- Prevent duplicate recovery attempts

#### **Step 4.3: Recovery State Machine**
```java
public enum RecoveryState {
    HEALTHY,
    DETECTING,        // Health check detected issue
    RECONNECTING,     // Attempting DJ source reconnection
    FALLBACK_ACTIVE,  // Using AutoDJ fallback
    MANUAL_INTERVENTION // Requires DJ/admin action
}
```

#### **Deliverables:**
- ✅ `RecoveryOrchestrator.java` component
- ✅ Integration with health check system
- ✅ Recovery state machine
- ✅ End-to-end recovery flow

---

### Phase 5: Frontend Integration (Week 5)

#### **Step 5.1: DJ Dashboard Recovery UI**
- Recovery status indicator
- Reconnection attempt notifications
- Fallback activation alerts
- Manual override controls

#### **Step 5.2: Recovery Notifications**
- Real-time WebSocket notifications for recovery events
- Toast notifications for recovery status
- Recovery history log

#### **Step 5.3: Listener Experience**
- Seamless transition (no dead air)
- Status indicator for fallback mode
- Recovery completion notification

#### **Deliverables:**
- ✅ DJ Dashboard recovery UI
- ✅ Recovery notification system
- ✅ Listener fallback indicators
- ✅ Recovery history display

---

## 6. Radio Agent Enhancement

### 6.1 Current Agent Capabilities

**Existing Endpoints:**
- `GET /status` - Check Liquidsoap status ✅
- `POST /start` - Start Liquidsoap service ✅
- `POST /stop` - Stop Liquidsoap service ✅

### 6.2 Required Enhancements

#### **New Endpoint: Activate Fallback**
```python
@app.route('/fallback/activate', methods=['POST'])
def activate_fallback():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if token != os.getenv('AGENT_TOKEN', 'hackme'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Switch Liquidsoap to AutoDJ source
    # This would involve sending command to Liquidsoap Harbor API
    # or modifying Liquidsoap configuration
    result = switch_to_autodj()
    
    return jsonify({
        'state': 'fallback_active',
        'detail': 'Switched to AutoDJ fallback source',
        'timestamp': datetime.now().isoformat()
    })
```

#### **New Endpoint: Deactivate Fallback**
```python
@app.route('/fallback/deactivate', methods=['POST'])
def deactivate_fallback():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if token != os.getenv('AGENT_TOKEN', 'hackme'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Switch back to DJ source
    result = switch_to_dj_source()
    
    return jsonify({
        'state': 'dj_source_active',
        'detail': 'Switched back to DJ source',
        'timestamp': datetime.now().isoformat()
    })
```

#### **New Endpoint: Source State**
```python
@app.route('/source/state', methods=['GET'])
def get_source_state():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if token != os.getenv('AGENT_TOKEN', 'hackme'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Check which source is currently active
    source_state = check_active_source()
    
    return jsonify({
        'active_source': source_state,  # 'dj' or 'autodj'
        'dj_source_connected': check_dj_source_connection(),
        'autodj_available': check_autodj_available(),
        'timestamp': datetime.now().isoformat()
    })
```

### 6.3 Liquidsoap Integration

**Liquidsoap Configuration (`radio.liq`) Enhancement:**
```liquidsoap
# Fallback source configuration
dj_source = input.harbor("dj", port=9000, password="hackme")
autodj_source = playlist("/path/to/fallback/playlist.m3u")

# Source switching logic
source = fallback([
    dj_source,      # Primary source
    autodj_source   # Fallback source
])

# Output to Icecast
output.icecast(
    %mp3,
    host="localhost",
    port=8000,
    password="hackme",
    mount="/live",
    source
)
```

---

## 7. Recovery Flow Diagrams

### 7.1 DJ Source Disconnection Flow

```
Health Check Detects Unhealthy Stream
         │
         ▼
Source State Classifier
         │
         ├─→ DJ_SOURCE_DISCONNECTED
         │         │
         │         ▼
         │   Reconnection Manager
         │         │
         │         ├─→ Attempt 1 (1s delay)
         │         ├─→ Attempt 2 (2s delay)
         │         ├─→ Attempt 3 (4s delay)
         │         ├─→ Attempt 4 (8s delay)
         │         └─→ Attempt 5 (16s delay)
         │
         │         ├─→ Success? → Restore DJ Source
         │         │
         │         └─→ Failure? → Fallback Manager
         │                           │
         │                           ▼
         │                       Activate AutoDJ
         │                           │
         │                           ▼
         │                       Monitor for DJ Return
         │                           │
         │                           ├─→ DJ Returns? → Switch Back
         │                           │
         │                           └─→ Continue Fallback
         │
         ├─→ SERVER_ISSUE → Log for Admin
         │
         └─→ NETWORK_ISSUE → Wait & Retry
```

### 7.2 Fallback Activation Flow

```
Reconnection Attempts Exhausted
         │
         ▼
Fallback Manager.activateFallback()
         │
         ├─→ Call Radio Agent: POST /fallback/activate
         │
         ├─→ Radio Agent switches Liquidsoap to AutoDJ
         │
         ├─→ Verify fallback is active
         │
         ├─→ Notify DJ via WebSocket
         │
         └─→ Start monitoring for DJ source return
                 │
                 ├─→ Health check detects DJ source?
                 │         │
                 │         ▼
                 │   Deactivate Fallback
                 │         │
                 │         ▼
                 │   Switch back to DJ source
                 │
                 └─→ Continue monitoring
```

---

## 8. Configuration Properties

### 8.1 Backend Configuration

**Add to `application.properties`:**
```properties
# Recovery Configuration
broadcast.recovery.enabled=true
broadcast.recovery.reconnection.enabled=true
broadcast.recovery.reconnection.maxAttempts=5
broadcast.recovery.reconnection.baseDelayMs=1000
broadcast.recovery.reconnection.maxDelayMs=30000

# Fallback Configuration
broadcast.recovery.fallback.enabled=true
broadcast.recovery.fallback.activateAfterFailedAttempts=5
broadcast.recovery.fallback.autodjPlaylistPath=/path/to/fallback/playlist.m3u

# Source State Classification
broadcast.recovery.classification.enabled=true
broadcast.recovery.classification.networkIssueTimeoutMs=30000
```

### 8.2 Radio Agent Configuration

**Environment Variables:**
```bash
AGENT_TOKEN=hackme
LIQUIDSOAP_HARBOR_PORT=9000
LIQUIDSOAP_HARBOR_PASSWORD=hackme
AUTODJ_PLAYLIST_PATH=/path/to/fallback/playlist.m3u
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

- **SourceStateClassifier Tests:**
  - Test each disconnection type classification
  - Test edge cases (partial data, null values)
  - Test classification accuracy

- **ReconnectionManager Tests:**
  - Test exponential backoff calculation
  - Test max attempts enforcement
  - Test concurrent reconnection attempts

- **FallbackManager Tests:**
  - Test fallback activation
  - Test fallback deactivation
  - Test fallback state persistence

### 9.2 Integration Tests

- **End-to-End Recovery Flow:**
  - Simulate DJ source disconnection
  - Verify reconnection attempts
  - Verify fallback activation
  - Verify DJ source restoration

- **Radio Agent Integration:**
  - Test fallback endpoint calls
  - Test source state endpoint
  - Test error handling

### 9.3 Manual Testing Scenarios

1. **DJ Browser Crash:**
   - Start broadcast
   - Close browser abruptly
   - Verify automatic reconnection attempts
   - Verify fallback activation if reconnection fails

2. **Network Disconnection:**
   - Start broadcast
   - Disconnect DJ's network
   - Verify classification as network issue
   - Verify appropriate recovery strategy

3. **Server-Side Issue:**
   - Stop Liquidsoap service
   - Verify classification as server issue
   - Verify no automatic recovery (admin intervention required)

---

## 10. Monitoring & Observability

### 10.1 Metrics to Track

- **Recovery Attempts:**
  - Number of reconnection attempts per broadcast
  - Success rate of reconnection attempts
  - Average time to successful reconnection

- **Fallback Usage:**
  - Number of fallback activations
  - Duration of fallback usage
  - DJ source restoration rate

- **Disconnection Classification:**
  - Distribution of disconnection types
  - Classification accuracy

### 10.2 Logging

**Key Events to Log:**
- Source disconnection detected
- Disconnection type classification
- Reconnection attempt started/completed/failed
- Fallback activation/deactivation
- DJ source restoration

**Log Format:**
```json
{
  "timestamp": "2025-01-XX...",
  "event": "RECONNECTION_ATTEMPT",
  "broadcastId": 123,
  "attemptNumber": 3,
  "delayMs": 4000,
  "result": "SUCCESS"
}
```

---

## 11. Risk Assessment

### 11.1 Potential Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| False positive recovery attempts | Medium | Medium | Implement conservative classification thresholds |
| Fallback activation during temporary network blip | Low | Low | Add network issue detection with timeout |
| Infinite recovery loop | High | Low | Implement max recovery attempts and circuit breaker |
| Fallback not activating when needed | High | Medium | Comprehensive testing and monitoring |
| DJ source restoration failure | Medium | Medium | Manual override option always available |

### 11.2 Rollback Plan

- Feature flag to disable recovery mechanism
- Gradual rollout (10% → 50% → 100%)
- Monitor metrics closely during rollout
- Quick disable if issues detected

---

## 12. Success Criteria

### 12.1 Functional Success

- ✅ Automatic reconnection attempts for DJ source disconnections
- ✅ Fallback activation after failed reconnection attempts
- ✅ Seamless transition (no dead air for listeners)
- ✅ DJ notifications for all recovery actions
- ✅ Manual override available at all times

### 12.2 Performance Success

- ✅ Recovery detection < 5 seconds
- ✅ Fallback activation < 2 seconds
- ✅ No impact on healthy broadcasts
- ✅ < 1% false positive rate

### 12.3 User Experience Success

- ✅ DJ satisfaction: Reduced manual intervention by 90%
- ✅ Listener satisfaction: No dead air during disconnections
- ✅ Recovery transparency: DJ always informed of actions

---

## 13. Implementation Timeline

| Phase | Duration | Dependencies | Deliverables |
|-------|----------|--------------|-------------|
| Phase 1: Source State Classification | 1 week | None | Classifier component, enhanced health checks |
| Phase 2: Reconnection Manager | 1 week | Phase 1 | Reconnection manager, frontend UI |
| Phase 3: Fallback Manager | 1 week | Phase 1 | Fallback manager, Radio Agent enhancements |
| Phase 4: Recovery Orchestrator | 1 week | Phases 1-3 | Orchestrator, integration |
| Phase 5: Frontend Integration | 1 week | Phases 1-4 | UI components, notifications |
| **Total** | **5 weeks** | | **Complete recovery system** |

---

## 14. Dependencies

### 14.1 External Dependencies

- **Radio Agent (VM):** Must support fallback endpoints
- **Liquidsoap:** Must be configured with fallback source
- **Icecast:** Must support seamless source switching

### 14.2 Internal Dependencies

- **Health Check System:** Must provide detailed source state
- **WebSocket System:** Must support recovery notifications
- **Notification Service:** Must support DJ alerts

---

## 15. Future Enhancements

### 15.1 Advanced Features

1. **Predictive Recovery:**
   - Machine learning to predict disconnections
   - Proactive fallback activation

2. **Multi-Source Fallback:**
   - Multiple fallback sources (playlist → pre-recorded → silence)
   - Priority-based fallback selection

3. **Recovery Analytics:**
   - Detailed recovery metrics dashboard
   - Disconnection pattern analysis
   - Predictive maintenance alerts

### 15.2 Integration Opportunities

- **Monitoring Systems:** Integrate with Prometheus/Grafana
- **Alerting:** Integrate with PagerDuty/Slack
- **Analytics:** Enhanced recovery analytics dashboard

---

## 16. Conclusion

This implementation plan provides a comprehensive approach to achieving **fully automatic stream source recovery** with fallback mechanisms. The phased approach ensures incremental delivery while maintaining system stability.

**Key Benefits:**
- ✅ Eliminates manual DJ intervention for common disconnections
- ✅ Provides seamless listener experience with fallback
- ✅ Reduces broadcast downtime significantly
- ✅ Aligns with industry standards for professional radio systems

**Next Steps:**
1. Review and approve this implementation plan
2. Begin Phase 1: Source State Classification
3. Set up development environment for Radio Agent enhancements
4. Create feature branch for recovery implementation

---

**Document Status:** Ready for Implementation  
**Last Updated:** January 2025  
**Author:** System Architecture Team  
**Review Status:** Pending Approval

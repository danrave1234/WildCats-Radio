# System Architecture Decision: Redis & Single-Instance Scaling
**Date:** March 2026
**Component:** Backend Real-time Capabilities (WebSockets & Telemetry)

## Background & Challenge
WildCats Radio utilizes Spring WebSockets (STOMP multiplexing) and background Scheduled Tasks (via `@Scheduled`) to deliver an ultra-low latency, real-time live broadcasting experience to listeners.

During Cloud Run deployment evaluations, a critical issue was discovered regarding autoscaling:
- **In-Memory WebSockets:** WebSockets operate in the local RAM of individual containers.
- **Fragmented Sessions:** If Cloud Run scales to 2+ instances, listeners are fragmented across instances, causing inconsistent chat, polls, and active listener counts.
- **Redundant Tasks:** Background tasks, such as broadcast state checkpointing and health checks, would execute simultaneously across all instances, causing database lock contention and duplicate work.

## The Chosen Architecture: "Option B"
To achieve absolute data safety while strictly keeping cloud costs to a minimum, the following architectural topology was implemented:

### 1. Max Instances = 1 (Zero-Cost Latency Optimization)
The Cloud Run deployment is strictly limited to `max-instances=1`. 
* **Why:** A single 1 CPU / 512MB container can easily handle < 50 concurrent WebSockets. 
* **Benefit:** By keeping WebSockets strictly in-memory (and avoiding a distributed external STOMP message broker), we guarantee the lowest possible latency for live chat and audio signaling, and we completely eliminate cloud network egress charges (which would occur if we routed all chat messages through an external database).

### 2. Redis ShedLock (Deployment & Task Resilience)
Despite limiting instances to 1, Cloud Run occasionally boots a second temporary instance during **Rolling Deployments**. If both instances are active, they will simultaneously execute `@Scheduled` database queries.
* **Solution:** We integrated **ShedLock** with an external free-tier `redis.io` instance.
* **How It Works:** Before any `@Scheduled` task executes, the server attempts to acquire a lock in Redis. If a lock is held by another instance, the task immediately yields. 

### 3. Redis Persistent Session Tracking
Listener sessions and connection telemetry are saved directly to Redis instead of local JVM Memory maps (`ConcurrentHashMap`).
* **Why:** If the server crashes or scales down, in-memory maps are wiped. By storing session footprints in Redis with a 60-second Time-to-Live (TTL), the application guarantees that listener counts and presence tracking automatically carry over whenever the server re-initializes. 
* **Safety Protocol:** Because the Redis server is shared with other student projects, **ALL** keys created by WildCats Radio are strictly prefixed with `wildcats:` (e.g., `wildcats:session:{id}`, `wildcats:job-lock`).

### 4. REST Endpoint Caching (Optimized Read Paths)
To boost performance and reduce Postgres queries on highly requested public routes, Spring's `@EnableCaching` is active.
* **Cached Endpoints:** 
  1. Announcements (Public list and individual IDs) are cached on `GET`. The cache automatically evicts globally whenever a DJ/Mod creates/edits/pins/archives an announcement.
  2. Upcoming Broadcast Schedules are cached on `GET`. The cache heavily mitigates database load on the landing page, and automatically evicts globally whenever a broadcast is scheduled, started, or edited.
* **Excluded Endpoints:** Highly dynamic telemetry (Chat Messages, Poll Votes, Live Listeners) are explicitly **bypassed** from Redis HTTP caching to guarantee real-time integrity via WebSockets.

## Operational Guidelines
### Environment Variables
To get the application to connect to the Redis instance, you need to add the following environment variables to your Cloud Run deployment and your local environment (if running locally):
```bash
REDIS_HOST=redis-xxxxx.cloud.redislabs.com  # The Endpoint without the port
REDIS_PORT=12345                            # The Port number
REDIS_USERNAME=default                      # Usually "default" or your specific username
REDIS_PASSWORD=your_redis_password          # The password/auth string
SPRING_REDIS_SSL=true                       # Required for secure cloud connections
```

### Future Scaling Contingencies
If the application ever needs to scale beyond ~2,000 concurrent listeners, the architectural path forward is clear:
1. Increase `max-instances` to `10`.
2. Replace `enableSimpleBroker()` in `WebSocketMessageConfig.java` with Spring's Native STOMP Redis Pub/Sub relay.
*(Notice that Session Tracking and ShedLock will already be completely ready for this future enhancement).*

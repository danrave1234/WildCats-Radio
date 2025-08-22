# WildCats-Radio

## Table of Contents

1. [Project Overview](#project-overview)  
2. [Features](#features)  
   - [Functional Requirements](#functional-requirements)  
   - [Non-Functional Requirements](#non-functional-requirements)  
   - [Constraints](#constraints)  
3. [System Architecture](#system-architecture)  
4. [Technology Stack](#technology-stack)  
5. [API Overview](#api-overview)  
6. [Deployment & Configuration](#deployment--configuration)  
7. [Contribution Guidelines](#contribution-guidelines)  
8. [References (SRS, SDD, SPMP)](#references-srs-sdd-spmp)  
9. [Contact & Ownership](#contact--ownership)  

---

## Project Overview

**WildCats-Radio** is a full-stack, cross-platform radio streaming application designed for live audio broadcasting, interactive listener engagement, and comprehensive analytics. The system supports web, mobile, and admin interfaces, providing features such as live streaming, chat, song requests, polls, notifications, and broadcast management. The backend is built with Java Spring Boot, while the frontend uses React and React Native for mobile.

---

## Features

### Functional Requirements

- **Live Radio Streaming:**  
  Users can listen to live radio streams via web and mobile interfaces.

- **Audio Player:**  
  Integrated web audio player with play, pause, and volume controls.

- **Audio Source Selection:**  
  Users can select from multiple audio sources.

- **Mobile App Support:**  
  Native-like experience via React Native mobile app.

- **User Authentication:**  
  Secure login, registration, password change, and (optionally) Google OAuth.

- **Song Requests:**  
  Listeners can request songs through a dedicated form.

- **Admin Song Request Management:**  
  Admins can view, approve, or reject song requests.

- **Live Chat:**  
  Real-time chat for listeners, with moderation tools (ban, profanity filter, slow mode).

- **Polls:**  
  Interactive polls during broadcasts for listener engagement.

- **Notifications:**  
  System and broadcast notifications sent to users.

- **Broadcast Scheduling:**  
  Admins can schedule upcoming broadcasts.

- **Broadcast History:**  
  Users can view past broadcasts and their details.

- **Analytics Dashboard:**  
  Admins can view listener statistics, chat activity, and other analytics.

- **Activity Logging:**  
  System logs user and system activities for auditing and analytics.

- **Ad Integration:**  
  Support for ad display (e.g., Google AdSense).

---

### Non-Functional Requirements

- **Performance:**  
  Support for at least 100 concurrent listeners with low-latency streaming.

- **Scalability:**  
  Designed to scale horizontally for increased listener load.

- **Security:**  
  All communications over HTTPS; secure authentication and authorization.

- **Responsiveness:**  
  Fully responsive UI for desktop, tablet, and mobile.

- **Accessibility:**  
  Meets accessibility standards for visually impaired users.

- **Reliability:**  
  High availability and fault tolerance for streaming and chat.

- **Maintainability:**  
  Modular codebase with clear separation of concerns.

- **Documentation:**  
  Comprehensive documentation for deployment, development, and usage.

---

### Constraints

- **Deployment:**  
  Must be deployable to Google Cloud Platform (GCP) using Docker.

- **Database:**  
  Uses a persistent SQL database (configured in `application.properties`).

- **Open Source Libraries:**  
  Only approved open-source libraries and frameworks are used.

- **Compliance:**  
  Must comply with relevant data privacy and copyright laws.

---

## System Architecture

```mermaid
graph TD
  A[User (Web/Mobile)] -->|HTTP/WebSocket| B(Frontend React/React Native)
  B -->|REST API/WebSocket| C(Backend Spring Boot)
  C -->|JPA/Hibernate| D[(SQL Database)]
  C -->|Icecast Protocol| E[Icecast Server]
  C -->|Analytics| F[Analytics Dashboard]
  C -->|Notifications| G[Notification Service]
  C -->|Admin| H[Admin Dashboard]
```

- **Frontend:** React (web), React Native (mobile)
- **Backend:** Java Spring Boot (REST API, WebSocket, business logic)
- **Streaming:** Icecast server for audio streaming
- **Database:** SQL (e.g., MySQL, PostgreSQL)
- **Admin Tools:** Analytics, broadcast management, moderation

---

## Technology Stack

- **Frontend:**  
  - React (web)  
  - React Native (mobile)  
  - Tailwind CSS  
  - WebSocket for real-time features

- **Backend:**  
  - Java Spring Boot  
  - JPA/Hibernate  
  - RESTful API  
  - WebSocket (chat, notifications)

- **Streaming:**  
  - Icecast

- **Database:**  
  - SQL (MySQL/PostgreSQL, configurable)

- **DevOps:**  
  - Docker  
  - Google Cloud Platform (GCP)  
  - Vercel (optional for frontend)

---

## API Overview

### Authentication

- `POST /api/auth/login` – User login  
- `POST /api/auth/register` – User registration  
- `POST /api/auth/change-password` – Change password  
- `POST /api/auth/google` – Google OAuth login

### Streaming

- `GET /api/stream/live` – Get live stream URL  
- `GET /api/stream/history` – Get broadcast history

### Song Requests

- `POST /api/song-request` – Submit song request  
- `GET /api/song-request` – List song requests (admin)

### Chat

- `GET /api/chat/messages` – Fetch chat messages  
- `POST /api/chat/message` – Send chat message  
- `POST /api/chat/ban` – Ban user  
- `POST /api/chat/slowmode` – Enable/disable slow mode

### Polls

- `POST /api/poll` – Create poll  
- `GET /api/poll` – List active polls  
- `POST /api/poll/vote` – Vote in poll

### Notifications

- `GET /api/notifications` – Fetch notifications  
- `POST /api/notifications` – Send notification (admin)

### Analytics

- `GET /api/analytics` – Fetch analytics data

*See backend `controller/` and `services/api/` for full API details.*

---

## Deployment & Configuration

### Prerequisites

- Docker
- Java 17+
- Node.js 18+
- Google Cloud account (for production deployment)

### Backend

1. Configure database in `backend/src/main/resources/application.properties`.
2. Build and run with Docker:
   ```sh
   cd backend
   docker build -t wildcats-radio-backend .
   docker run -p 8080:8080 wildcats-radio-backend
   ```

### Frontend

1. Install dependencies:
   ```sh
   cd frontend
   npm install
   ```
2. Start development server:
   ```sh
   npm run dev
   ```

### Mobile

1. Install dependencies:
   ```sh
   cd mobile
   npm install
   ```
2. Run on emulator/device:
   ```sh
   npx expo start
   ```

### Icecast

- Configure and run Icecast server using `Icecast/icecast.xml`.

### Environment Variables

- See `frontend/src/config.js` and `backend/application.properties` for environment-specific settings.

---

## Contribution Guidelines

- Fork the repository and create a feature branch.
- Follow code style guidelines (see `.eslintrc`, `eslint.config.js`).
- Write clear commit messages.
- Add/Update documentation for new features.
- Submit a pull request for review.

---

## References (SRS, SDD, SPMP)

### SRS (Software Requirements Specification)

- **Functional Requirements:** See [Features](#features)
- **Non-Functional Requirements:** See [Non-Functional Requirements](#non-functional-requirements)
- **Constraints:** See [Constraints](#constraints)
- **Use Cases:**  
  - Listen to live radio  
  - Request a song  
  - Participate in chat  
  - Vote in polls  
  - Administer broadcasts

### SDD (Software Design Document)

- **Architecture:** See [System Architecture](#system-architecture)
- **Component Design:**  
  - Frontend: Components in `frontend/src/components/`  
  - Backend: Controllers, Services, Entities in `backend/src/main/java/com/wildcastradio/`
- **Database Design:**  
  - See `schema.sql`
- **API Design:**  
  - See [API Overview](#api-overview)

### SPMP (Software Project Management Plan)

- **Milestones:**  
  - MVP: Live streaming, chat, song requests  
  - v1.0: Admin dashboard, analytics, notifications  
  - v2.0: Mobile app, advanced analytics, ad integration
- **Team Roles:**  
  - Frontend Developer  
  - Backend Developer  
  - Mobile Developer  
  - DevOps  
  - QA/Testing
- **Risks:**  
  - Streaming reliability  
  - Scalability under load  
  - Data privacy compliance

---

## Contact & Ownership

- **Project Lead:** [Your Name/Team]
- **Email:** [your@email.com]
- **GitHub:** [repo link]
- **Documentation:**  
  - See `/ANALYTICS_DASHBOARD_README.md`, `/DEPLOY_TO_GCP.md`, `/ROADMAP.md`, etc.

---

**This documentation is intended to serve as a single source of truth for all stakeholders, including developers, testers, project managers, and clients.**
If you need this in a specific format (Markdown, PDF, Word), or want a more detailed breakdown for any section (e.g., use cases, sequence diagrams, database schema), just let us know!

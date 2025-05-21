# WildCats Radio

A full-featured radio broadcasting platform for college radio stations.

## Overview

WildCats Radio is a comprehensive web application that allows college radio stations to manage and broadcast live shows, schedule automatic broadcasts, and engage with listeners through chat, polls, and song requests.

The application consists of:

- **Frontend**: React.js web application for administrators, DJs, and listeners
- **Backend**: Spring Boot Java application providing the API and services
- **ShoutCast**: ShoutCast DNAS Server for audio streaming

## Key Features

- Live audio broadcasting for DJs
- Audio streaming to listeners
- User management (Admins, DJs, and Listeners)
- Broadcast scheduling
- Live chat
- Song requests and track history
- Polls and listener engagement tools
- Server scheduling for automated broadcasts

## Setup

### Requirements

- Java 17 or later
- Node.js 16 or later
- npm or yarn
- ShoutCast DNAS Server (included in the project)
- MySQL or compatible database

### Backend Setup

1. Configure database settings in `backend/src/main/resources/application.properties`
2. Build the backend:
   ```
   cd backend
   ./mvnw clean package
   ```
3. Run the Spring Boot application:
   ```
   ./mvnw spring-boot:run
   ```

### Frontend Setup

1. Install dependencies:
   ```
   cd frontend
   npm install
   ```
2. Run the development server:
   ```
   npm run dev
   ```

### ShoutCast Server Setup

1. The ShoutCast DNAS Server is included in the `ShoutcastV2` directory
2. Start the server using the scripts:
   ```
   # Windows
   start-shoutcast.bat
   
   # Manual start
   cd ShoutcastV2
   sc_serv.exe sc_serv.conf
   ```
3. For detailed setup information, see [README-shoutcast.md](README-shoutcast.md)

## Documentation

- [Broadcasting Documentation](README-broadcasting.md) - How to broadcast as a DJ
- [ShoutCast Documentation](README-shoutcast.md) - ShoutCast server setup and configuration
- [ShoutCast DNAS API References](markdown%20documentation/) - ShoutCast server documentation

## Architecture

The system uses a multi-tier architecture:

- **Frontend**: React.js SPA with responsive design for all device types
- **Backend**: Spring Boot REST API with WebSocket support for real-time features
- **Audio Streaming**: ShoutCast DNAS Server handles audio streaming to listeners
- **Database**: Stores user data, broadcast schedules, messages, etc.

### Communication Flow

1. DJs connect to the server via WebSocket to send audio
2. The backend processes and forwards the audio to the ShoutCast server
3. Listeners connect to the ShoutCast server to receive the audio stream
4. Real-time chat and interaction happens directly through the backend WebSocket

## Configuration

### Backend

Key configuration files:
- `backend/src/main/resources/application.properties` - Main configuration
- `backend/src/main/resources/application-dev.properties` - Development environment

### ShoutCast

- `ShoutcastV2/sc_serv.conf` - ShoutCast server configuration

## Monitoring

The admin dashboard provides monitoring for:

1. Active broadcasts
2. Server status
3. ShoutCast server diagnostics
4. User activity
5. Server logs

## Screenshots

*Screenshots will be added here*

## License

*Add license information*

## Contributors

*Add contributor information* 
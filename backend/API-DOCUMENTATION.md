# WildCats Radio API Documentation

This document provides a comprehensive overview of the RESTful APIs available in the WildCats Radio backend.

## Table of Contents

- [Authentication](#authentication)
- [Broadcasts](#broadcasts)
- [Chat Messages](#chat-messages)
- [Song Requests](#song-requests)
- [Polls](#polls)
- [Notifications](#notifications)
- [Streaming Configuration](#streaming-configuration)
- [Server Schedules](#server-schedules)
- [ShoutCast Integration](#shoutcast-integration)

## Authentication

Base URL: `/api/auth`

### Register

```
POST /api/auth/register
```

Register a new user account.

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "id": "number",
  "name": "string",
  "email": "string",
  "role": "string"
}
```

### Login

```
POST /api/auth/login
```

Authenticate a user and get an access token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "string",
  "user": {
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "string"
  }
}
```

### Verify Email

```
POST /api/auth/verify
```

Verify a user's email address with a verification code.

**Query Parameters:**
- `email` (string, required): User's email address
- `code` (string, required): Verification code

**Response:**
```
Email verified successfully
```

### Send Verification Code

```
POST /api/auth/send-code
```

Send a verification code to the user's email address.

**Query Parameters:**
- `email` (string, required): User's email address

**Response:**
```
Verification code sent to [email]
```

## Broadcasts

Base URL: `/api/broadcasts`

### Create Broadcast

```
POST /api/broadcasts
```

Create a new broadcast schedule.

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "scheduledStart": "ISO-8601 date string",
  "scheduledEnd": "ISO-8601 date string",
  "djId": "number"
}
```

**Response:**
```json
{
  "id": "number",
  "title": "string",
  "description": "string",
  "scheduledStart": "ISO-8601 date string",
  "scheduledEnd": "ISO-8601 date string",
  "actualStart": "ISO-8601 date string",
  "actualEnd": "ISO-8601 date string",
  "status": "string",
  "dj": {
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "string"
  }
}
```

### Get All Broadcasts

```
GET /api/broadcasts
```

Get a list of all broadcasts.

**Response:**
```json
[
  {
    "id": "number",
    "title": "string",
    "description": "string",
    "scheduledStart": "ISO-8601 date string",
    "scheduledEnd": "ISO-8601 date string",
    "actualStart": "ISO-8601 date string",
    "actualEnd": "ISO-8601 date string",
    "status": "string",
    "dj": {
      "id": "number",
      "name": "string",
      "email": "string",
      "role": "string"
    }
  }
]
```

### Get Broadcast by ID

```
GET /api/broadcasts/{id}
```

Get details of a specific broadcast.

**Path Parameters:**
- `id` (number, required): Broadcast ID

**Response:**
```json
{
  "id": "number",
  "title": "string",
  "description": "string",
  "scheduledStart": "ISO-8601 date string",
  "scheduledEnd": "ISO-8601 date string",
  "actualStart": "ISO-8601 date string",
  "actualEnd": "ISO-8601 date string",
  "status": "string",
  "dj": {
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "string"
  }
}
```

### Update Broadcast

```
PUT /api/broadcasts/{id}
```

Update an existing broadcast.

**Path Parameters:**
- `id` (number, required): Broadcast ID

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "scheduledStart": "ISO-8601 date string",
  "scheduledEnd": "ISO-8601 date string",
  "djId": "number"
}
```

**Response:**
```json
{
  "id": "number",
  "title": "string",
  "description": "string",
  "scheduledStart": "ISO-8601 date string",
  "scheduledEnd": "ISO-8601 date string",
  "actualStart": "ISO-8601 date string",
  "actualEnd": "ISO-8601 date string",
  "status": "string",
  "dj": {
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "string"
  }
}
```

### Delete Broadcast

```
DELETE /api/broadcasts/{id}
```

Delete a broadcast.

**Path Parameters:**
- `id` (number, required): Broadcast ID

**Response:**
- `204 No Content`

### End Broadcast

```
POST /api/broadcasts/{id}/end
```

End an ongoing broadcast.

**Path Parameters:**
- `id` (number, required): Broadcast ID

**Response:**
```json
{
  "id": "number",
  "title": "string",
  "description": "string",
  "scheduledStart": "ISO-8601 date string",
  "scheduledEnd": "ISO-8601 date string",
  "actualStart": "ISO-8601 date string",
  "actualEnd": "ISO-8601 date string",
  "status": "string",
  "dj": {
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "string"
  }
}
```

### Get Upcoming Broadcasts

```
GET /api/broadcasts/upcoming
```

Get a list of upcoming broadcasts.

**Response:**
```json
[
  {
    "id": "number",
    "title": "string",
    "description": "string",
    "scheduledStart": "ISO-8601 date string",
    "scheduledEnd": "ISO-8601 date string",
    "status": "string",
    "dj": {
      "id": "number",
      "name": "string",
      "email": "string",
      "role": "string"
    }
  }
]
```

### Get Live Broadcasts

```
GET /api/broadcasts/live
```

Get a list of currently live broadcasts.

**Response:**
```json
[
  {
    "id": "number",
    "title": "string",
    "description": "string",
    "scheduledStart": "ISO-8601 date string",
    "scheduledEnd": "ISO-8601 date string",
    "actualStart": "ISO-8601 date string",
    "status": "string",
    "dj": {
      "id": "number",
      "name": "string",
      "email": "string",
      "role": "string"
    }
  }
]
```

## Chat Messages

Base URL: `/api/chats`

### Get Messages for Broadcast

```
GET /api/chats/{broadcastId}
```

Get all chat messages for a specific broadcast.

**Path Parameters:**
- `broadcastId` (number, required): Broadcast ID

**Response:**
```json
[
  {
    "id": "number",
    "content": "string",
    "timestamp": "ISO-8601 date string",
    "sender": {
      "id": "number",
      "name": "string",
      "email": "string",
      "role": "string"
    },
    "broadcastId": "number"
  }
]
```

### Send Message

```
POST /api/chats/{broadcastId}
```

Send a new chat message in a broadcast.

**Path Parameters:**
- `broadcastId` (number, required): Broadcast ID

**Request Body:**
```json
{
  "content": "string"
}
```

**Response:**
```json
{
  "id": "number",
  "content": "string",
  "timestamp": "ISO-8601 date string",
  "sender": {
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "string"
  },
  "broadcastId": "number"
}
```

## Song Requests

Base URL: `/api/broadcasts/{broadcastId}/song-requests`

### Create Song Request

```
POST /api/broadcasts/{broadcastId}/song-requests
```

Create a new song request for a broadcast.

**Path Parameters:**
- `broadcastId` (number, required): Broadcast ID

**Request Body:**
```json
{
  "songTitle": "string",
  "artist": "string"
}
```

**Response:**
```json
{
  "id": "number",
  "songTitle": "string",
  "artist": "string",
  "timestamp": "ISO-8601 date string",
  "requestedBy": {
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "string"
  },
  "broadcastId": "number"
}
```

### Get Song Requests for Broadcast

```
GET /api/broadcasts/{broadcastId}/song-requests
```

Get all song requests for a specific broadcast.

**Path Parameters:**
- `broadcastId` (number, required): Broadcast ID

**Response:**
```json
[
  {
    "id": "number",
    "songTitle": "string",
    "artist": "string",
    "timestamp": "ISO-8601 date string",
    "requestedBy": {
      "id": "number",
      "name": "string",
      "email": "string",
      "role": "string"
    },
    "broadcastId": "number"
  }
]
```

## Polls

Base URL: `/api/polls`

### Create Poll

```
POST /api/polls
```

Create a new poll (DJ or ADMIN only).

**Request Body:**
```json
{
  "question": "string",
  "options": ["string", "string", ...],
  "broadcastId": "number",
  "expiresAt": "ISO-8601 date string"
}
```

**Response:**
```json
{
  "id": "number",
  "question": "string",
  "options": [
    {
      "id": "number",
      "text": "string",
      "voteCount": "number"
    }
  ],
  "createdAt": "ISO-8601 date string",
  "expiresAt": "ISO-8601 date string",
  "broadcastId": "number",
  "createdBy": {
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "string"
  }
}
```

### Get Polls for Broadcast

```
GET /api/polls/broadcast/{broadcastId}
```

Get all polls for a specific broadcast.

**Path Parameters:**
- `broadcastId` (number, required): Broadcast ID

**Response:**
```json
[
  {
    "id": "number",
    "question": "string",
    "options": [
      {
        "id": "number",
        "text": "string",
        "voteCount": "number"
      }
    ],
    "createdAt": "ISO-8601 date string",
    "expiresAt": "ISO-8601 date string",
    "broadcastId": "number",
    "createdBy": {
      "id": "number",
      "name": "string",
      "email": "string",
      "role": "string"
    }
  }
]
```

### Get Active Polls for Broadcast

```
GET /api/polls/broadcast/{broadcastId}/active
```

Get all active polls for a specific broadcast.

**Path Parameters:**
- `broadcastId` (number, required): Broadcast ID

**Response:**
```json
[
  {
    "id": "number",
    "question": "string",
    "options": [
      {
        "id": "number",
        "text": "string",
        "voteCount": "number"
      }
    ],
    "createdAt": "ISO-8601 date string",
    "expiresAt": "ISO-8601 date string",
    "broadcastId": "number",
    "createdBy": {
      "id": "number",
      "name": "string",
      "email": "string",
      "role": "string"
    }
  }
]
```

### Get Poll by ID

```
GET /api/polls/{pollId}
```

Get details of a specific poll.

**Path Parameters:**
- `pollId` (number, required): Poll ID

**Response:**
```json
{
  "id": "number",
  "question": "string",
  "options": [
    {
      "id": "number",
      "text": "string",
      "voteCount": "number"
    }
  ],
  "createdAt": "ISO-8601 date string",
  "expiresAt": "ISO-8601 date string",
  "broadcastId": "number",
  "createdBy": {
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "string"
  }
}
```

## Notifications

Base URL: `/api/notifications`

### Get User Notifications

```
GET /api/notifications
```

Get all notifications for the authenticated user.

**Response:**
```json
[
  {
    "id": "number",
    "message": "string",
    "type": "string",
    "timestamp": "ISO-8601 date string",
    "read": "boolean",
    "recipient": {
      "id": "number",
      "name": "string",
      "email": "string",
      "role": "string"
    }
  }
]
```

### Get Unread Notifications

```
GET /api/notifications/unread
```

Get all unread notifications for the authenticated user.

**Response:**
```json
[
  {
    "id": "number",
    "message": "string",
    "type": "string",
    "timestamp": "ISO-8601 date string",
    "read": "boolean",
    "recipient": {
      "id": "number",
      "name": "string",
      "email": "string",
      "role": "string"
    }
  }
]
```

## Streaming Configuration

Base URL: `/api/config/streaming`

### Get Streaming Configuration

```
GET /api/config/streaming
```

Get the current streaming configuration (DJ or ADMIN only).

**Response:**
```json
{
  "id": "number",
  "serverUrl": "string",
  "port": "number",
  "mountPoint": "string",
  "username": "string",
  "password": "string",
  "bitrate": "number",
  "genre": "string",
  "serverName": "string",
  "adminPassword": "string"
}
```

### Update Streaming Configuration

```
PUT /api/config/streaming
```

Update the streaming configuration (ADMIN only).

**Request Body:**
```json
{
  "serverUrl": "string",
  "port": "number",
  "mountPoint": "string",
  "username": "string",
  "password": "string",
  "bitrate": "number",
  "genre": "string",
  "serverName": "string",
  "adminPassword": "string"
}
```

**Response:**
```json
{
  "id": "number",
  "serverUrl": "string",
  "port": "number",
  "mountPoint": "string",
  "username": "string",
  "password": "string",
  "bitrate": "number",
  "genre": "string",
  "serverName": "string",
  "adminPassword": "string"
}
```

## Server Schedules

Base URL: `/api/server-schedules`

### Get All Schedules

```
GET /api/server-schedules
```

Get all server schedules (DJ or ADMIN only).

**Response:**
```json
[
  {
    "id": "number",
    "dayOfWeek": "string",
    "startTime": "string (HH:MM)",
    "endTime": "string (HH:MM)",
    "createdBy": {
      "id": "number",
      "name": "string",
      "email": "string",
      "role": "string"
    }
  }
]
```

### Get Schedule by ID

```
GET /api/server-schedules/{id}
```

Get a specific server schedule by ID (DJ or ADMIN only).

**Path Parameters:**
- `id` (number, required): Schedule ID

**Response:**
```json
{
  "id": "number",
  "dayOfWeek": "string",
  "startTime": "string (HH:MM)",
  "endTime": "string (HH:MM)",
  "createdBy": {
    "id": "number",
    "name": "string",
    "email": "string",
    "role": "string"
  }
}
```

## ShoutCast Integration

Base URL: `/api/shoutcast`

### Get Server Status

```
GET /api/shoutcast/status
```

Check if the ShoutCast server is accessible.

**Response:**
```json
{
  "accessible": "boolean",
  "status": "string"
}
```

### Test Server

```
POST /api/shoutcast/test
```

Test the ShoutCast server by starting a test stream (ADMIN or DJ only).

**Response:**
```json
{
  "success": "boolean",
  "message": "string"
}
``` 
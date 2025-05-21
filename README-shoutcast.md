# WildCats Radio - ShoutCast Server Setup

This document explains how to set up and configure the ShoutCast DNAS server for the WildCats Radio application.

## Overview

WildCats Radio uses ShoutCast DNAS (Distributed Network Audio Server) v2.x to broadcast audio streams to listeners. The ShoutCast server handles the audio streaming and provides a robust platform for multiple concurrent listeners.

## Prerequisites

- ShoutCast DNAS Server v2.6.x (included in the project under the `ShoutcastV2` directory)
- Windows, Mac, or Linux operating system
- Network access (ports open for streaming)

## Server Location

The ShoutCast server is located in the `ShoutcastV2` directory in the project root. This contains:

- `sc_serv.exe` / `sc_serv2_win64-latest.exe` - The server executable
- `sc_serv.conf` - Server configuration file
- Various directories for logs, control files, etc.

## Starting and Stopping the Server

### Windows

To start the server:
- Run the `start-shoutcast.bat` script in the project root

To stop the server:
- Run the `stop-shoutcast.bat` script in the project root
- Or manually terminate the process (Task Manager > find sc_serv.exe > End Task)

### Manual Start/Stop

You can also start the server manually by:

1. Open a command prompt/terminal
2. Navigate to the ShoutcastV2 directory
3. Run the server with the configuration file:
   ```
   sc_serv.exe sc_serv.conf
   ```

## Server Configuration

The main configuration file is `sc_serv.conf`. Key settings include:

```
# General Settings
portbase=8000                # Main port for the server
adminpassword=admin          # Admin interface password
password=pass123             # Source password for broadcasters

# Stream Settings
maxuser=512                  # Maximum concurrent listeners
requirestreamconfigs=1       # Require stream configuration

# Stream Configuration - Stream #1
streamid_1=1                 # Stream ID
streampath_1=/stream         # Mount point for the stream
streampassword_1=pass123     # Password for this stream
```

### Important Settings

- **Port**: The server runs on port 8000 by default. If you change this, you must update the application.properties file.
- **Mount Point**: `/stream` is the default mount point (URL path for listeners).
- **Passwords**: The admin and source passwords are set to 'admin' and 'pass123' respectively.

## Accessing the Admin Interface

Once the server is running, you can access the admin interface at:
```
http://localhost:8000/admin.cgi
```

Username: admin  
Password: admin (or whatever is set in sc_serv.conf)

## Testing the Stream

To test if the server is running correctly:

1. Open a web browser
2. Navigate to `http://localhost:8000`
3. You should see the ShoutCast server homepage

To test the stream directly:
```
http://localhost:8000/stream
```

If no source is connected, you'll get an error message.

## Spring Boot Configuration

The application is configured to connect to the ShoutCast server using the following properties in `application.properties`:

```properties
shoutcast.server.url=localhost
shoutcast.server.port=8000
shoutcast.server.admin.password=admin
shoutcast.server.source.password=pass123
shoutcast.server.mount=/stream
shoutcast.test.mode=false
shoutcast.monitor.interval=30
```

- `shoutcast.test.mode` can be set to `true` during development to simulate the ShoutCast server when it's not running.
- `shoutcast.monitor.interval` controls how often (in seconds) the application checks the server status.

## Admin Dashboard

The Admin Dashboard in the web application includes a ShoutCast Server tab that provides:

1. Real-time server status monitoring
2. Current listener count and stream details
3. Ability to launch the server if it's not running
4. Connection testing tools

## Troubleshooting

### Server Won't Start

1. Check if port 8000 is already in use
   ```
   netstat -ano | findstr :8000
   ```
2. Verify that the configuration file paths are correct
3. Check the log files in `ShoutcastV2/logs` for error messages

### Can't Connect to Stream

1. Ensure the server is running (PID file exists in ShoutcastV2 directory)
2. Check if you can access the server homepage at http://localhost:8000
3. Verify that the firewall is not blocking port 8000
4. Check if the source password in the app matches the one in sc_serv.conf

### Audio Stream Issues

1. Check if a source is connected (visible in admin interface)
2. Verify that the stream URL is correct in the application
3. Check browser console for CORS issues

## Performance Tuning

For better performance, consider adjusting these settings in sc_serv.conf:

```
maxuser=1024                # Increase max listeners
autodumptime=30             # Auto-disconnect idle users
maxsourceconnectionsperip=2 # Allow multiple sources from same IP
```

## Security Considerations

In production:

1. Change all default passwords
2. Consider using a reverse proxy (like Nginx) in front of ShoutCast
3. Use firewall rules to restrict direct access to the admin interface
4. Set `publicserver=default` to normal for a more secure setup

## Further Resources

- [ShoutCast Documentation](https://support.shoutcast.com/)
- [WildCats Broadcasting README](README-broadcasting.md) 
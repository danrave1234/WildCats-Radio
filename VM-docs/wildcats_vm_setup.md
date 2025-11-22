# 🧾p **WildCats Radio VM Configuration and Service Setup Guide**

This document records the **exact configuration and service files** currently deployed in your **Google Cloud Compute VM** for WildCats Radio.  
Use this as a **baseline reference** if you ever need to rebuild or migrate the VM.

---

## 1. 📦 **Base Environment Setup**

### 🖥️ VM Overview
| Item | Description |
|------|--------------|
| **Provider** | Google Cloud Compute Engine |
| **OS** | Debian/Ubuntu (apt-based) |
| **External Static IP** | `34.150.12.40` (DNS: `icecast.software`) |
| **Internal IP** | `10.170.0.2` |
| **Open Ports** | `22` (SSH), `8000` (Icecast), `9000` (Harbor input for DJs) |
| **Timezone** | Asia/Manila |
| **Firewall** | GCP Firewall allows TCP 22, 8000, 9000 |

---

### 🧮 Installed Packages
```bash
sudo apt-get update
sudo apt-get install -y icecast2 liquidsoap ffmpeg nginx nano ufw
```

- **Icecast2** — Streaming server
- **Liquidsoap** — Audio router (Harbor input + AutoDJ + fallback)
- **FFmpeg** — Auxiliary transcoding tool
- **Nginx** — Optional web proxy for admin or front-end web interface
- **UFW** — Firewall controller

---

## 2. 🎧️ **Icecast Configuration**

### 📁 File Location
```
/etc/icecast2/icecast.xml
```

### 📄 File Content (verbatim)
```xml
<icecast>
    <!-- Server identification -->
    <location>Google Cloud Singapore (Asia-Southeast1)</location>
    <admin>admin@wildcatsradio.com</admin>

    <!-- Performance limits -->
    <limits>
        <clients>100</clients>
        <sources>5</sources>
        <queue-size>1048576</queue-size>
        <client-timeout>60</client-timeout>
        <header-timeout>30</header-timeout>
        <source-timeout>120</source-timeout>
        <burst-on-connect>1</burst-on-connect>
        <burst-size>196608</burst-size>
    </limits>

    <!-- Authentication -->
    <authentication>
        <source-password>hackme</source-password>
        <relay-password>hackme</relay-password>
        <admin-user>admin</admin-user>
        <admin-password>hackme</admin-password>
    </authentication>

    <!-- Server paths -->
    <paths>
        <basedir>/usr/share/icecast2</basedir>
        <logdir>/var/log/icecast2</logdir>
        <webroot>/usr/share/icecast2/web</webroot>
        <adminroot>/usr/share/icecast2/admin</adminroot>
        <alias source="/" destination="/status.xsl"/>
        <pidfile>/var/run/icecast2/icecast2.pid</pidfile>
    </paths>

    <!-- Listen socket -->
    <listen-socket>
        <port>8000</port>
        <bind-address>0.0.0.0</bind-address>
    </listen-socket>

    <!-- Mounts -->
    <mount type="normal">
        <mount-name>/live.ogg</mount-name>
        <username>source</username>
        <password>hackme</password>
        <max-listeners>80</max-listeners>
        <respawn-timeout>5</respawn-timeout>
        <stream-name>WildCats Radio Live - Philippines</stream-name>
        <stream-description>Live audio broadcast from WildCats Radio</stream-description>
        <stream-url>https://wildcat-radio.live</stream-url>
        <genre>Various</genre>
        <public>1</public>
        <no-yp>1</no-yp>
        <charset>UTF-8</charset>
    </mount>

    <mount>
        <mount-name>/live.mp3</mount-name>
        <username>source</username>
        <password>hackme</password>
        <max-listeners>80</max-listeners>
        <burst-size>196608</burst-size>
        <respawn-timeout>5</respawn-timeout>
        <stream-name>WildCats Radio Live - Philippines</stream-name>
        <stream-description>Live audio broadcast from WildCats Radio</stream-description>
        <stream-url>https://wildcat-radio.live</stream-url>
        <genre>Various</genre>
        <public>1</public>
        <no-yp>1</no-yp>
        <charset>UTF-8</charset>
    </mount>

    <!-- Logging -->
    <logging>
        <accesslog>access.log</accesslog>
        <errorlog>error.log</errorlog>
        <loglevel>3</loglevel>
        <logsize>10485760</logsize>
        <logarchive>1</logarchive>
    </logging>

    <!-- Security -->
    <security>
        <chroot>0</chroot>
        <changeowner>
            <user>icecast2</user>
            <group>icecast</group>
        </changeowner>
    </security>
</icecast>
```

### 🧩 Service Management
```bash
sudo systemctl enable icecast2
sudo systemctl restart icecast2
sudo systemctl status icecast2
```

---

## 3. 🎠 **Liquidsoap Configuration**

### 📁 Script Path
```
/etc/liquidsoap/radio.liq
```

### 📄 File Content (verbatim)
```
# --- Logging
set("log.file","/var/log/liquidsoap/radio.log")
set("log.level",3)

# --- Control server (telnet on localhost)
set("server.telnet", true)
set("server.telnet.bind_addr","127.0.0.1")
set("server.telnet.port",1234)

# --- DJ input via Harbor (BUTT connects here)
set("harbor.bind_addr","0.0.0.0")
live = input.harbor("live",
  port=9000, user="source", password="hackme",
  max=20., # prevent two DJs at once
  metadata_charset="UTF-8"
)

# --- AutoDJ sources
music     = playlist(reload=600, mode="randomize", "/srv/autodj/playlist")
emergency = single("/srv/autodj/silence.ogg")

# --- Router: prefer live, else playlist, else silence
radio = fallback(track_sensitive=false, [live, music, emergency])

# --- Ensure correct format and channel before encoding
radio_stereo = audio_to_stereo(radio)

# --- Output 1: OGG to Icecast on the same VM (bypass proxy)
output.icecast(
  %opus(bitrate=192, vbr="constrained", application="audio"),
  host="127.0.0.1", port=8000,
  password="hackme",
  mount="/live.ogg",
  name="WildCats Radio (OGG Audio)",
  description="Live + AutoDJ for OGG",
  public=true,
  url="https://icecast.software", genre="Various",
  radio_stereo
)


# --- Output 2: MP3 (for mobile)
output.icecast(
  %mp3(bitrate=192, stereo=true, id3v2=true),
  host="127.0.0.1", port=8000,
  password="hackme",
  mount="/live.mp3",
  name="WildCats Radio (MP3)",
  description="Live + AutoDJ for MP3",
  public=true,
  url="https://wildcat-radio.live",
  radio_stereo
)

```

---

### 🗾 Liquidsoap Systemd Service
📁 `/etc/systemd/system/liquidsoap-radio.service`
```ini
[Unit]
Description=Liquidsoap Radio (Harbor switcher -> Icecast)
After=network.target icecast2.service

[Service]
User=liquidsoap
Group=liquidsoap
ExecStart=/usr/bin/liquidsoap -v /etc/liquidsoap/radio.liq
Restart=on-failure
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### 🔧 Service Commands
```bash
sudo systemctl enable liquidsoap-radio
sudo systemctl start liquidsoap-radio
sudo systemctl status liquidsoap-radio
sudo journalctl -u liquidsoap-radio -f
```

---

## 4. 📂 Directory Structure

```
/srv/autodj/
├── playlist/              ← AutoDJ track folder (music rotation)
└── silence.ogg            ← Fallback silence file (1-sec looping silence)
```

Create directories and permissions:
```bash
sudo mkdir -p /srv/autodj/playlist /var/log/liquidsoap
sudo chown -R liquidsoap:liquidsoap /srv/autodj /var/log/liquidsoap
```

Generate a blank silence file:
```bash
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 1 /srv/autodj/silence.ogg
```

---

## 5. 🎤 BUTT (Broadcast Using This Tool)

### Configuration Summary
| Setting | Value |
|----------|-------|
| **Type** | Icecast |
| **Address** | `icecast.software` |
| **Port** | `9000` |
| **Username** | `source` |
| **Password** | `hackme` |
| **Mountpoint** | `/live` |
| **Codec** | MP3 (128 kbps, 44100 Hz) |
| **SSL/TLS** | Off |

---

## 6. 🧩 Verification

### Check Icecast
```bash
sudo systemctl status icecast2
curl http://127.0.0.1:8000/status-json.xsl | jq .
```

### Check Liquidsoap
```bash
sudo systemctl status liquidsoap-radio
sudo tail -f /var/log/liquidsoap/radio.log
```

### Check Audio Path
1. Start Liquidsoap
2. Connect via BUTT
3. Visit:  
   - http://icecast.software:8000/live.ogg  
   - http://icecast.software:8000/live.mp3  

---

## 7. 🧠 Notes

- `127.0.0.1` is used internally for **Liquidsoap → Icecast**, since they’re on the same VM.
- DJs and listeners connect externally using the **public IP/DNS** (`icecast.software`).
- Both `.ogg` and `.mp3` mounts are active for cross-device compatibility.
- Fallback and AutoDJ directories are ready to be expanded.

---
# WildCats Radio VM Agent Setup Documentation

## Overview
This document describes the installation and configuration of the **Radio Control Agent** (Flask-based Python service) on the WildCats Radio Icecast Virtual Machine (VM). The agent provides local API endpoints (port 5000) for health checks and broadcast control automation.

---

## 1. Environment Details
**VM Type:** Google Cloud Compute Engine (Debian/Ubuntu)  
**Purpose:** Hosts Icecast, Liquidsoap, and Flask-based control agent  
**IP Address:** `34.150.12.40` (static external IP)  
**Internal IP:** `10.170.0.2`  
**Listening Ports:**
- Icecast: `8000`
- Liquidsoap Harbor (BUTT): `9000`
- Flask Agent: `5000`

---

## 2. Python Agent Installation

### Step 2.1 — Install Python and Flask
```bash
sudo apt-get update
sudo apt-get install -y python3 python3-pip
sudo pip3 install flask flask-cors requests
```

### Step 2.2 — Create System User and Group
```bash
sudo groupadd --system radio-agent
sudo useradd --system --no-create-home --gid radio-agent --shell /usr/sbin/nologin radio-agent
```

### Step 2.3 — Place the Agent Script
Create the main agent script at:
```bash
sudo nano /usr/local/bin/radio_agent.py
```

**Example `radio_agent.py`:**
```python
from flask import Flask, request, jsonify
import os

app = Flask(__name__)

@app.route('/status', methods=['GET'])
def status():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if token != os.getenv('AGENT_TOKEN', 'hackme'):
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify({'state': 'running', 'detail': 'active'})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
```

### Step 2.4 — Set Ownership and Permissions
```bash
sudo chown radio-agent:radio-agent /usr/local/bin/radio_agent.py
sudo chmod 755 /usr/local/bin/radio_agent.py
```

---

## 3. Systemd Service Configuration

### Step 3.1 — Create the Service File
```bash
sudo nano /etc/systemd/system/radio-agent.service
```

**Service File Content:**
```ini
[Unit]
Description=Radio Control Agent
After=network.target

[Service]
User=radio-agent
Group=radio-agent
ExecStart=/usr/bin/python3 /usr/local/bin/radio_agent.py
Restart=always
Environment="AGENT_TOKEN=hackme"

[Install]
WantedBy=multi-user.target
```

### Step 3.2 — Reload and Enable Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable radio-agent
sudo systemctl start radio-agent
```

### Step 3.3 — Check Status
```bash
sudo systemctl status radio-agent
```
Expected output:
```
● radio-agent.service - Radio Control Agent
     Loaded: loaded (/etc/systemd/system/radio-agent.service; enabled)
     Active: active (running)
   Main PID: 1942860 (python3)
      Tasks: 1
     Memory: 18.3M
     CGroup: /system.slice/radio-agent.service
             └─1942860 /usr/bin/python3 /usr/local/bin/radio_agent.py
```

---

## 4. Verification

### Step 4.1 — Local Check
```bash
curl -X GET http://127.0.0.1:5000/status -H "Authorization: Bearer hackme"
```
**Expected Output:**
```json
{"state": "running", "detail": "active"}
```

### Step 4.2 — External Check
```bash
curl -X GET http://34.150.12.40:5000/status -H "Authorization: Bearer hackme"
```
If GCP firewall allows port 5000, the same JSON response should appear.

---

## 5. Troubleshooting

### 5.1 — Service Fails to Start
Run:
```bash
sudo journalctl -u radio-agent -n 20 --no-pager
```
Common causes:
- Flask not installed → `sudo pip3 install flask`
- Missing `if __name__ == "__main__": app.run(...)`
- Wrong Python path → use `/usr/bin/python3`

### 5.2 — Reset Failed Service
If you see `start-limit-hit`:
```bash
sudo systemctl reset-failed radio-agent
sudo systemctl restart radio-agent
```

---

## 6. Summary of Services Running on VM
| Service | Purpose | Port | File |
|----------|----------|------|------|
| **Icecast2** | Broadcast relay server | 8000 | `/etc/icecast2/icecast.xml` |
| **Liquidsoap** | Stream switcher / AutoDJ | 9000 (Harbor) | `/etc/liquidsoap/radio.liq` |
| **Radio Agent** | Control & status API | 5000 | `/usr/local/bin/radio_agent.py` |

All services are set to auto-start at boot and run continuously.

---

## 7. Validation Checklist
✅ Flask installed and reachable  
✅ Agent responds to `/status`  
✅ Systemd service `active (running)`  
✅ Port 5000 open in GCP firewall  
✅ Ownership set to `radio-agent:radio-agent`  
✅ Icecast and Liquidsoap running normally

---

**Result:**
The WildCats Radio VM now runs a persistent Radio Control Agent on port 5000, managed by systemd and verified operational through `curl` requests both locally
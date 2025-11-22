Here’s the markdown documentation you requested. You can download or copy it.

**File name:** `new_full_mvp_implementation_vm_changes.md`

````markdown
# Full MVP Implementation — VM / Agent Changes

This document describes the VM and agent changes for your MVP HTTP-agent setup to control Liquidsoap via backend buttons.

---

## 1. Agent Installation & Setup

### 1.1 Agent script: `radio_agent.py`

Create the agent script on the VM:

```bash
sudo nano /usr/local/bin/radio_agent.py
````

Paste the following content:

```python
#!/usr/bin/env python3
import os
import subprocess
import time
import hmac
from flask import Flask, request, jsonify

app = Flask(__name__)

AGENT_TOKEN = os.environ.get("AGENT_TOKEN", "")

def auth_ok(req):
    auth = req.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    token = auth[len("Bearer "):]
    # constant-time compare
    return hmac.compare_digest(token, AGENT_TOKEN)

def run_cmd(cmd):
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return proc.returncode, proc.stdout, proc.stderr
    except Exception as e:
        return 1, "", str(e)

@app.route("/start", methods=["POST"])
def start():
    if not auth_ok(request):
        return jsonify({"error": "unauthorized"}), 401
    # Check if already running
    rc, _, _ = run_cmd(["/usr/bin/systemctl", "is-active", "--quiet", "liquidsoap-radio"])
    if rc == 0:
        return jsonify({"state": "running", "detail": "already running", "at": int(time.time()*1000)})
    # Attempt start
    rc2, _, err2 = run_cmd(["sudo", "/usr/bin/systemctl", "start", "liquidsoap-radio"])
    if rc2 == 0:
        return jsonify({"state": "running", "detail": "started", "at": int(time.time()*1000)})
    else:
        return jsonify({"state": "unknown", "detail": f"start failed: {err2}", "at": int(time.time()*1000)}), 500

@app.route("/stop", methods=["POST"])
def stop():
    if not auth_ok(request):
        return jsonify({"error": "unauthorized"}), 401
    rc, _, _ = run_cmd(["/usr/bin/systemctl", "is-active", "--quiet", "liquidsoap-radio"])
    if rc != 0:
        return jsonify({"state": "stopped", "detail": "already stopped", "at": int(time.time()*1000)})
    rc2, _, err2 = run_cmd(["sudo", "/usr/bin/systemctl", "stop", "liquidsoap-radio"])
    if rc2 == 0:
        return jsonify({"state": "stopped", "detail": "stopped", "at": int(time.time()*1000)})
    else:
        return jsonify({"state": "unknown", "detail": f"stop failed: {err2}", "at": int(time.time()*1000)}), 500

@app.route("/status", methods=["GET"])
def status():
    if not auth_ok(request):
        return jsonify({"error": "unauthorized"}), 401
    rc, _, _ = run_cmd(["/usr/bin/systemctl", "is-active", "--quiet", "liquidsoap-radio"])
    if rc == 0:
        return jsonify({"state": "running", "detail": "active", "at": int(time.time()*1000)})
    else:
        return jsonify({"state": "stopped", "detail": "inactive", "at": int(time.time()*1000)})
```

Make it executable:

```bash
sudo chmod +x /usr/local/bin/radio_agent.py
```

---

### 1.2 systemd Service: `radio-agent.service`

Create:

```bash
sudo nano /etc/systemd/system/radio-agent.service
```

Paste:

```ini
[Unit]
Description=Radio Control Agent
After=network.target

[Service]
ExecStart=/usr/bin/env python3 /usr/local/bin/radio_agent.py
User=radio-agent
Group=radio-agent
Restart=always
Environment="AGENT_TOKEN=hackme"

[Install]
WantedBy=multi-user.target
```

Reload and enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now radio-agent
```

---

### 1.3 sudoers Entry

Create:

```bash
sudo nano /etc/sudoers.d/radio-agent
```

Paste:

```
Defaults:radio-agent !requiretty
radio-agent ALL=(root) NOPASSWD: /usr/bin/systemctl start liquidsoap-radio, /usr/bin/systemctl stop liquidsoap-radio, /usr/bin/systemctl status liquidsoap-radio
```

Set permissions:

```bash
sudo chmod 440 /etc/sudoers.d/radio-agent
```

---

## 2. Notes & Warnings

* **Token `hackme` is insecure** — use a strong, random token for production.
* Agent must run under a user account `radio-agent`. Make sure that user exists on the system.
* systemd’s `Environment="AGENT_TOKEN=hackme"` sets the environment variable for that service process.
* Ensure firewall or ingress rules restrict access to the agent’s port (likely 5000) only to your backend.
* Use `systemctl status radio-agent` and `journalctl -u radio-agent` to debug startup issues.
* The agent’s `/start` and `/stop` endpoints should behave idempotently (starting when already running should return “running”, etc.).
* Keep `/usr/bin/systemctl` as absolute path in commands and `sudoers` entry.

---

3. Firewall / Port 5000 Configuration

You have now added a firewall rule to permit TCP port 5000 for the radio agent. Details:
* Rule name: allow-radio-agent-5000
* Description: Temporary allow port 5000 open (for demo) via 0.0.0.0/0
* Direction: Ingress
* Action: Allow
* Source filter: 0.0.0.0/0 (i.e., from anywhere)
* Protocol / Port: tcp:5000
* Enforcement: Enabled
* Target instances: The rule applies to your VM(s) (e.g. icecast-server)
* Network tag: VM is listed under tags http-server, https-server and also has tag icecast-server in certain instances
* Because source is 0.0.0.0/0, all external IPs can attempt to connect on port 5000 — ensure your agent’s token and auth logic is enforced strictly.

---

If you like, I can prepare another markdown file with the **frontend + backend stubs** to go along with this, so you have the full end-to-end spec. Would you prefer I send that now?

# GCP VM Comparison Checklist (VM1 vs VM2)

Use this checklist in Google Cloud Console to spot configuration differences that can affect outbound connectivity to Icecast (tcp/8000) or alternate port 443.

Quick TL;DR if FFmpeg shows Error number -138 to icecast.software:8000 on VM2 but VM1 works:
- From each VM: open http://<your-api-host>/api/icecast/diagnostics and compare sourcePortReachable/altPortReachable
- From each VM: open http://<your-api-host>/api/system/gcp-metadata and compare network, subnetwork, tags, service account, externalIp
- If 8000 is blocked, consider setting ICECAST_SOURCE_PORT=443 (tls=1 is auto-applied by the backend when port=443)

1) VM Details (Compute Engine)
- Compute Engine > VM instances > [VM]
  - Name, Zone, Machine type
  - Network interfaces
    - Network and Subnetwork (must match between VMs if you expect identical policies)
    - External IP (present?) If absent, ensure Cloud NAT is configured
  - Network tags (drive firewall targeting) — ensure VM2 has same tags as VM1
  - Service account — identical SA recommended to inherit same egress policies
  - Shielded VM / OS features (rarely related but note any differences)

2) VPC Firewall Rules
- VPC network > Firewall
  - Filter by Direction: Egress
  - Check rules targeting your VM via:
    - targetTags matching the VM’s tags
    - targetServiceAccounts matching the VM’s SA
  - Confirm no DENY rules for tcp:8000
  - Confirm an ALLOW rule exists for tcp:8000 (or a broad 0-65535) to 0.0.0.0/0
  - For fallback on 443, ensure tcp:443 egress is allowed

3) Routes and Internet Access
- VPC network > Routes
  - Ensure default route to Internet (0.0.0.0/0 via default Internet gateway) exists for your network/subnet
  - If instance has no external IP, verify Cloud NAT for the subnet

4) Cloud NAT (if no external IP)
- VPC network > NAT
  - Confirm a NAT is configured for your subnet/region
  - Check the logs for dropped/errored translations

5) DNS and Proxies
- VPC network > Cloud DNS (or custom resolvers)
  - Make sure icecast.software resolves to the same IP from both VMs
- Organization policies / Proxies
  - Confirm there’s no mandatory corporate proxy on VM2 blocking raw TCP

6) Service Account and IAM
- Compare the service accounts attached to both VMs
- Check if any VPC Service Controls or org policies apply differently between VMs

7) OS Firewall (Windows Defender Firewall)
- On the instance, ensure outbound rules allow tcp:8000 and tcp:443
- Temporarily test with Windows Firewall disabled (for troubleshooting only) to rule out host firewall

8) Network Logs and Tests
- VPC Flow Logs: VPC network > Logs > Flow logs (subnet must have it enabled)
  - Enable flow logs on the subnet; use Logs Explorer with filters to look for src=VM2 internal IP, dst=icecast.software, dst_port=8000 and note drops
- Network Intelligence > Connectivity Tests
  - Create test: Source = VM2 NIC, Destination = internet host icecast.software:8000
- On each VM (PowerShell):
  - Test-NetConnection icecast.software -Port 8000
  - Test-NetConnection icecast.software -Port 443

9) App-level Diagnostics (already built in this repo)
- GET /api/icecast/diagnostics
  - Shows DNS resolution, TCP reachability (source/alt/listener port), and HTTP status page results
- GET /api/system/gcp-metadata
  - Shows instance, network, and project metadata to quickly compare VMs
- GET /api/system/vm-diff-hints
  - Quick JSON checklist and console shortcuts

10) If port 8000 is blocked from VM2
- Option A (network fix): Allow egress tcp:8000 to icecast.software in GCP firewall and OS firewall
- Option B (app config): Publish over 443 instead
  - Set env vars on VM2:
    - ICECAST_SOURCE_PORT=443
    - ICECAST_ALT_PORT=443 (optional but recommended)
  - The backend automatically appends tls=1 to Icecast URLs when publishing on port 443

Useful gcloud commands
- gcloud compute instances describe VM1 --zone=YOUR_ZONE
- gcloud compute instances describe VM2 --zone=YOUR_ZONE
- gcloud compute firewall-rules list --format='table(name,direction,network,priority,disabled)'
- gcloud compute instances get-effective-firewalls VM1 --zone=YOUR_ZONE
- gcloud compute routes list --filter='network:YOUR_NETWORK'

How to compare quickly
- Open diagnostics endpoints on both VMs in two browser tabs
- Open each VM details page and compare: tags, SA, network/subnetwork, external IP
- Check VPC firewall and routes for the shared network
- Run connectivity tests and/or Test-NetConnection from both VMs

If you still can’t find the difference, share the JSON outputs of /api/icecast/diagnostics and /api/system/gcp-metadata from both VMs (mask sensitive info) so we can pinpoint it.
package com.wildcastradio.diagnostics;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

@Profile("diagnostics")
@RestController
@RequestMapping("/api/system")
public class GcpDiagnosticsController {
    private static final Logger logger = LoggerFactory.getLogger(GcpDiagnosticsController.class);

    private static final String MD_ROOT = "http://metadata.google.internal/computeMetadata/v1/";

    @GetMapping("/gcp-metadata")
    public ResponseEntity<Map<String, Object>> gcpMetadata() {
        Map<String, Object> out = new HashMap<>();
        if (!isRunningOnGcp()) {
            out.put("runningOnGcp", false);
            out.put("message", "Metadata server not reachable. This endpoint only works from inside a GCE VM.");
            return ResponseEntity.status(HttpStatus.OK).body(out);
        }
        out.put("runningOnGcp", true);
        try {
            // Instance basics
            out.put("instanceId", fetchMeta("instance/id"));
            out.put("name", fetchMeta("instance/name"));
            out.put("zone", tail(fetchMeta("instance/zone"))); // zones/.. -> last token
            out.put("machineType", tail(fetchMeta("instance/machine-type")));
            out.put("image", fetchOptional("instance/image"));
            out.put("hostname", fetchMeta("instance/hostname"));
            out.put("tags", fetchOptional("instance/tags"));
            out.put("serviceAccount", fetchOptional("instance/service-accounts/default/email"));
            out.put("scopes", fetchOptional("instance/service-accounts/default/scopes"));

            // Network interfaces
            Map<String, Object> nic0 = new HashMap<>();
            nic0.put("network", tail(fetchMeta("instance/network-interfaces/0/network")));
            nic0.put("subnetwork", tail(fetchMeta("instance/network-interfaces/0/subnetwork")));
            nic0.put("internalIp", fetchMeta("instance/network-interfaces/0/ip"));
            nic0.put("externalIp", fetchOptional("instance/network-interfaces/0/access-configs/0/external-ip"));
            out.put("nic0", nic0);

            // Project level
            Map<String, Object> project = new HashMap<>();
            project.put("projectId", fetchMeta("project/project-id"));
            project.put("numericProjectId", fetchMeta("project/numeric-project-id"));
            out.put("project", project);

            // Helpful hints for Icecast egress
            Map<String, Object> hints = new HashMap<>();
            hints.put("egressCheckPorts", new int[]{8000, 443});
            hints.put("firewallConsolePath", "VPC network > Firewall > Egress rules");
            hints.put("routeConsolePath", "VPC network > Routes (check default internet route)");
            hints.put("natConsolePath", "NAT (if private instance without external IP)");
            hints.put("compareWith", "Compare tags, service account, network, subnetwork, external IP presence between VMs");
            out.put("hints", hints);

            return ResponseEntity.ok(out);
        } catch (Exception e) {
            logger.warn("Failed to fetch GCP metadata: {}", e.getMessage());
            out.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(out);
        }
    }

    @GetMapping("/vm-diff-hints")
    public ResponseEntity<Map<String, Object>> vmDiffHints() {
        Map<String, Object> data = new HashMap<>();
        data.put("whatToCompare", new String[]{
                "VPC network and subnetwork (same?)",
                "Network tags (used by firewall rules)",
                "Service account attached to the VM",
                "Scopes / Access Token permissions",
                "External IP attached? (if no, ensure Cloud NAT)",
                "OS firewall (Windows Defender): outbound TCP 8000 allowed?",
                "Organization policy restricting egress or proxies",
                "Startup scripts and installed software (proxies, antivirus)",
                "DNS resolver differences (Cloud DNS, custom DNS)"
        });
        data.put("consoleShortcuts", new String[]{
                "Compute Engine > VM instances > [VM] > Details",
                "VPC network > Firewall > List (filter by target tags)",
                "VPC network > Routes",
                "Cloud NAT (if private instances)",
                "Network Intelligence > Connectivity Tests (create a test to icecast.software:8000)",
                "Logging > Logs Explorer (query VPC Flow Logs for denied connections)"
        });
        data.put("gcloudExamples", new String[]{
                "gcloud compute instances describe VM1 --zone=YOUR_ZONE",
                "gcloud compute instances describe VM2 --zone=YOUR_ZONE",
                "gcloud compute firewall-rules list --format='table(name,direction,network,priority,disabled)'",
                "gcloud compute routes list --filter='network:YOUR_NETWORK'",
                "gcloud compute instances get-effective-firewalls VM1 --zone=YOUR_ZONE"
        });
        data.put("note", "Use /api/icecast/diagnostics from each VM to compare reachability fields (sourcePortReachable, altPortReachable, listenerPortReachable).");
        return ResponseEntity.ok(data);
    }

    private boolean isRunningOnGcp() {
        try {
            URL url = new URL(MD_ROOT);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Metadata-Flavor", "Google");
            conn.setConnectTimeout(800);
            conn.setReadTimeout(800);
            int code = conn.getResponseCode();
            return code == 200 || code == 403; // 200 for index, some paths return 403 w/o proper header
        } catch (Exception e) {
            return false;
        }
    }

    private String fetchMeta(String path) throws Exception {
        URL url = new URL(MD_ROOT + path);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Metadata-Flavor", "Google");
        conn.setConnectTimeout(1500);
        conn.setReadTimeout(1500);
        if (conn.getResponseCode() != 200) {
            throw new IllegalStateException("Metadata HTTP " + conn.getResponseCode() + " for " + path);
        }
        try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            return sb.toString();
        }
    }

    private String fetchOptional(String path) {
        try {
            return fetchMeta(path);
        } catch (Exception e) {
            return null;
        }
    }

    private String tail(String s) {
        if (s == null) return null;
        int idx = s.lastIndexOf('/');
        return idx >= 0 ? s.substring(idx + 1) : s;
    }
}
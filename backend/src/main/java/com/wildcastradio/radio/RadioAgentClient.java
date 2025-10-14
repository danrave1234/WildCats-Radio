package com.wildcastradio.radio;

import java.time.Duration;
import java.util.Map;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

@Service
public class RadioAgentClient {
    private final RestTemplate restTemplate;
    private final RadioAgentProperties props;

    public RadioAgentClient(RestTemplateBuilder builder, RadioAgentProperties props) {
        this.props = props;
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofMillis(props.getTimeoutMs()))
                .setReadTimeout(Duration.ofMillis(props.getTimeoutMs()))
                .build();
    }

    private HttpHeaders authHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(props.getToken());
        return h;
    }

    public Map<String, Object> start() {
        try {
            ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                    props.getBaseUrl() + "/start",
                    HttpMethod.POST,
                    new HttpEntity<>(authHeaders()),
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            return resp.getBody();
        } catch (ResourceAccessException e) {
            throw new RadioAgentUnavailableException("agent timeout/unreachable", e);
        } catch (RestClientResponseException e) {
            throw new RadioAgentProxyException(e.getStatusCode().value(), e.getResponseBodyAsString(), e);
        }
    }

    public Map<String, Object> stop() {
        try {
            ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                    props.getBaseUrl() + "/stop",
                    HttpMethod.POST,
                    new HttpEntity<>(authHeaders()),
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            return resp.getBody();
        } catch (ResourceAccessException e) {
            throw new RadioAgentUnavailableException("agent timeout/unreachable", e);
        } catch (RestClientResponseException e) {
            throw new RadioAgentProxyException(e.getStatusCode().value(), e.getResponseBodyAsString(), e);
        }
    }

    public Map<String, Object> status() {
        try {
            ResponseEntity<Map<String, Object>> resp = restTemplate.exchange(
                    props.getBaseUrl() + "/status",
                    HttpMethod.GET,
                    new HttpEntity<>(authHeaders()),
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            return resp.getBody();
        } catch (ResourceAccessException e) {
            throw new RadioAgentUnavailableException("agent timeout/unreachable", e);
        } catch (RestClientResponseException e) {
            throw new RadioAgentProxyException(e.getStatusCode().value(), e.getResponseBodyAsString(), e);
        }
    }
}



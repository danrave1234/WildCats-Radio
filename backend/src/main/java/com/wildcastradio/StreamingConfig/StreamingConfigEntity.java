package com.wildcastradio.StreamingConfig;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "streaming_config")
public class StreamingConfigEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String serverUrl;

    @Column(nullable = false)
    private Integer port;

    @Column
    private String mountPoint;

    @Column
    private String password;

    @Column(nullable = false)
    private String protocol;

    // Constructors
    public StreamingConfigEntity() {
    }

    public StreamingConfigEntity(String serverUrl, Integer port, String mountPoint, String password, String protocol) {
        this.serverUrl = serverUrl;
        this.port = port;
        this.mountPoint = mountPoint;
        this.password = password;
        this.protocol = protocol;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getServerUrl() {
        return serverUrl;
    }

    public void setServerUrl(String serverUrl) {
        this.serverUrl = serverUrl;
    }

    public Integer getPort() {
        return port;
    }

    public void setPort(Integer port) {
        this.port = port;
    }

    public String getMountPoint() {
        return mountPoint;
    }

    public void setMountPoint(String mountPoint) {
        this.mountPoint = mountPoint;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getProtocol() {
        return protocol;
    }

    public void setProtocol(String protocol) {
        this.protocol = protocol;
    }
} 
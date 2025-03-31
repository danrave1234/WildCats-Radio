package com.wildcastradio;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WildCatsRadioApplication {

    public static void main(String[] args) {
        SpringApplication.run(WildCatsRadioApplication.class, args);
    }
} 
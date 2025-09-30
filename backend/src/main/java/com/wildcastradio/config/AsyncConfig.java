package com.wildcastradio.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class AsyncConfig implements WebMvcConfigurer {

	@Bean(name = "mvcTaskExecutor")
	public ThreadPoolTaskExecutor mvcTaskExecutor() {
		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setThreadNamePrefix("mvc-async-");
		// Sensible defaults; override via env if needed
		executor.setCorePoolSize(Integer.parseInt(System.getenv().getOrDefault("MVC_ASYNC_CORE", "8")));
		executor.setMaxPoolSize(Integer.parseInt(System.getenv().getOrDefault("MVC_ASYNC_MAX", "32")));
		executor.setQueueCapacity(Integer.parseInt(System.getenv().getOrDefault("MVC_ASYNC_QUEUE", "200")));
		executor.initialize();
		return executor;
	}

	@Override
	public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
		configurer.setTaskExecutor(mvcTaskExecutor());
		// Also configurable via spring.mvc.async.request-timeout
		configurer.setDefaultTimeout(Long.parseLong(System.getenv().getOrDefault("MVC_ASYNC_TIMEOUT_MS", "600000"))); // 10 minutes
	}
}



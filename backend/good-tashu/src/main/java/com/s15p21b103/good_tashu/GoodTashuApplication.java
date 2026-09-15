package com.s15p21b103.good_tashu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableAsync
@SpringBootApplication
// Properties 스캔하도록 설정
@ConfigurationPropertiesScan
// 스케줄러 활성화
@EnableScheduling
public class GoodTashuApplication {

	public static void main(String[] args) {
		SpringApplication.run(GoodTashuApplication.class, args);
	}

}

package com.s15p21b103.good_tashu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
// Properties 스캔하도록 설정
@ConfigurationPropertiesScan
public class GoodTashuApplication {

	public static void main(String[] args) {
		SpringApplication.run(GoodTashuApplication.class, args);
	}

}

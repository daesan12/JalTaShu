package com.s15p21b103.good_tashu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@EnableAsync
@SpringBootApplication
public class GoodTashuApplication {

	public static void main(String[] args) {
		SpringApplication.run(GoodTashuApplication.class, args);
	}

}

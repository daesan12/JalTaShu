package com.s15p21b103.good_tashu._util.fcm;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import javax.annotation.PostConstruct;
import java.io.IOException;

@Configuration
@Slf4j
public class FcmConfig {
    @Value("${firebase.key.path}")
    private String keyPath;

    @PostConstruct
    public void init() {
        try {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(
                            GoogleCredentials.fromStream(new ClassPathResource(keyPath).getInputStream())
                    ).build();
            FirebaseApp.initializeApp(options);
            log.info("fcm 설정 성공");
        } catch (IOException e) {
            log.info("fcm 설정 실패: {}", e.getMessage());
        }
    }
}

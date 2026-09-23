package com.s15p21b103.good_tashu._util.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.AwsSessionCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class S3Config {
    @Bean
    public Region awsRegion(@Value("${AWS_REGION:us-east-1}") String region) {
        return Region.of(region);
    }

    @Bean
    public AwsCredentialsProvider awsCredentialsProvider(
            @Value("${AWS_ACCESS_KEY_ID:}") String accessKey,
            @Value("${AWS_SECRET_ACCESS_KEY:}") String secretKey,
            @Value("${AWS_SESSION_TOKEN:}") String sessionToken) {
        if (accessKey.isBlank() && secretKey.isBlank() && sessionToken.isBlank()) {
            return DefaultCredentialsProvider.create();
        }
        if (accessKey.isBlank() || secretKey.isBlank()) {
            throw new IllegalArgumentException("AWS_ACCESS_KEY_ID와 AWS_SECRET_ACCESS_KEY를 모두 입력해주세요.");
        }
        if (!sessionToken.isBlank()) {
            return StaticCredentialsProvider.create(
                    AwsSessionCredentials.create(accessKey, secretKey, sessionToken));
        }
        return StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
    }

    @Bean
    public S3Client s3Client(AwsCredentialsProvider awsCredentialsProvider, Region awsRegion) {
        return S3Client.builder()
                .region(awsRegion)
                .credentialsProvider(awsCredentialsProvider)
                .build();
    }

    @Bean
    public S3Presigner s3Presigner(AwsCredentialsProvider awsCredentialsProvider, Region awsRegion) {
        return S3Presigner.builder()
                .region(awsRegion)
                .credentialsProvider(awsCredentialsProvider)
                .build();
    }
}

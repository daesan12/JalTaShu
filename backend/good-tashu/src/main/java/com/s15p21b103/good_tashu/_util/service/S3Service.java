package com.s15p21b103.good_tashu._util.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class S3Service {
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${S3_BUCKET:tashu-upload-755719633654-ap-northeast-2-an}")
    private String bucket;
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS =
            Set.of("jpg", "jpeg", "png", "gif", "webp", "heic", "heif");

    //사진을 업로드하고 제보의 path에 저장할 S3 객체 키(images/UUID)를 반환
    public String uploadImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("업로드할 사진이 없습니다.");
        }

        String filename = file.getOriginalFilename();
        String extension = "";
        if (filename != null) {
            int lastSeparator = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
            int lastDot = filename.lastIndexOf('.');
            if (lastDot > lastSeparator && lastDot < filename.length() - 1) {
                extension = filename.substring(lastDot + 1).toLowerCase(Locale.ROOT);
            }
        }
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("사진 확장자만 업로드할 수 있습니다. (jpg, jpeg, png, gif, webp, heic, heif)");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("이미지 파일만 업로드할 수 있습니다.");
        }

        String key = "images/" + UUID.randomUUID();
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .build();

        try (InputStream inputStream = file.getInputStream()) {
            s3Client.putObject(request, RequestBody.fromInputStream(inputStream, file.getSize()));
        } catch (IOException e) {
            throw new UncheckedIOException("사진 파일을 읽는 중 오류가 발생했습니다.", e);
        }

        return key;
    }

    public String createUploadUrl(String contentType) {

        String key = "images/" + UUID.randomUUID();

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .build();

        PutObjectPresignRequest request =
                PutObjectPresignRequest.builder()
                        .signatureDuration(Duration.ofMinutes(5))
                        .putObjectRequest(putObjectRequest)
                        .build();

        return s3Presigner
                .presignPutObject(request)
                .url()
                .toString();
    }

    // 저장된 객체 키를 일정 시간 동안 접근 가능한 조회 URL로 변환한다.
    public String createDownloadUrl(String key) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();
        GetObjectPresignRequest request = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(5))
                .getObjectRequest(getObjectRequest)
                .build();

        return s3Presigner.presignGetObject(request).url().toString();
    }

    public void deleteImage(String key) {
        if (key == null || key.isBlank()) {
            return;
        }
        s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    }

}

package com.s15p21b103.good_tashu._util.exception;

import com.s15p21b103.good_tashu._util.response.ApiResponse;
import com.s15p21b103.good_tashu.map.exception.MapException;
import com.s15p21b103.good_tashu.cycle.exception.CycleException;
import com.s15p21b103.good_tashu.notice.exception.NoticeException;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.fcm.exception.FcmException;
import com.s15p21b103.good_tashu.admin.exception.AdminException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(org.springframework.dao.DataIntegrityViolationException e) {
        for (Throwable cause = e; cause != null; cause = cause.getCause()) {
            if (cause instanceof org.hibernate.exception.ConstraintViolationException violation) {
                String name = violation.getConstraintName();
                if (name != null && name.replace("\"", "").replace("`", "")
                        .matches("(?i)(?:[A-Z0-9_]+\\.)?uk_paths_cycle_usage_id(?:_INDEX_[A-Z0-9]+)?(?: INDEX [A-Z0-9_.]+)?")) {
                    return handleCycleException(new CycleException(
                            com.s15p21b103.good_tashu.cycle.exception.CycleErrorCode.PATH_ALREADY_EXISTS));
                }
            }
        }
        return handleException(e);
    }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableBody() {
        return ResponseEntity.badRequest().body(ApiResponse.error(400, "요청 본문이 없거나 JSON 형식이 올바르지 않습니다."));
    }
    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiResponse<Void>> handleRequestParameter(Exception e) {
        log.warn("요청 파라미터 오류: {}", e.getClass().getSimpleName());
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(400, "필수 요청 파라미터가 없거나 형식이 올바르지 않습니다."));
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodValidation(HandlerMethodValidationException e) {
        int status = e.getStatusCode().value();
        return ResponseEntity.status(status).body(ApiResponse.error(status,
                e.isForReturnValue() ? "INTERNAL_SERVER_ERROR" : "요청 파라미터가 허용 범위를 벗어났습니다."));
    }

    @ExceptionHandler(AdminException.class)
    public ResponseEntity<ApiResponse<Void>> handleAdminException(AdminException e) {
        log.warn("관리자 요청 오류: {}", e.getErrorCode());
        return ResponseEntity.status(e.getErrorCode().getStatus())
                .body(ApiResponse.error(e.getErrorCode().getStatus().value(), e.getErrorCode().getMessage()));
    }
    @ExceptionHandler(MapException.class)
    public ResponseEntity<ApiResponse<Void>> handleMapException(MapException e) {
        log.warn("장소 검색 오류: {}", e.getErrorCode());
        return ResponseEntity.status(e.getErrorCode().getStatus())
                .body(ApiResponse.error(e.getErrorCode().getStatus().value(), e.getErrorCode().getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException e) {
        log.warn("잘못된 요청: {}", e.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponse.error(400, e.getMessage()));
    }

    @ExceptionHandler(FcmException.class)
    public ResponseEntity<ApiResponse<Void>> handleFcmException(FcmException e) {
        log.warn("Fcm에서 에러 발생: {}", e.getErrorCode().getMessage());
        return ResponseEntity
                .status(e.getErrorCode().getStatus())
                .body(ApiResponse.error(e.getErrorCode().getStatus().value(), e.getErrorCode().getMessage()));
    }

    @ExceptionHandler(CycleException.class)
    public ResponseEntity<ApiResponse<Void>> handleCycleException(CycleException e) {
        log.warn("Cycle에서 에러 발생: {}", e.getErrorCode().getMessage());
        return ResponseEntity
                .status(e.getErrorCode().getStatus())
                .body(ApiResponse.error(e.getErrorCode().getStatus().value(), e.getErrorCode().getMessage()));
    }

    @ExceptionHandler(NoticeException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoticeException(NoticeException e) {
        log.warn("Notice에서 에러 발생: {}", e.getErrorCode().getMessage());
        return ResponseEntity
                .status(e.getErrorCode().getStatus())
                .body(ApiResponse.error(e.getErrorCode().getStatus().value(), e.getErrorCode().getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldError() != null
                ? e.getBindingResult().getFieldError().getDefaultMessage()
                : "잘못된 요청입니다.";
        log.warn("유효성 검증 실패: {}", message);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), message));
    }

    // 전역 예외 핸들러
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        log.error("Exception 발생: ", e);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(HttpStatus.INTERNAL_SERVER_ERROR.value(), "INTERNAL_SERVER_ERROR"));
    }

    // 유저 예외 처리
    @ExceptionHandler(UserException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(UserException e) {
        log.warn("유저에서 예외 발생: {}", e.getMessage());
        return ResponseEntity
                .status(e.getErrorCode().getStatus())
                .body(ApiResponse.error(e.getErrorCode().getStatus().value(), e.getMessage()));
    }

}

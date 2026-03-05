---
name: pg-error-handling
description: IROVEN 백엔드 에러 핸들링 및 예외 처리 표준. Use when handling errors, creating custom exceptions, implementing GlobalExceptionHandler, or writing logging code.
---

# IROVEN Backend 에러 핸들링 표준

IROVEN 백엔드 팀의 에러 핸들링, 예외 처리, 로깅 표준을 정의합니다.

## StatusCode Enum 관리

모든 응답 코드는 `StatusCode` enum으로 중앙 관리:

```java
package com.pg.{servicename}.ex;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 응답 상태 코드 관리 Enum
 */
@Getter
@RequiredArgsConstructor
public enum StatusCode {

    // HTTP 표준 코드
    SUCCESS(200, "성공"),
    CREATED(201, "생성됨"),
    BAD_REQUEST(400, "잘못된 요청"),
    UNAUTHORIZED(401, "인증되지 않음"),
    FORBIDDEN(403, "권한 없음"),
    NOT_FOUND(404, "리소스를 찾을 수 없음"),
    INTERNAL_SERVER_ERROR(500, "서버 내부 오류"),

    // 도메인별 커스텀 코드 (1000번대)
    USER_NOT_FOUND(1001, "사용자를 찾을 수 없음"),
    FILE_UPLOAD_FAILED(1013, "파일 업로드 실패"),
    FILE_NOT_FOUND(1026, "파일을 찾을 수 없음"),
    ORDER_NOT_FOUND(1028, "주문을 찾을 수 없음"),
    CONCURRENT_MODIFICATION(1038, "동시 수정 충돌"),
    ;

    private final int code;
    private final String message;
}
```

**규칙:**
- HTTP 표준 코드: 200~500 범위
- 커스텀 코드: 1000번대부터 도메인별 할당
- 모든 코드에 한글 메시지 필수

## 커스텀 예외 클래스

### 예외 패키지 구조

```text
ex/
├── GlobalExceptionHandler.java
├── StatusCode.java
├── file/
│   ├── FileNotFoundException.java
│   └── FileUploadException.java
├── payment/
│   └── PaymentException.java
└── settlement/
    └── SettlementException.java
```

### 커스텀 예외 작성 패턴

```java
package com.pg.{servicename}.ex.file;

/**
 * 파일을 찾을 수 없을 때 발생하는 예외
 */
public class FileNotFoundException extends RuntimeException {

    public FileNotFoundException(String message) {
        super(message);
    }

    public FileNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

**핵심 규칙:**
- `RuntimeException` 상속
- 도메인별 서브패키지에 위치 (`ex/{domain}/`)
- Javadoc 주석 필수
- 2개 생성자: message only, message + cause

## GlobalExceptionHandler

### 구현 패턴

```java
package com.pg.{servicename}.ex;

import com.pg.{servicename}.common.ResponseData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Bean Validation 예외 처리
     * Request DTO의 @Valid 검증 실패 시 발생
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ResponseData<Object>> handleMethodArgumentNotValidException(
            MethodArgumentNotValidException ex) {
        log.warn("MethodArgumentNotValidException", ex);

        List<String> errorMessages = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(DefaultMessageSourceResolvable::getDefaultMessage)
                .toList();

        String errorMessage = errorMessages.isEmpty()
                ? "유효성 검사 오류가 발생했습니다."
                : String.join(", ", errorMessages);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseData.of(StatusCode.BAD_REQUEST.getCode(), errorMessage, null));
    }

    /**
     * 파일 업로드 예외 처리
     */
    @ExceptionHandler(FileUploadException.class)
    public ResponseEntity<ResponseData<Object>> handleFileUploadException(FileUploadException ex) {
        log.warn("FileUploadException: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseData.of(StatusCode.FILE_UPLOAD_FAILED.getCode(), ex.getMessage(), null));
    }

    /**
     * 파일 크기 초과 예외 처리
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ResponseData<Object>> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException ex) {
        log.warn("MaxUploadSizeExceededException: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ResponseData.of(StatusCode.BAD_REQUEST.getCode(),
                        "파일 크기가 허용 범위를 초과했습니다.", null));
    }

    /**
     * 예상하지 못한 예외 처리 (catch-all)
     * 반드시 가장 마지막에 위치
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ResponseData<Object>> handleGenericException(Exception ex) {
        log.error("Unexpected exception occurred", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ResponseData.of(StatusCode.INTERNAL_SERVER_ERROR.getCode(),
                        "서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.", null));
    }
}
```

**핵심 규칙:**
- Spring MVC 4xx 예외는 **개별 핸들러**로 처리 (catch-all이 삼키지 않도록)
- 각 `@ExceptionHandler`에 **Javadoc 주석 필수**
- 비즈니스 예외: `log.warn()`, 시스템 예외: `log.error()`
- 응답은 항상 `ResponseData.of(statusCode, message, null)` 형식

## 서비스 레이어에서 예외 사용

### 엔티티 조회 시

```java
@Transactional(readOnly = true)
public FileInfo getFileInfo(Long fileId) {
    return fileInfoRepository.findById(fileId)
            .orElseThrow(() -> new FileNotFoundException("파일을 찾을 수 없습니다. fileId=" + fileId));
}
```

### 보상 트랜잭션 (파일 업로드 예시)

```java
@Transactional
public FileInfo uploadFile(MultipartFile file, String folder) {
    String objectName = UUID.randomUUID() + "_" + file.getOriginalFilename();

    // 1. 스토리지 업로드
    String filePath = storageService.upload(file, objectName);

    try {
        // 2. DB 저장
        FileInfo fileInfo = FileInfo.of(file, objectName, filePath);
        return fileInfoRepository.save(fileInfo);
    } catch (Exception e) {
        // 3. DB 실패 시 스토리지 파일 삭제 (보상 처리)
        log.error("DB 저장 실패, 스토리지 파일 삭제: {}", objectName, e);
        storageService.delete(objectName);
        throw new FileUploadException("파일 업로드 중 오류가 발생했습니다.", e);
    }
}
```

## 로깅 전략

### 로깅 레벨 기준

| 레벨 | 용도 | 예시 |
|------|------|------|
| `DEBUG` | 개발 디버깅 | `log.debug("Finding user by id: {}", id)` |
| `INFO` | 정상 비즈니스 플로우 | `log.info("주문 생성 완료: orderId={}", orderId)` |
| `WARN` | 비즈니스 예외 (예상된 에러) | `log.warn("사용자 없음: userId={}", userId)` |
| `ERROR` | 시스템 예외 (예상치 못한 에러) | `log.error("DB 저장 실패", ex)` |

### 로깅 포맷 규칙

```java
// ✅ 권장: 구조화된 정보
log.info("주문 생성 요청: userId={}, amount={}", userId, request.getTotalAmount());
log.warn("FileUploadException: {}", ex.getMessage());
log.error("Unexpected exception occurred", ex);  // 스택트레이스 포함

// ❌ 피하기: 문자열 연결
log.info("User " + userId + " created order");
```

**핵심 규칙:**
- SLF4J 플레이스홀더 `{}` 사용 (문자열 연결 금지)
- `ERROR` 레벨에서는 Exception 객체를 마지막 인자로 전달 (스택트레이스 출력)
- 민감 정보(비밀번호, 토큰) 로그 출력 금지

## When to Use This Skill

- 커스텀 예외 클래스 생성
- GlobalExceptionHandler에 핸들러 추가
- Service 레이어에서 예외 throw
- StatusCode enum 추가
- 로깅 코드 작성

## Checklist

- [ ] 커스텀 예외가 `ex/{domain}/` 패키지에 위치하는가?
- [ ] 예외 클래스에 Javadoc 주석이 있는가?
- [ ] `RuntimeException`을 상속하는가?
- [ ] GlobalExceptionHandler에 개별 핸들러가 등록되었는가?
- [ ] `@ExceptionHandler`에 Javadoc이 있는가?
- [ ] Spring MVC 예외가 catch-all보다 먼저 처리되는가?
- [ ] 비즈니스 예외는 `log.warn()`, 시스템 예외는 `log.error()`인가?
- [ ] SLF4J 플레이스홀더 `{}`를 사용하는가?
- [ ] 민감 정보가 로그에 노출되지 않는가?
- [ ] StatusCode enum에 코드가 등록되었는가?

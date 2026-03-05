---
name: pg-api-design
description: IROVEN 백엔드 API 설계 및 패키지 구조 규칙. Use when creating REST APIs, DTOs, controllers, or organizing backend code structure.
---

# IROVEN Backend API 설계 및 패키지 구조

IROVEN 백엔드 팀의 API 설계, DTO 네이밍, 패키지 구조 표준을 정의합니다.

## 프로젝트 기본 정보

- **Java**: 21
- **Spring Boot**: 3.4+ (4.x 호환)
- **주요 기술**: JPA/Hibernate, QueryDSL, JWT, Kafka, Feign Client
- **API 문서**: SpringDoc OpenAPI (Swagger UI)

## 패키지 구조 규칙

도메인별 패키지 구조:

```text
com.pg.{servicename}
├── common/               # 공통 (BaseTimeEntity, ResponseData, 유틸리티)
├── config/               # 설정 클래스
├── ex/                   # 예외 처리 (GlobalExceptionHandler, StatusCode)
│   └── {domain}/         # 도메인별 커스텀 예외
├── jwt/                  # JWT 인증/인가
├── {domain}/
│   ├── controller/       # 컨트롤러
│   │   ├── request/      # Request DTO
│   │   └── response/     # Response DTO
│   ├── entity/           # JPA 엔티티
│   ├── enums/            # Enum 정의 (선택)
│   ├── repository/       # 데이터 접근 계층
│   └── service/          # 비즈니스 로직
│       ├── request/      # Service 레이어 Request DTO (선택)
│       └── response/     # Service 레이어 Response DTO (선택)
├── kafka/                # Kafka Producer/Consumer (선택)
└── util/                 # 유틸리티 클래스
```

### 예시 (user-service 기준)

```text
com.pg.userservice
└── order/
    ├── controller/
    │   ├── OrderController.java
    │   ├── request/
    │   │   └── OrderRequest.java
    │   └── response/
    │       └── OrderResponse.java
    ├── entity/
    │   └── Order.java
    ├── enums/
    │   ├── OrderStatus.java
    │   └── PaymentStatus.java
    ├── repository/
    │   ├── OrderRepository.java
    │   ├── OrderRepositoryCustom.java
    │   └── OrderRepositoryImpl.java
    └── service/
        ├── OrderService.java
        └── response/
            └── PaymentHistoryServiceResponse.java
```

## DTO 규칙

### 1. Request DTO — class 사용

```java
@Schema(description = "주문 생성 요청")
@Getter
@Builder(access = AccessLevel.PRIVATE)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class OrderRequest {

    @Schema(description = "상품명", example = "테스트 상품", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "상품명은 필수입니다")
    @Size(max = 200, message = "상품명은 200자 이하여야 합니다")
    private String productName;

    @Schema(description = "결제 금액", example = "10000", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "결제 금액은 필수입니다")
    private Integer totalAmount;

    public static OrderRequest of(String productName, Integer totalAmount) {
        return OrderRequest.builder()
                .productName(productName)
                .totalAmount(totalAmount)
                .build();
    }
}
```

**핵심 규칙:**
- `@Builder(access = AccessLevel.PRIVATE)` + 정적 팩토리 메서드 `of()`
- `@NoArgsConstructor(access = AccessLevel.PROTECTED)` (Jackson 역직렬화용)
- `@AllArgsConstructor(access = AccessLevel.PRIVATE)` (빌더용)
- Bean Validation 어노테이션 필수
- `@Schema` 어노테이션으로 Swagger 문서화

### 2. Response DTO — record 사용

```java
@Builder(access = AccessLevel.PRIVATE)
public record OrderResponse(
        @Schema(description = "생성된 주문 ID", example = "ORD-20231001-001")
        String orderId
) {
    public static OrderResponse of(String orderId) {
        return OrderResponse.builder()
                .orderId(orderId)
                .build();
    }
}
```

**핵심 규칙:**
- record 클래스 사용
- `@Builder(access = AccessLevel.PRIVATE)` + 정적 팩토리 메서드 `of()`

### 3. Service 레이어 DTO (선택)

Controller ↔ Service 간 변환이 필요할 때:

```java
// Controller Request → Service Request 변환
public record OrderServiceRequest(
        Long userId,
        String productName,
        Integer totalAmount
) {
    public static OrderServiceRequest from(OrderRequest request) {
        return new OrderServiceRequest(null, request.getProductName(), request.getTotalAmount());
    }
}
```

## 컨트롤러 설계 가이드

### 표준 컨트롤러 구조

```java
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/orders")
public class OrderController {

    private final OrderService orderService;

    /**
     * 주문 생성
     */
    @PostMapping
    public OrderResponse createOrder(
            @UserId Long userId,
            @Valid @RequestBody OrderRequest request) {
        log.info("주문 생성 요청: userId={}, amount={}", userId, request.getTotalAmount());
        String orderId = orderService.createOrder(userId, OrderServiceRequest.from(request));
        return OrderResponse.of(orderId);
    }

    /**
     * 주문 상세 조회
     */
    @GetMapping("/{orderId}")
    public ResponseData<OrderDetailResponse> getOrder(
            @UserId Long userId,
            @PathVariable String orderId) {
        OrderDetailResponse response = orderService.getOrderDetail(userId, orderId);
        return ResponseData.of(StatusCode.SUCCESS.getCode(), "조회 성공", response);
    }
}
```

**핵심 규칙:**
- `@Slf4j`, `@RestController`, `@RequiredArgsConstructor` 필수
- `@UserId` 커스텀 어노테이션으로 인증 사용자 ID 추출
- `@Valid`로 Request Validation 적용
- Javadoc 주석으로 API 설명

### 응답 형식 — ResponseData 래퍼

```java
@Getter
public class ResponseData<T> {
    private final int status;
    private final String message;
    private final T data;

    @Builder(access = AccessLevel.PRIVATE)
    protected ResponseData(int status, String message, T data) {
        this.status = status;
        this.message = message;
        this.data = data;
    }

    public static <T> ResponseData<T> of(int status, String message, T data) {
        return ResponseData.<T>builder()
                .status(status)
                .message(message)
                .data(data)
                .build();
    }
}
```

**응답 예시:**

성공:
```json
{
  "status": 200,
  "message": "조회 성공",
  "data": { "orderId": "ORD-001", "amount": 10000 }
}
```

에러:
```json
{
  "status": 1001,
  "message": "사용자를 찾을 수 없음",
  "data": null
}
```

## When to Use This Skill

- 새로운 API 엔드포인트 생성
- Request/Response DTO 작성
- 컨트롤러 구현
- 도메인 패키지 구조 설계
- ResponseData 래퍼 사용

## Checklist

- [ ] 패키지 구조가 `com.pg.{servicename}.{domain}.{layer}` 패턴인가?
- [ ] Request DTO는 class + `@Builder(access = PRIVATE)` + `of()` 패턴인가?
- [ ] Response DTO는 record + `@Builder(access = PRIVATE)` + `of()` 패턴인가?
- [ ] Request DTO에 Bean Validation 어노테이션이 있는가?
- [ ] `@Schema` 어노테이션으로 Swagger 문서가 작성되었는가?
- [ ] 컨트롤러에 `@Slf4j`, `@RequiredArgsConstructor`가 있는가?
- [ ] 응답이 `ResponseData<T>` 래퍼를 사용하는가?
- [ ] Javadoc 주석이 작성되었는가?

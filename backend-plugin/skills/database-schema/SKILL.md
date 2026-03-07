---
name: pg-database-schema
description: IROVEN 데이터베이스 설계, Flyway 마이그레이션, JPA Entity, QueryDSL 규칙. Use when creating JPA entities, writing QueryDSL queries, adding @Transactional annotations, or creating Flyway migration scripts.
---

# IROVEN Database 설계 및 QueryDSL 규칙

IROVEN 백엔드 팀의 DB 설계, Flyway, JPA, QueryDSL, 트랜잭션 관리 표준을 정의합니다.

## 프로젝트 기본 정보

- **Database**: MySQL 9.0+
- **ORM**: JPA 3.2 / Hibernate 7 (Spring Data JPA)
- **Query Library**: QueryDSL 5.x (jakarta classifier)
- **Migration**: Flyway 11.x (`spring-boot-starter-flyway` 사용)

## Flyway 마이그레이션

### 파일 네이밍 규칙

```
V{YYYYMMDD}_{순번}__{설명}.sql
```

**예시:**
```
V20260302_1__create_file_info_table.sql
V20260302_2__add_audit_columns_to_file_info.sql
V20260303_1__add_order_status_column.sql
```

### SQL 작성 규칙

```sql
CREATE TABLE file_info (
    id          BIGINT          NOT NULL AUTO_INCREMENT COMMENT '파일 ID',
    file_name   VARCHAR(255)    NOT NULL                COMMENT '원본 파일명',
    file_path   VARCHAR(500)    NOT NULL                COMMENT '저장 경로',
    file_size   BIGINT          NOT NULL DEFAULT 0      COMMENT '파일 크기(bytes)',
    created_date DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '생성일시',
    modified_date DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '수정일시',
    PRIMARY KEY (id),
    INDEX idx_file_info_file_path (file_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='파일 정보';
```

**핵심 규칙:**
- **모든 컬럼/테이블에 MySQL COMMENT 필수**
- audit 컬럼: `created_date`, `modified_date`
- audit 기본값: `NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`
- `modified_date`에는 `ON UPDATE CURRENT_TIMESTAMP(6)` 추가
- `DATETIME(6)` — 마이크로초 정밀도
- `utf8mb4` 캐릭터셋, `utf8mb4_0900_ai_ci` 콜레이션

### 컬럼 추가 마이그레이션 예시

```sql
ALTER TABLE file_info
    ADD COLUMN storage_type VARCHAR(20) NOT NULL DEFAULT 'local' COMMENT '스토리지 타입' AFTER file_size;
```

## JPA Entity 설계

### BaseTimeEntity (공통 audit)

```java
@Getter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseTimeEntity {

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdDate;

    @LastModifiedDate
    private LocalDateTime modifiedDate;
}
```

### Entity 작성 패턴

```java
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "file_info")
public class FileInfo extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "file_name_change", nullable = false, length = 255)
    private String fileNameChange;

    @Column(name = "file_name_extension", nullable = false, length = 50)
    private String fileNameExtension;

    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;

    @Builder(access = AccessLevel.PRIVATE)
    private FileInfo(String fileName, String fileNameChange,
                     String fileNameExtension, Long fileSize, String filePath) {
        this.fileName = fileName;
        this.fileNameChange = fileNameChange;
        this.fileNameExtension = fileNameExtension;
        this.fileSize = fileSize;
        this.filePath = filePath;
    }

    /**
     * FileInfo 생성 정적 팩토리 메서드
     */
    public static FileInfo of(MultipartFile file, String objectName, String filePath) {
        return FileInfo.builder()
                .fileName(file.getOriginalFilename())
                .fileNameChange(objectName)
                .fileNameExtension(FileUtils.getExtension(file))
                .fileSize(file.getSize())
                .filePath(filePath)
                .build();
    }
}
```

**핵심 규칙:**
- `@NoArgsConstructor(access = AccessLevel.PROTECTED)` — JPA 프록시용
- `@Builder(access = AccessLevel.PRIVATE)` — 외부 직접 빌더 사용 금지
- 정적 팩토리 메서드 `of()` 또는 `create()`로만 생성
- `@Getter` only, **`@Setter` 사용 금지**
- `BaseTimeEntity` 상속으로 audit 컬럼 자동 관리
- 비즈니스 메서드로 상태 변경 (예: `updateStatus()`)

### 연관관계 매핑

```java
@Entity
@Table(name = "orders")
public class Order extends BaseEntity {

    // ManyToOne — 지연 로딩 필수
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private Users user;

    // OneToOne — 지연 로딩 + cascade
    @OneToOne(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private OrderCustomerInfo customerInfo;

    // OneToMany — 지연 로딩 + cascade + orphanRemoval
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();
}
```

**규칙:** 모든 연관관계는 **LAZY 로딩** 기본

### 낙관적 락 (Optimistic Locking)

```java
@Version
@Column(name = "version")
private Long version;
```

## QueryDSL 사용 규칙

### Repository 구조

```java
// 1. JPA Repository — Custom 인터페이스 상속
@Repository
public interface OrderRepository extends JpaRepository<Order, Long>, OrderRepositoryCustom {

    Optional<Order> findByOrderId(String orderId);

    @EntityGraph(attributePaths = {"customerInfo", "payment"})
    Optional<Order> findWithDetailsByOrderId(String orderId);
}

// 2. Custom 인터페이스
public interface OrderRepositoryCustom {
    Page<Order> searchOrders(PaymentHistorySearchRequest condition, Pageable pageable);
}

// 3. Custom 구현체 — JPAQueryFactory 사용
@Slf4j
@RequiredArgsConstructor
public class OrderRepositoryImpl implements OrderRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public Page<Order> searchOrders(PaymentHistorySearchRequest condition, Pageable pageable) {
        JPAQuery<Order> query = queryFactory.selectFrom(order)
                .leftJoin(order.customerInfo).fetchJoin()
                .leftJoin(order.payment).fetchJoin()
                .where(
                        startDateGoe(condition.startDate()),
                        endDateLoe(condition.endDate()),
                        paymentStatusEq(condition.paymentStatus())
                )
                .orderBy(order.createdDate.desc())
                .offset(pageable.getOffset())
                .limit(pageable.getPageSize());

        List<Order> content = query.fetch();
        long total = queryFactory.select(order.count())
                .from(order)
                .where(/* 동일 조건 */)
                .fetchOne();

        return new PageImpl<>(content, pageable, total);
    }

    // BooleanExpression 헬퍼 — null 반환으로 조건 무시
    private BooleanExpression startDateGoe(LocalDate startDate) {
        return startDate == null ? null : order.createdDate.goe(startDate.atStartOfDay());
    }

    private BooleanExpression paymentStatusEq(PaymentStatus status) {
        return status == null ? null : order.paymentStatus.eq(status);
    }
}
```

**핵심 규칙:**
- Custom 인터페이스명: `{Entity}RepositoryCustom`
- 구현체명: `{Entity}RepositoryImpl` (Spring Data 규약)
- `BooleanExpression` 헬퍼 메서드로 동적 조건 분리
- `null` 반환 시 QueryDSL이 해당 조건 무시
- `@EntityGraph`로 N+1 방지

### RepositoryCustom 직접 주입 금지

```java
// ❌ 금지: 구현체 직접 주입
@Service
public class OrderService {
    private final OrderRepositoryImpl orderRepositoryImpl;
}

// ✅ 올바름: JPA Repository 인터페이스 주입
@Service
public class OrderService {
    private final OrderRepository orderRepository;
}
```

## @Transactional 사용 규칙

```java
@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {

    // 조회 메서드 — readOnly = true
    @Transactional(readOnly = true)
    public FileInfo getFileInfo(Long fileId) {
        return fileInfoRepository.findById(fileId)
                .orElseThrow(() -> new FileNotFoundException("파일을 찾을 수 없습니다."));
    }

    // 변경 메서드 — @Transactional
    @Transactional
    public FileInfo uploadFile(MultipartFile file, String folder) {
        // ...
    }
}
```

**규칙:**
- **조회만**: `@Transactional(readOnly = true)`
- **변경 포함**: `@Transactional`
- 모든 Service public 메서드에 명시적 선언

## When to Use This Skill

- Flyway 마이그레이션 스크립트 작성
- JPA Entity 생성 및 수정
- QueryDSL 쿼리 작성
- Repository 인터페이스 및 Custom 구현체 작성
- @Transactional 어노테이션 추가

## Checklist

- [ ] Flyway 파일명이 `V{YYYYMMDD}_{순번}__{설명}.sql` 패턴인가?
- [ ] 모든 SQL 컬럼/테이블에 COMMENT가 있는가?
- [ ] audit 컬럼(created_date, modified_date)이 포함되었는가?
- [ ] modified_date에 `ON UPDATE CURRENT_TIMESTAMP(6)`가 있는가?
- [ ] Entity가 `@NoArgsConstructor(PROTECTED)` + `@Builder(PRIVATE)` + `of()` 패턴인가?
- [ ] Entity에 `@Setter`가 없는가?
- [ ] 모든 연관관계가 LAZY 로딩인가?
- [ ] QueryDSL Custom 구현체가 JPA Repository를 통해 사용되는가?
- [ ] BooleanExpression 헬퍼로 동적 조건이 분리되었는가?
- [ ] 모든 Service 메서드에 `@Transactional`이 명시되었는가?
- [ ] 조회 메서드에 `readOnly = true`가 적용되었는가?

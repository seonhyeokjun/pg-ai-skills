---
name: pg-test-writing
description: IROVEN 백엔드 테스트 작성 표준. Use when writing test code, choosing test strategies, generating test data, or verifying test coverage.
---

# IROVEN Test Writing Standards

IROVEN 백엔드 팀의 테스트 작성 표준을 정의합니다.

## 프로젝트 기본 정보

- **Java**: 21
- **Testing Framework**: JUnit 5
- **Assertion Library**: AssertJ
- **Mocking**: Mockito
- **DB Testing**: H2 인메모리 (테스트), Flyway 비활성화

## 테스트 프로파일 설정

```java
@ActiveProfiles("test")
```

`application-test.yml`:
```yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb
    driver-class-name: org.h2.Driver
  jpa:
    hibernate:
      ddl-auto: create-drop
  flyway:
    enabled: false
```

**핵심:** H2 인메모리 DB + Flyway 비활성화 + `create-drop`

## 테스트 유형 선택 가이드

```
API 엔드포인트?        → @WebMvcTest (Controller 테스트)
Repository/QueryDSL?  → @DataJpaTest (Repository 테스트)
Service 비즈니스 로직?  → Mockito 단위 테스트 (기본 선택)
여러 서비스 통합?       → @SpringBootTest (최소화)
도메인 로직 (POJO)?    → 순수 JUnit 테스트
```

### Mock vs Integration 판단 기준

**기본은 Mockito 단위 테스트, 꼭 필요할 때만 통합 테스트**

통합 테스트가 필요한 경우:
1. 금전 처리 (입금/출금/결제/환불)
2. 트랜잭션 롤백 검증 필수
3. 여러 테이블 데이터 정합성 검증
4. DB 제약조건(Unique/FK) 검증
5. 복잡한 상태 전이 (3단계 이상)
6. Kafka 이벤트 발행/소비 검증
7. 3개 이상 서비스 협력

**위 조건 모두 해당 안 되면 → Mockito 단위 테스트**

## Given-When-Then 패턴 (필수)

모든 테스트는 반드시 Given-When-Then 구조:

```java
@Test
@DisplayName("파일 업로드 - 성공")
void uploadFile_ValidFile_Success() {
    // given - 테스트 준비
    MultipartFile file = new MockMultipartFile("file", "test.jpg", "image/jpeg", "content".getBytes());
    when(storageService.upload(any(), any())).thenReturn("s3://bucket/test.jpg");

    // when - 실행
    FileInfo result = fileService.uploadFile(file, "uploads");

    // then - 검증
    assertThat(result).isNotNull();
    assertThat(result.getFileName()).isEqualTo("test.jpg");
    verify(storageService, times(1)).upload(any(), any());
}
```

## 테스트 명명 규칙

### 클래스

```java
class FileServiceTest                     // Service 단위 테스트
class FileControllerTest                  // Controller 테스트
class FileInfoRepositoryTest              // Repository 테스트
class FileServiceIntegrationTest          // 통합 테스트
class FileInfoTest                        // 도메인/Entity 테스트
```

### 메서드

```java
// 패턴: {메서드명}_{시나리오}_{예상결과}
void uploadFile_ValidFile_Success()
void uploadFile_EmptyFile_ThrowsException()
void getFileInfo_FileNotFound_ThrowsFileNotFoundException()
```

## 테스트 유형별 예시

### 1. Service 단위 테스트 (Mockito)

```java
@ExtendWith(MockitoExtension.class)
@DisplayName("FileService 단위 테스트")
class FileServiceTest {

    @Mock
    private FileInfoRepository fileInfoRepository;

    @Mock
    private StorageService storageService;

    @InjectMocks
    private FileService fileService;

    @Test
    @DisplayName("파일 정보 조회 - 성공")
    void getFileInfo_ValidId_Success() {
        // given
        Long fileId = 1L;
        FileInfo fileInfo = createFileInfo(fileId, "test.jpg");
        when(fileInfoRepository.findById(fileId)).thenReturn(Optional.of(fileInfo));
        when(storageService.getFileUrl(any())).thenReturn("https://s3.amazonaws.com/test.jpg");

        // when
        FileInfoResponse response = fileService.getFileInfo(fileId);

        // then
        assertThat(response).isNotNull();
        assertThat(response.fileName()).isEqualTo("test.jpg");
        verify(fileInfoRepository, times(1)).findById(fileId);
    }

    @Test
    @DisplayName("파일 정보 조회 - 파일 없음 예외")
    void getFileInfo_FileNotFound_ThrowsException() {
        // given
        Long fileId = 999L;
        when(fileInfoRepository.findById(fileId)).thenReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> fileService.getFileInfo(fileId))
                .isInstanceOf(FileNotFoundException.class)
                .hasMessageContaining("파일을 찾을 수 없습니다");
    }
}
```

### 2. Controller 테스트 (@WebMvcTest)

```java
@ActiveProfiles("test")
@WebMvcTest(FileController.class)
@DisplayName("FileController 테스트")
class FileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FileService fileService;

    @Test
    @DisplayName("파일 업로드 API - 성공")
    void uploadFile_ValidRequest_Returns200() throws Exception {
        // given
        MockMultipartFile file = new MockMultipartFile(
                "file", "test.jpg", "image/jpeg", "content".getBytes());
        when(fileService.uploadFileAndGetId(any(), any())).thenReturn(1L);

        // when & then
        mockMvc.perform(multipart("/file")
                        .file(file)
                        .param("folder", "uploads"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(1));
    }

    @Test
    @DisplayName("파일 정보 조회 API - 404")
    void getFileInfo_NotFound_Returns404() throws Exception {
        // given
        when(fileService.getFileInfo(999L))
                .thenThrow(new FileNotFoundException("파일을 찾을 수 없습니다."));

        // when & then
        mockMvc.perform(get("/file/{fileId}", 999L))
                .andExpect(status().isNotFound());
    }
}
```

### 3. Repository 테스트 (@DataJpaTest)

```java
@ActiveProfiles("test")
@DataJpaTest
@DisplayName("FileInfoRepository 테스트")
class FileInfoRepositoryTest {

    @Autowired
    private FileInfoRepository fileInfoRepository;

    @Test
    @DisplayName("파일 저장 및 조회 - 성공")
    void save_AndFindById_Success() {
        // given
        FileInfo fileInfo = FileInfo.of("test.jpg", "uuid_test.jpg", "jpg", 1024L, "uploads/uuid_test.jpg");

        // when
        FileInfo saved = fileInfoRepository.save(fileInfo);
        Optional<FileInfo> found = fileInfoRepository.findById(saved.getId());

        // then
        assertThat(found).isPresent();
        assertThat(found.get().getFileName()).isEqualTo("test.jpg");
        assertThat(found.get().getFileSize()).isEqualTo(1024L);
    }
}
```

## AssertJ 검증 패턴

```java
// 단일 값
assertThat(response).isNotNull();
assertThat(response.fileName()).isEqualTo("test.jpg");
assertThat(response.fileSize()).isGreaterThan(0L);

// 컬렉션
assertThat(files).hasSize(3);
assertThat(files).extracting(FileInfo::getFileName)
        .containsExactlyInAnyOrder("a.jpg", "b.jpg", "c.jpg");

// Boolean
assertThat(result.isPresent()).isTrue();

// 예외
assertThatThrownBy(() -> fileService.getFileInfo(999L))
        .isInstanceOf(FileNotFoundException.class)
        .hasMessageContaining("파일을 찾을 수 없습니다");

// Optional
assertThat(result).isPresent();
assertThat(result).isEmpty();
```

## Mockito 패턴

```java
// 반환값 설정
when(repository.findById(1L)).thenReturn(Optional.of(entity));
when(storageService.upload(any(), any())).thenReturn("path");

// void 메서드
doNothing().when(storageService).delete(any());

// 예외 발생
when(repository.findById(999L)).thenThrow(new FileNotFoundException("not found"));

// 호출 검증
verify(repository, times(1)).save(any());
verify(storageService, never()).delete(any());

// 인자 검증
verify(repository).save(argThat(fileInfo ->
        fileInfo.getFileName().equals("test.jpg")));
```

## When to Use This Skill

- 테스트 파일 생성 또는 수정
- 테스트 전략 선택 (단위 vs 통합)
- Given-When-Then 패턴 적용
- AssertJ/Mockito 코드 작성

## Checklist

**공통**
- [ ] `@ActiveProfiles("test")` 적용되었는가?
- [ ] Given-When-Then 패턴을 따르는가?
- [ ] `@DisplayName`으로 테스트 의도가 명확한가?
- [ ] 메서드명이 `{메서드}_{시나리오}_{결과}` 패턴인가?
- [ ] AssertJ로 검증하는가?

**Service 단위 테스트**
- [ ] `@ExtendWith(MockitoExtension.class)` 사용하는가?
- [ ] `@Mock` + `@InjectMocks` 패턴인가?
- [ ] `verify()`로 호출 검증하는가?

**Controller 테스트**
- [ ] `@WebMvcTest(TargetController.class)` 명시했는가?
- [ ] Service는 `@MockBean`인가?
- [ ] HTTP Status Code를 검증하는가?

**Repository 테스트**
- [ ] `@DataJpaTest` 사용하는가?
- [ ] N+1 문제를 검증했는가?

**통합 테스트 (사용 시)**
- [ ] 위 7가지 기준 중 하나 이상 해당하는가?
- [ ] 외부 API는 `@MockBean`인가?

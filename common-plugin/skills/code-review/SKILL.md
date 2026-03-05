---
name: pg-code-review
description: IROVEN 코드 리뷰 체크리스트 및 품질 기준. Use when reviewing code, performing self-review, or validating code quality before commit.
---

# IROVEN 코드 리뷰 체크리스트

PR 코드 리뷰 시 확인해야 할 항목들을 정의합니다.

## 1. 아키텍처 & 구조

- [ ] 패키지 구조가 `com.pg.{servicename}.{domain}.{layer}` 패턴을 따르는가?
- [ ] 레이어 분리가 명확한가? (Controller → Service → Repository)
- [ ] Controller에 비즈니스 로직이 들어있지 않은가?
- [ ] Service 레이어만 트랜잭션을 관리하는가?

## 2. 네이밍 & 컨벤션

- [ ] Request DTO: class + `@Builder(access = PRIVATE)` + `of()` 패턴
- [ ] Response DTO: record + `@Builder(access = PRIVATE)` + `of()` 패턴
- [ ] Entity: `@NoArgsConstructor(PROTECTED)` + `@Builder(PRIVATE)` + 정적 팩토리
- [ ] Entity에 `@Setter`가 없고 비즈니스 메서드로 상태 변경하는가?
- [ ] 유틸리티 클래스에 `@NoArgsConstructor(access = PRIVATE)` + static 메서드만 있는가?

## 3. 데이터베이스

- [ ] Flyway 파일: `V{YYYYMMDD}_{순번}__{설명}.sql` 네이밍
- [ ] 모든 SQL 컬럼/테이블에 MySQL COMMENT가 있는가?
- [ ] audit 컬럼(created_date, modified_date) 포함
- [ ] `modified_date`에 `ON UPDATE CURRENT_TIMESTAMP(6)` 있는가?
- [ ] 모든 연관관계가 LAZY 로딩인가?
- [ ] N+1 문제 가능성은 없는가?

## 4. 트랜잭션

- [ ] 모든 Service 메서드에 `@Transactional` 명시
- [ ] 조회 메서드: `@Transactional(readOnly = true)`
- [ ] 외부 API 호출이 트랜잭션 범위에 포함되지 않는가?

## 5. 예외 처리

- [ ] 커스텀 예외가 `ex/{domain}/` 패키지에 위치
- [ ] `GlobalExceptionHandler`에 해당 예외 핸들러 등록
- [ ] Spring MVC 예외가 catch-all보다 먼저 처리되는가?
- [ ] `StatusCode` enum에 코드가 등록되었는가?

## 6. 보안

- [ ] `application-prod.yml`이 변경되지 않았는가?
- [ ] `.env` 파일이 변경되지 않았는가?
- [ ] 하드코딩된 비밀번호, API 키, 토큰이 없는가?
- [ ] 민감 정보가 로그에 노출되지 않는가?
- [ ] SQL Injection 가능성이 없는가?

## 7. 로깅

- [ ] SLF4J 플레이스홀더 `{}` 사용 (문자열 연결 금지)
- [ ] 비즈니스 예외: `log.warn()`, 시스템 예외: `log.error()`
- [ ] 주요 비즈니스 플로우에 `log.info()` 추가

## 8. API 문서

- [ ] Request/Response DTO에 `@Schema` 어노테이션
- [ ] Javadoc 주석 작성

## 9. 테스트

- [ ] 새로운 기능에 대한 테스트가 작성되었는가?
- [ ] Given-When-Then 패턴을 따르는가?
- [ ] `@DisplayName`으로 테스트 의도가 명확한가?
- [ ] `@ActiveProfiles("test")` 적용되었는가?

## 리뷰 우선순위

| 우선순위 | 항목 | 이유 |
|---------|------|------|
| 🔴 P0 | 보안, 프로덕션 설정 | 즉시 수정 필요 |
| 🟠 P1 | 트랜잭션, 예외 처리, 데이터 정합성 | 런타임 장애 가능 |
| 🟡 P2 | 아키텍처, 네이밍 컨벤션 | 유지보수성 저하 |
| 🟢 P3 | 로깅, 문서, 테스트 | 개선 사항 |

## When to Use This Skill

- PR 코드 리뷰 수행 시
- 코드 작성 후 self-review 시
- 커밋 전 품질 검증 시

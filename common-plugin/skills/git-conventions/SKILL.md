---
name: pg-git-conventions
description: Payquery Git 커밋 메시지 및 브랜치 규칙. Use when creating commits, branches, or pull requests.
---

# Payquery Git Conventions

Payquery 팀의 Git 워크플로우, 커밋 메시지, 브랜치 전략을 정의합니다.

## 커밋 메시지 규칙

### 형식

```
<type>: <subject>

<body> (선택)
```

### Type 목록

| Type | 설명 | 예시 |
|------|------|------|
| `feat` | 새로운 기능 추가 | `feat: 파일 업로드 API 추가` |
| `fix` | 버그 수정 | `fix: S3 업로드 시 signature mismatch 해결` |
| `refactor` | 리팩토링 (기능 변경 없음) | `refactor: FileService 스토리지 전략 패턴 적용` |
| `docs` | 문서 변경 | `docs: API 문서 업데이트` |
| `test` | 테스트 추가/수정 | `test: FileService 단위 테스트 추가` |
| `chore` | 빌드, 설정 변경 | `chore: Spring Boot 4.0.3 업그레이드` |
| `style` | 코드 포매팅 (기능 변경 없음) | `style: import 정리` |
| `perf` | 성능 개선 | `perf: QueryDSL 쿼리 최적화` |
| `ci` | CI/CD 설정 변경 | `ci: Docker 빌드 스크립트 수정` |

### 규칙

- Subject는 한글 또는 영어, 50자 이내
- Type은 소문자
- Subject 끝에 마침표 없음
- Body는 "왜" 변경했는지 설명 (선택)

### 좋은 예시

```
feat: 주문 취소 API 추가

가맹점에서 결제 취소를 요청할 수 있는 API를 추가합니다.
PG사 연동 및 환불 처리 로직을 포함합니다.
```

```
fix: Flyway 마이그레이션 순서 충돌 해결

V20260302_2 마이그레이션이 V20260302_1보다 먼저 실행되는
문제를 파일명 수정으로 해결
```

## 브랜치 전략

### 브랜치 네이밍

```
<type>/<description>
```

| 브랜치 | 용도 | 예시 |
|--------|------|------|
| `main` | 프로덕션 배포 | - |
| `develop` | 개발 통합 | - |
| `feature/*` | 기능 개발 | `feature/file-upload-api` |
| `fix/*` | 버그 수정 | `fix/s3-signature-error` |
| `hotfix/*` | 긴급 수정 | `hotfix/payment-timeout` |
| `release/*` | 릴리스 준비 | `release/1.2.0` |

### 워크플로우

```
1. develop에서 feature 브랜치 생성
2. 기능 개발 및 테스트
3. PR 생성 → 코드 리뷰
4. develop으로 merge
5. release 브랜치에서 QA
6. main으로 merge → 배포
```

## PR (Pull Request) 규칙

### PR 제목

커밋 메시지와 동일한 형식:
```
feat: 파일 업로드 API 추가
```

### PR 본문 템플릿

```markdown
## Summary
- 변경 사항 요약 (1-3줄)

## Changes
- [ ] 변경된 파일/기능 목록

## Test Plan
- [ ] 테스트 방법

## Notes
- 리뷰어가 알아야 할 사항
```

## When to Use This Skill

- Git 커밋 메시지 작성 시
- 브랜치 생성 시
- PR 생성 시

## Checklist

- [ ] 커밋 메시지가 `<type>: <subject>` 형식인가?
- [ ] Type이 적절한가? (feat/fix/refactor/...)
- [ ] Subject가 50자 이내인가?
- [ ] 브랜치명이 `<type>/<description>` 형식인가?
- [ ] PR에 Summary, Changes, Test Plan이 포함되었는가?

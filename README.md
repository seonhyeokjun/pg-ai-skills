# PG AI Skills

Payquery 팀의 AI 코딩 도구용 Skills 모음입니다. 코딩 표준과 Best Practice를 공유합니다.

**지원 도구:**
- Claude Code
- GitHub Copilot
- Cursor AI
- 기타 AI 코딩 어시스턴트

---

## 설치 방법

### 방법 1: Claude Code `/plugin` 명령어 (권장)

```bash
# Git URL로 설치
/plugin install https://github.com/{org}/pg-ai-skills.git

# 또는 로컬 경로
/plugin install ~/pg-ai-skills/backend-plugin
/plugin install ~/pg-ai-skills/common-plugin
```

설치 후 `/skills` 명령어로 확인할 수 있습니다.

### 방법 2: 수동 설치

```bash
# 1. clone
cd ~
git clone https://github.com/{org}/pg-ai-skills.git

# 2. Personal Skills로 복사
mkdir -p ~/.claude/skills
cp -r ~/pg-ai-skills/*/skills/* ~/.claude/skills/
```

---

## 디렉토리 구조

```
pg-ai-skills/
├── backend-plugin/
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── skills/
│   │   ├── api-design/SKILL.md         # API 설계, DTO, 패키지 구조
│   │   ├── error-handling/SKILL.md     # 예외 처리, StatusCode, 로깅
│   │   ├── database-schema/SKILL.md    # Flyway, JPA Entity, QueryDSL
│   │   └── test-writing/SKILL.md       # 테스트 전략, Mockito, AssertJ
│   └── hooks/
│       ├── hooks.json
│       └── security-dispatcher.js      # 보안/멘토링 훅
├── common-plugin/
│   ├── .claude-plugin/
│   │   └── plugin.json
│   └── skills/
│       ├── code-review/SKILL.md        # 코드 리뷰 체크리스트
│       └── git-conventions/SKILL.md    # Git 커밋, 브랜치, PR 규칙
└── .claude-plugin/
    └── marketplace.json
```

---

## Skills 목록

### Backend Plugin

| Skill | 설명 | 자동 적용 시점 |
|-------|------|---------------|
| **api-design** | API 설계, DTO 네이밍, 패키지 구조, ResponseData | API/Controller/DTO 생성 시 |
| **error-handling** | 예외 처리, GlobalExceptionHandler, StatusCode, 로깅 | 예외 클래스 생성, 에러 핸들링 시 |
| **database-schema** | Flyway, JPA Entity, QueryDSL, @Transactional | DB 스키마/Entity/Repository 작성 시 |
| **test-writing** | 테스트 전략, Given-When-Then, Mockito, AssertJ | 테스트 코드 작성 시 |

### Common Plugin

| Skill | 설명 | 자동 적용 시점 |
|-------|------|---------------|
| **code-review** | PR 코드 리뷰 체크리스트 | 코드 리뷰, self-review 시 |
| **git-conventions** | Git 커밋 메시지, 브랜치 전략, PR 규칙 | 커밋, 브랜치 생성, PR 시 |

### Hooks (Backend Plugin)

| Hook | 트리거 | 동작 |
|------|--------|------|
| **security-dispatcher** | Edit/Write 시 | 프로덕션 설정 수정 차단, .env 수정 차단, Controller/Entity/Service 수정 시 멘토링, Flyway 네이밍 검사 |

---

## 핵심 컨벤션 요약

| 항목 | 규칙 |
|------|------|
| Java | 21 |
| Spring Boot | 3.4+ (4.x 호환) |
| Request DTO | class + `@Builder(access = PRIVATE)` + `of()` |
| Response DTO | record + `@Builder(access = PRIVATE)` + `of()` |
| Entity | `@NoArgsConstructor(PROTECTED)` + `@Builder(PRIVATE)` + 정적 팩토리 |
| 응답 래퍼 | `ResponseData<T>` (status, message, data) |
| 예외 | `ex/{domain}/` + `StatusCode` enum + `GlobalExceptionHandler` |
| Flyway | `V{YYYYMMDD}_{순번}__{설명}.sql` + MySQL COMMENT 필수 |
| Audit | `created_date`, `modified_date` (DATETIME(6), ON UPDATE) |
| 트랜잭션 | 조회: `readOnly = true`, 변경: `@Transactional` |
| QueryDSL | `*RepositoryCustom` + `*RepositoryImpl` + `BooleanExpression` 헬퍼 |
| 테스트 | H2 인메모리, Flyway OFF, Given-When-Then, `@ActiveProfiles("test")` |
| Lombok | `@Slf4j`, `@Getter`, `@RequiredArgsConstructor`, `@Builder` |

---

## 기여하기

1. 브랜치 생성: `feature/add-{skill-name}-skill`
2. SKILL.md 작성 (표준 형식 준수)
3. PR 생성 → 리뷰
4. merge

---

**Built for AI-powered development at Payquery**

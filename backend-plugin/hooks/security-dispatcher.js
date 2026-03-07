const fs = require('fs');

console.error('🚀 PG Security Dispatcher 실행');

// ========================================
// 프로젝트 구조 분석
// ========================================
function analyzeProject() {
    try {
        const buildGradle = fs.readFileSync('build.gradle', 'utf8');
        return {
            hasValidation: buildGradle.includes('spring-boot-starter-validation') || buildGradle.includes('jakarta.validation'),
            hasSecurity: buildGradle.includes('spring-boot-starter-security'),
            hasJpa: buildGradle.includes('spring-boot-starter-data-jpa'),
            hasKafka: buildGradle.includes('spring-boot-starter-kafka') || buildGradle.includes('spring-kafka'),
            hasSwagger: buildGradle.includes('springdoc') || buildGradle.includes('swagger'),
            hasFlyway: buildGradle.includes('flyway'),
            hasQueryDsl: buildGradle.includes('querydsl'),
        };
    } catch (e) {
        return null;
    }
}

function logProjectContext(fileType) {
    const project = analyzeProject();
    if (!project) return;

    console.error('\n🔍 프로젝트 분석:');
    if (project.hasValidation) console.error('   ✅ Jakarta Validation 사용');
    if (project.hasSecurity) console.error('   🔐 Spring Security 적용');
    if (project.hasJpa) console.error('   💾 Spring Data JPA 사용');
    if (project.hasKafka) console.error('   📨 Kafka 사용');
    if (project.hasSwagger) console.error('   📖 SpringDoc Swagger → @Schema 어노테이션 필요');
    if (project.hasFlyway) console.error('   🗄️ Flyway → 마이그레이션 파일 필요할 수 있음');
    if (project.hasQueryDsl) console.error('   🔎 QueryDSL 사용');
    console.error('');
}

try {
    const input = fs.readFileSync(0, 'utf8');
    const data = JSON.parse(input);

    const toolName = data.tool_name;
    const filePath = data.tool_input.path || data.tool_input.file_path || '';

    console.error(`🔧 Tool: ${toolName}, 📁 File: ${filePath}`);

    // ========================================
    // 규칙 1: 프로덕션 설정 파일 수정 차단
    // ========================================
    // if (filePath.includes('application-prod') || filePath.includes('application-production')) {
    //     if (toolName === 'Edit' || toolName === 'Write') {
    //         console.error('❌ 보안 규칙 위반: 프로덕션 설정 파일은 수정할 수 없습니다.');
    //         process.exit(2);
    //     }
    // }

    // ========================================
    // 규칙 2: .env 파일 수정 차단
    // ========================================
    // if (filePath.endsWith('.env') || filePath.includes('.env.')) {
    //     if (toolName === 'Edit' || toolName === 'Write') {
    //         console.error('❌ 보안 규칙 위반: .env 파일은 직접 수정할 수 없습니다.');
    //         process.exit(2);
    //     }
    // }

    // ========================================
    // 규칙 3: Flyway 마이그레이션 파일 네이밍 검사
    // ========================================
    // if (filePath.includes('db/migration/') && filePath.endsWith('.sql')) {
    //     const fileName = filePath.split('/').pop() || '';
    //     const flywayPattern = /^V\d{8}_\d+__\w+\.sql$/;
    //     if (!flywayPattern.test(fileName)) {
    //         console.error(`⚠️ Flyway 네이밍 규칙 위반: ${fileName}`);
    //         console.error('   올바른 형식: V{YYYYMMDD}_{순번}__{설명}.sql');
    //         console.error('   예: V20260303_1__create_user_table.sql');
    //         // 경고만 하고 차단하지 않음
    //     }
    // }

    // ========================================
    // 규칙 4: Controller 수정 시 멘토링
    // ========================================
    if (filePath.includes('/controller/') && filePath.endsWith('.java') && (toolName === 'Edit' || toolName === 'Write')) {
        const fileName = filePath.split('/').pop() || '';
        const entityName = fileName.replace(/Controller\.java$/i, '');

        console.error(`\n🎯 [Controller 수정 감지] ${entityName}Controller 수정 전 확인:`);
        console.error(`   📋 관련 파일을 먼저 확인했는가?`);
        console.error(`   - ${entityName}.java (Entity)`);
        console.error(`   - ${entityName}Service.java (Service)`);
        console.error(`   - ${entityName}Repository.java (Repository)`);
        console.error(`   - 기존 API 패턴과의 일관성`);
        logProjectContext('controller');
        console.error('먼저 관련 파일들을 읽고 계획을 세워주세요!');
        process.exit(0);
    }

    // ========================================
    // 규칙 5: Entity 수정 시 영향도 경고
    // ========================================
    if (filePath.includes('/entity/') && filePath.endsWith('.java') && (toolName === 'Edit' || toolName === 'Write')) {
        const fileName = filePath.split('/').pop() || '';
        const entityName = fileName.replace(/\.java$/i, '');

        console.error(`\n🗃️ [Entity 수정 경고] ${entityName} 데이터 모델 변경 체크리스트:`);
        console.error('   □ 기존 데이터 호환성 확인');
        console.error('   □ Flyway 마이그레이션 스크립트 필요 여부');
        console.error('   □ API 응답 변경 여부');
        console.error('   □ 연관된 Repository/Service 수정 필요성');
        console.error('   □ MySQL COMMENT 추가 여부');
        logProjectContext('entity');
        console.error('영향도를 분석한 후 진행하세요.');
        process.exit(0);
    }

    // ========================================
    // 규칙 6: Service 수정 시 멘토링
    // ========================================
    if (filePath.includes('/service/') && filePath.endsWith('Service.java') && (toolName === 'Edit' || toolName === 'Write')) {
        const fileName = filePath.split('/').pop() || '';
        const serviceName = fileName.replace(/Service\.java$/i, '');

        console.error(`\n⚙️ [Service 수정 감지] ${serviceName}Service 수정 전 확인:`);
        console.error('   - @Transactional 범위 확인 (readOnly 여부)');
        console.error('   - 예외 처리 일관성 (StatusCode enum 사용)');
        console.error('   - 보상 트랜잭션 필요 여부');
        console.error('   - 단위 테스트 커버리지');
        logProjectContext('service');
        process.exit(0);
    }

    // ========================================
    // 규칙 7: 테스트에서 실제 외부 API 호출 경고
    // ========================================
    if (filePath.includes('src/test/') && filePath.endsWith('Test.java') && toolName === 'Write') {
        const content = data.tool_input.content || '';
        const externalApis = ['api.tosspayments.com', 'api.kakaopay.com', 'amazonaws.com'];
        const hasExternalApi = externalApis.some(api => content.includes(api));

        if (hasExternalApi && !content.includes('@Disabled')) {
            console.error('⚠️ 경고: 실제 외부 API를 호출하는 테스트는 @Disabled 추가를 권장합니다.');
        }
    }

    console.error('✅ 모든 규칙 통과');
    process.exit(0);

} catch (error) {
    console.error(`❌ 디스패처 오류: ${error.message}`);
    process.exit(0); // 오류 시에도 작업 진행
}

-- Phase 2: Workflow Templates 15종
CREATE TABLE IF NOT EXISTS workflow_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,                        -- 'writing' | 'coding' | 'translation' | 'analysis' | 'social'
    icon TEXT NOT NULL DEFAULT 'Workflow',
    steps_json TEXT NOT NULL,                      -- JSON array of step definitions
    is_builtin INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 15종 내장 템플릿 시드
INSERT OR IGNORE INTO workflow_templates (id, name, description, category, icon, steps_json) VALUES
-- 글쓰기/SNS (5종)
(1, 'SNS 콘텐츠 생성기', '주제 → 아이디어 브레인스토밍 → 초안 작성 → 해시태그 추가', 'social', 'Share2',
 '[{"name":"아이디어 생성","prompt":"다음 주제로 SNS 포스팅 아이디어 5개를 짧게 제안해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"초안 작성","prompt":"위 아이디어 중 가장 좋은 것으로 SNS 포스팅 초안을 써주세요. 친근하고 참여를 유도하는 톤으로.\n{{input}}","model":"claude-sonnet-4-6"},{"name":"해시태그 추가","prompt":"위 포스팅에 적절한 한국어·영어 해시태그 10개를 추가해주세요:\n{{input}}","model":"gemini-1.5-flash"}]'),
(2, '블로그 포스트 작성', '키워드 → SEO 제목 → 개요 → 본문 작성', 'writing', 'FileText',
 '[{"name":"SEO 제목 생성","prompt":"다음 키워드로 클릭율 높은 블로그 제목 5개를 제안해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"개요 작성","prompt":"선택된 제목으로 블로그 포스트 개요(목차)를 작성해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"본문 작성","prompt":"위 개요를 바탕으로 2000자 내외의 블로그 본문을 작성해주세요:\n{{input}}","model":"claude-sonnet-4-6"}]'),
(3, '이메일 작성 도우미', '목적 → 초안 → 다듬기 → 제목 생성', 'writing', 'Mail',
 '[{"name":"이메일 초안","prompt":"다음 목적으로 프로페셔널한 이메일 초안을 작성해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"이메일 다듬기","prompt":"이 이메일을 더 명확하고 간결하게 다듬어주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"제목 생성","prompt":"이 이메일의 적절한 제목 3개를 제안해주세요:\n{{input}}","model":"gemini-1.5-flash"}]'),
(4, '유튜브 스크립트 작성', '주제 → 후크 → 본문 스크립트 → 설명란', 'social', 'Video',
 '[{"name":"후크 작성","prompt":"유튜브 영상의 처음 15초 후크(시청자를 사로잡는 오프닝)를 작성해주세요. 주제: {{input}}","model":"claude-sonnet-4-6"},{"name":"스크립트 본문","prompt":"위 후크에 이어지는 5분 분량의 유튜브 스크립트를 작성해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"설명란 작성","prompt":"이 영상의 유튜브 설명란(SEO 최적화, 타임스탬프 포함)을 작성해주세요:\n{{input}}","model":"gemini-1.5-flash"}]'),
(5, '광고 카피 생성', '제품/서비스 → 타겟 분석 → 카피 5버전 작성', 'writing', 'Megaphone',
 '[{"name":"타겟 분석","prompt":"다음 제품/서비스의 핵심 타겟 고객을 분석해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"광고 카피 작성","prompt":"위 타겟에게 어필하는 광고 카피를 5가지 버전으로 작성해주세요 (짧은 슬로건 포함):\n{{input}}","model":"claude-sonnet-4-6"}]'),
-- 코딩 (3종)
(6, '코드 리뷰 & 개선', '코드 입력 → 버그 탐지 → 개선 제안 → 리팩토링', 'coding', 'Code2',
 '[{"name":"버그 탐지","prompt":"다음 코드의 버그, 보안 취약점, 성능 문제를 찾아주세요:\n```\n{{input}}\n```","model":"claude-sonnet-4-6"},{"name":"개선 제안","prompt":"위 분석을 바탕으로 구체적인 개선 방법을 제안해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"리팩토링","prompt":"위 제안을 반영해 코드를 리팩토링해주세요. 변경 사항을 설명과 함께 보여주세요:\n{{input}}","model":"claude-sonnet-4-6"}]'),
(7, '문서화 자동 생성', '코드 → 함수 분석 → JSDoc/docstring → README 섹션', 'coding', 'BookOpen',
 '[{"name":"함수 분석","prompt":"다음 코드의 함수/클래스를 분석하고 목적을 설명해주세요:\n```\n{{input}}\n```","model":"claude-sonnet-4-6"},{"name":"JSDoc 작성","prompt":"위 분석을 바탕으로 JSDoc/docstring 주석을 작성해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"README 섹션","prompt":"이 모듈/함수에 대한 README 섹션(사용법 예시 포함)을 마크다운으로 작성해주세요:\n{{input}}","model":"claude-sonnet-4-6"}]'),
(8, '단위 테스트 생성', '코드 → 테스트 케이스 도출 → 테스트 코드 작성', 'coding', 'TestTube',
 '[{"name":"테스트 케이스 도출","prompt":"다음 코드의 단위 테스트 케이스(정상/엣지/실패 케이스)를 나열해주세요:\n```\n{{input}}\n```","model":"claude-sonnet-4-6"},{"name":"테스트 코드 작성","prompt":"위 테스트 케이스를 Jest/Vitest 테스트 코드로 작성해주세요:\n{{input}}","model":"claude-sonnet-4-6"}]'),
-- 번역 (2종)
(9, '전문 번역 + 교정', '원문 → 번역 → 자연스럽게 다듬기 → 용어 통일', 'translation', 'Languages',
 '[{"name":"초벌 번역","prompt":"다음 텍스트를 한국어로 번역해주세요. 직역 위주로:\n{{input}}","model":"gemini-1.5-flash"},{"name":"자연스럽게 다듬기","prompt":"위 번역을 한국 독자에게 자연스럽도록 의역·다듬어주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"전문 용어 통일","prompt":"위 번역에서 전문 용어가 일관되게 사용되었는지 검토하고 최종본을 제공해주세요:\n{{input}}","model":"claude-sonnet-4-6"}]'),
(10, '다국어 동시 번역', '한국어 원문 → 영어·일본어·중국어 동시 번역', 'translation', 'Globe',
 '[{"name":"영어 번역","prompt":"다음 한국어를 자연스러운 영어로 번역해주세요:\n{{input}}","model":"gemini-1.5-flash"},{"name":"일본어 번역","prompt":"다음 한국어를 자연스러운 일본어로 번역해주세요:\n{{input}}","model":"gemini-1.5-flash"},{"name":"중국어 번역","prompt":"다음 한국어를 자연스러운 중국어(간체)로 번역해주세요:\n{{input}}","model":"gemini-1.5-flash"}]'),
-- 분석 (3종)
(11, '문서 요약 + 핵심 추출', '긴 문서 → 요약 → 핵심 포인트 → 액션 아이템', 'analysis', 'FileSearch',
 '[{"name":"문서 요약","prompt":"다음 문서를 3단락으로 요약해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"핵심 포인트 추출","prompt":"위 문서에서 핵심 포인트 5개를 불릿 포인트로 추출해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"액션 아이템","prompt":"이 문서를 바탕으로 즉시 실행 가능한 액션 아이템을 제안해주세요:\n{{input}}","model":"claude-sonnet-4-6"}]'),
(12, '경쟁사 분석 리포트', '경쟁사 정보 → SWOT 분석 → 차별화 전략', 'analysis', 'BarChart2',
 '[{"name":"SWOT 분석","prompt":"다음 경쟁사 정보를 바탕으로 SWOT 분석을 해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"차별화 전략","prompt":"위 SWOT 분석을 바탕으로 우리 제품의 차별화 전략 3가지를 제안해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"실행 계획","prompt":"위 전략을 단기(1개월)/중기(3개월)/장기(1년) 실행 계획으로 정리해주세요:\n{{input}}","model":"claude-sonnet-4-6"}]'),
(13, '회의록 요약 + 정리', '회의록 원문 → 핵심 결정사항 → 담당자 액션 아이템', 'analysis', 'ClipboardList',
 '[{"name":"핵심 결정사항","prompt":"다음 회의록에서 핵심 결정사항을 정리해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"액션 아이템 정리","prompt":"위 회의에서 각 담당자의 액션 아이템을 표 형식으로 정리해주세요:\n{{input}}","model":"claude-sonnet-4-6"}]'),
-- 기타 (2종)
(14, '아이디어 확장 브레인스토밍', '씨앗 아이디어 → 확장 → 실현 가능성 평가 → 로드맵', 'analysis', 'Lightbulb',
 '[{"name":"아이디어 확장","prompt":"다음 씨앗 아이디어를 10개의 구체적인 아이디어로 확장해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"실현 가능성 평가","prompt":"위 아이디어들을 실현 가능성·임팩트·비용을 기준으로 평가하고 Top 3를 선정해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"로드맵 작성","prompt":"선정된 Top 1 아이디어의 6개월 실행 로드맵을 작성해주세요:\n{{input}}","model":"claude-sonnet-4-6"}]'),
(15, '제품 스펙 문서 작성', '요구사항 → 사용자 스토리 → 기술 스펙 → 우선순위', 'writing', 'Package',
 '[{"name":"사용자 스토리","prompt":"다음 요구사항으로 Agile 사용자 스토리를 작성해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"기술 스펙","prompt":"위 사용자 스토리를 구현하기 위한 기술 스펙을 작성해주세요:\n{{input}}","model":"claude-sonnet-4-6"},{"name":"우선순위 매트릭스","prompt":"위 기능들을 MoSCoW 방법으로 우선순위를 매겨주세요 (Must/Should/Could/Won''t):\n{{input}}","model":"claude-sonnet-4-6"}]');

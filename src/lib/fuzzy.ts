/**
 * 퍼지 검색 — 명령 팔레트 아이템 검색
 * 문자 순서 일치 + 위치 가중치 스코어링
 */

export interface FuzzyResult<T> {
  item: T;
  score: number;
  matches: number[]; // 강조할 인덱스 배열
}

/**
 * 단일 아이템 퍼지 매칭
 * @returns null if no match, FuzzyResult otherwise
 */
export function fuzzyMatch<T>(
  item: T,
  getText: (item: T) => string,
  query: string
): FuzzyResult<T> | null {
  if (!query) return { item, score: 1, matches: [] };

  const text = getText(item).toLowerCase();
  const q = query.toLowerCase();

  let score = 0;
  const matches: number[] = [];
  let qi = 0;
  let lastMatchIdx = -1;

  for (let ti = 0; ti < text.length && qi < q.length; ti++) {
    if (text[ti] === q[qi]) {
      matches.push(ti);

      // 연속 매치 보너스
      const isConsecutive = lastMatchIdx !== -1 && ti === lastMatchIdx + 1;
      score += isConsecutive ? 2 : 1;

      // 단어 시작 보너스 (공백, 하이픈 뒤)
      if (ti === 0 || text[ti - 1] === ' ' || text[ti - 1] === '-' || text[ti - 1] === '_') {
        score += 3;
      }

      lastMatchIdx = ti;
      qi++;
    }
  }

  // 쿼리 전체 매치 실패
  if (qi < q.length) return null;

  // 짧은 텍스트일수록 높은 점수 (더 정확한 매치)
  score = score / Math.log(text.length + 2);

  return { item, score, matches };
}

/**
 * 아이템 배열에 퍼지 검색 적용, 스코어 내림차순 정렬
 */
export function fuzzySearch<T>(
  items: T[],
  getText: (item: T) => string,
  query: string
): FuzzyResult<T>[] {
  if (!query.trim()) {
    return items.map((item) => ({ item, score: 1, matches: [] }));
  }

  return items
    .map((item) => fuzzyMatch(item, getText, query))
    .filter((r): r is FuzzyResult<T> => r !== null)
    .sort((a, b) => b.score - a.score);
}

/**
 * 강조 표시용 — 매치 인덱스에 따라 텍스트를 spans로 분리
 */
export function highlightMatches(
  text: string,
  matches: number[]
): Array<{ text: string; highlight: boolean }> {
  if (matches.length === 0) return [{ text, highlight: false }];

  const matchSet = new Set(matches);
  const segments: Array<{ text: string; highlight: boolean }> = [];
  let current = '';
  let currentHighlight = false;

  for (let i = 0; i < text.length; i++) {
    const shouldHighlight = matchSet.has(i);
    if (shouldHighlight !== currentHighlight && current) {
      segments.push({ text: current, highlight: currentHighlight });
      current = '';
    }
    currentHighlight = shouldHighlight;
    current += text[i];
  }
  if (current) segments.push({ text: current, highlight: currentHighlight });

  return segments;
}

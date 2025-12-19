/**
 * 수학 계산 유틸리티 함수
 */

/**
 * 값을 한 범위에서 다른 범위로 매핑합니다.
 * @param value - 매핑할 값
 * @param inMin - 입력 범위 최소값
 * @param inMax - 입력 범위 최대값
 * @param outMin - 출력 범위 최소값
 * @param outMax - 출력 범위 최대값
 * @returns 매핑된 값
 */
export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

/**
 * 배열을 Fisher-Yates 알고리즘으로 섞습니다.
 * @param array - 섞을 배열
 * @returns 섞인 새 배열
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

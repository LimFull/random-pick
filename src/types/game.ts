/**
 * 게임 관련 타입 정의
 */

import type { Participant } from './participant';

/**
 * 경마 게임 상태
 */
export type GameState = 'idle' | 'racing' | 'finished';

/**
 * 경마 순위 정보
 */
export interface Ranking {
  name: string;
  rank: number;
}

/**
 * 경마 완료 결과
 */
export interface RaceResult {
  winner: string;
  rankings: Ranking[];
}

/**
 * 돌림판 회전 완료 결과 타입
 * 경마 결과 또는 돌림판 결과를 받을 수 있음
 */
export type SpinCompleteResult = string | Participant | RaceResult;


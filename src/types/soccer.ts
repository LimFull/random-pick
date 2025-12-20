/**
 * 축구 게임 관련 타입 정의
 */

import type { Participant } from './participant';

/**
 * 팀 타입
 */
export type Team = 'red' | 'blue';

/**
 * 플레이어 능력치
 */
export interface PlayerStats {
  shootingAccuracy: number;    // 슈팅 정확도 (0-100)
  shootingPower: number;       // 슈팅 파워 (0-100)
  longShotFrequency: number;   // 롱슛 빈도 (0-100)
  dribbleSpeed: number;        // 드리블 속도 (0-100)
  dribbleAttempt: number;      // 드리블 시도 성향 (0-100, 높을수록 드리블 선호)
  breakthroughAttempt: number; // 돌파 시도 성향 (0-100, 높을수록 상대를 피하지 않고 직진)
  strength: number;            // 힘 (0-100)
  defense: number;             // 수비력 (0-100)
  speed: number;               // 이동 속도 (0-100)
  positioning: number;         // 위치 선정 (0-100)
  defensiveAggression: number; // 수비 적극성 (0-100, 높을수록 적극적으로 공 뺏으러 감)
  vision: number;              // 시야 (0-100, 높을수록 크로스/컷백 시도 확률 높음)
}

/**
 * 축구 플레이어
 */
export interface SoccerPlayer extends Participant {
  team: Team;
  stats: PlayerStats;
  isGoalkeeper: boolean;
}

/**
 * 팀 구성 설정
 */
export interface SoccerSetup {
  redTeam: SoccerPlayer[];
  blueTeam: SoccerPlayer[];
  matchDuration: number;       // 분 단위
  useAIGoalkeeper: boolean;
}

/**
 * 축구 게임 결과
 */
export interface SoccerResult {
  redScore: number;
  blueScore: number;
  winner: Team | 'draw';
  scorers: ScorerInfo[];
}

/**
 * 득점자 정보
 */
export interface ScorerInfo {
  playerName: string;
  team: Team;
  time: number;  // 초 단위
}

/**
 * 게임 상태
 */
export type SoccerGameState = 'setup' | 'playing' | 'finished';

/**
 * 팀 구성 화면에서 사용하는 참가자 (팀 할당 전)
 */
export interface TeamAssignment {
  participant: Participant;
  team: Team;
}

/**
 * 랜덤 능력치 생성 함수
 */
export function generateRandomStats(): PlayerStats {
  return {
    shootingAccuracy: Math.floor(Math.random() * 101),
    shootingPower: Math.floor(Math.random() * 101),
    longShotFrequency: Math.floor(Math.random() * 101),
    dribbleSpeed: Math.floor(Math.random() * 101),
    dribbleAttempt: Math.floor(Math.random() * 101),
    breakthroughAttempt: Math.floor(Math.random() * 101),
    strength: Math.floor(Math.random() * 101),
    defense: Math.floor(Math.random() * 101),
    speed: Math.floor(Math.random() * 61) + 40, // 최소 40
    positioning: Math.floor(Math.random() * 61) + 40, // 최소 40
    defensiveAggression: Math.floor(Math.random() * 101),
    vision: Math.floor(Math.random() * 101),
  };
}

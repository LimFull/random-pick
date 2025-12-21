/**
 * 축구 게임 내부 타입 정의
 */

import Phaser from 'phaser';
import type { SoccerPlayer, SoccerSetup, Team } from '../types/soccer';

/**
 * 게임 단계
 */
export type GamePhase = 'playing' | 'goal' | 'finished';

/**
 * 플레이어 역할
 */
export type PlayerRole = 'goalkeeper' | 'defender' | 'midfielder' | 'attacker';

/**
 * 플레이어 스프라이트 인터페이스
 */
export interface PlayerSprite extends Phaser.Physics.Arcade.Sprite {
  playerData: SoccerPlayer;
  team: Team;
  hasBall: boolean;
  facingAngle: number;
  nameText: Phaser.GameObjects.Text;
  role: PlayerRole;
  tackleCooldown: number;
  stunTime: number;
  ballAcquireCooldown: number;
  dribbleTarget: { x: number; y: number } | null;
  dribbleTargetTime: number;
  isPenetrating: boolean;
  penetratingTarget: { x: number; y: number } | null;
  penetratingDecisionTime: number;
  isPressing: boolean;
  chaseDecisionTime: number;
}

/**
 * 공 스프라이트 인터페이스
 */
export interface BallSprite extends Phaser.Physics.Arcade.Sprite {
  owner: PlayerSprite | null;
  isAirborne: boolean;
  targetPosition: { x: number; y: number } | null;
}

/**
 * 게임 컨텍스트 - AI 및 액션 함수에 전달되는 공유 상태
 */
export interface GameContext {
  scene: Phaser.Scene;
  players: PlayerSprite[];
  ball: BallSprite | null;
  fieldWidth: number;
  fieldHeight: number;
  goalWidth: number;
  goalHeight: number;
  isKickoff: boolean;
  kickoffPlayer: PlayerSprite | null;
  setKickoffState: (isKickoff: boolean, player: PlayerSprite | null) => void;
}

/**
 * 위치 영역
 */
export interface PositionZone {
  minY: number;
  maxY: number;
}

/**
 * 갭 정보 (수비수 사이 빈 공간)
 */
export interface GapInfo {
  x: number;
  width: number;
}

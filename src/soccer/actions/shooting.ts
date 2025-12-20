/**
 * 슈팅 관련 액션
 */

import Phaser from 'phaser';
import type { PlayerSprite, GameContext } from '../types';

/**
 * 슈팅 시도
 */
export function attemptShot(ctx: GameContext, player: PlayerSprite): void {
  if (!ctx.ball) return;

  const stats = player.playerData.stats;
  const goalY = player.team === 'red' ? ctx.fieldHeight : 0;
  const goalCenterX = ctx.fieldWidth / 2;
  const goalHalfWidth = ctx.goalWidth / 2;

  // 골대 좌우 포스트 위치
  const leftPostX = goalCenterX - goalHalfWidth + 5;
  const rightPostX = goalCenterX + goalHalfWidth - 5;

  // 니어포스트와 파포스트 결정
  const nearPostX = player.x < goalCenterX ? leftPostX : rightPostX;
  const farPostX = player.x < goalCenterX ? rightPostX : leftPostX;

  // 상대 골키퍼 찾기
  const opponentTeam = player.team === 'red' ? 'blue' : 'red';
  const goalkeeper = ctx.players.find(p => p.team === opponentTeam && p.role === 'goalkeeper');

  // 각 포스트로의 슈팅 각도 계산
  const angleToNearPost = Math.abs(Phaser.Math.Angle.Between(player.x, player.y, nearPostX, goalY));
  const angleToFarPost = Math.abs(Phaser.Math.Angle.Between(player.x, player.y, farPostX, goalY));

  // 골키퍼가 막고 있는 영역 계산
  let nearPostOpen = 1.0;
  let farPostOpen = 1.0;

  if (goalkeeper) {
    const gkX = goalkeeper.x;
    const gkBlockRadius = 35;

    const distToNearPost = Math.abs(gkX - nearPostX);
    const distToFarPost = Math.abs(gkX - farPostX);

    nearPostOpen = Math.min(1.0, distToNearPost / (gkBlockRadius * 2));
    farPostOpen = Math.min(1.0, distToFarPost / (gkBlockRadius * 2));

    nearPostOpen = Math.max(0.1, nearPostOpen);
    farPostOpen = Math.max(0.1, farPostOpen);
  }

  // 득점 가능성 계산
  const nearPostScore = nearPostOpen * (1 + Math.abs(Math.sin(angleToNearPost)));
  const farPostScore = farPostOpen * (1 + Math.abs(Math.sin(angleToFarPost)));

  const totalScore = nearPostScore + farPostScore;
  const nearPostProbability = nearPostScore / totalScore;

  const chosenPostX = Math.random() < nearPostProbability ? nearPostX : farPostX;

  // 공 소유권 해제
  player.hasBall = false;
  ctx.ball.owner = null;
  player.ballAcquireCooldown = 600;

  // 슈팅 정확도에 따른 미스 확률
  const accuracy = stats.shootingAccuracy;
  const missChance = 0.05 + (100 - accuracy) * 0.0065;
  const isMiss = Math.random() < missChance;

  let targetX: number;

  if (isMiss) {
    const missOffset = 25 + Math.random() * 45;

    if (chosenPostX < goalCenterX) {
      targetX = leftPostX - missOffset;
    } else {
      targetX = rightPostX + missOffset;
    }
  } else {
    const errorRange = (100 - accuracy) * 0.3;
    const error = (Math.random() - 0.5) * errorRange;

    if (chosenPostX < goalCenterX) {
      targetX = chosenPostX + 10 + error;
    } else {
      targetX = chosenPostX - 10 + error;
    }
  }

  // 공 속도 설정
  const angle = Phaser.Math.Angle.Between(ctx.ball.x, ctx.ball.y, targetX, goalY);
  const power = stats.shootingPower * 3.5 + 200;

  ctx.ball.setVelocity(
    Math.cos(angle) * power,
    Math.sin(angle) * power
  );
}

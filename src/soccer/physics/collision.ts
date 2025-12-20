/**
 * 충돌 처리 로직
 */

import Phaser from 'phaser';
import type { PlayerSprite, BallSprite, GameContext } from '../types';

/**
 * 공 획득
 */
export function acquireBall(ctx: GameContext, player: PlayerSprite): void {
  if (!ctx.ball) return;

  // 기존 소유자 해제
  if (ctx.ball.owner) {
    ctx.ball.owner.hasBall = false;
  }

  // 새 소유자 설정
  ctx.ball.owner = player;
  player.hasBall = true;
  ctx.ball.setVelocity(0, 0);
}

/**
 * 태클 시도
 */
export function attemptTackle(
  ctx: GameContext,
  tackler: PlayerSprite,
  ballOwner: PlayerSprite
): void {
  // 쿨다운 중이면 태클 불가
  if (tackler.tackleCooldown > 0) {
    return;
  }

  const tacklerStats = tackler.playerData.stats;
  const ownerStats = ballOwner.playerData.stats;

  // 태클 성공 확률 계산
  const tackleChance = (tacklerStats.defense + tacklerStats.strength) /
                       (ownerStats.dribbleSpeed + ownerStats.strength + 80);

  const roll = Math.random();

  if (roll < tackleChance) {
    // 태클 성공 - 공 빼앗기
    acquireBall(ctx, tackler);

    // 기존 소유자가 튕겨남
    const angle = Phaser.Math.Angle.Between(tackler.x, tackler.y, ballOwner.x, ballOwner.y);
    const pushForce = 200 + tacklerStats.strength * 2;
    ballOwner.setVelocity(
      Math.cos(angle) * pushForce,
      Math.sin(angle) * pushForce
    );

    ballOwner.tackleCooldown = 800;
    tackler.tackleCooldown = 500;
    ballOwner.stunTime = 400;
  } else {
    // 태클 실패
    const angle = Phaser.Math.Angle.Between(ballOwner.x, ballOwner.y, tackler.x, tackler.y);
    const pushForce = 350 + ownerStats.strength * 3;

    tackler.setVelocity(
      Math.cos(angle) * pushForce,
      Math.sin(angle) * pushForce
    );

    tackler.tackleCooldown = 1200;
    tackler.stunTime = 600;
  }
}

/**
 * 플레이어 간 충돌 처리
 */
export function handlePlayerCollision(
  ctx: GameContext,
  player1: PlayerSprite,
  player2: PlayerSprite
): void {
  // 같은 팀이면 단순 충돌
  if (player1.team === player2.team) return;

  // 한 선수가 공을 가진 경우 - 태클 시도
  if (player1.hasBall) {
    attemptTackle(ctx, player2, player1);
  } else if (player2.hasBall) {
    attemptTackle(ctx, player1, player2);
  }
}

/**
 * 공과 플레이어 충돌 처리
 */
export function handleBallPlayerCollision(
  ctx: GameContext,
  ball: BallSprite,
  player: PlayerSprite
): void {
  if (ball.isAirborne) return;
  if (ball.owner === player) return;
  if (player.ballAcquireCooldown > 0) return;

  // 골키퍼 특별 처리
  if (player.playerData.isGoalkeeper) {
    const ballSpeed = ball.body?.velocity ?
      Math.sqrt(ball.body.velocity.x ** 2 + ball.body.velocity.y ** 2) : 0;

    if (ballSpeed > 150) {
      // 세이브
      const deflectAngle = Phaser.Math.Angle.Between(player.x, player.y, ball.x, ball.y);
      const deflectPower = ballSpeed * 0.4;
      ball.setVelocity(
        Math.cos(deflectAngle) * deflectPower,
        Math.sin(deflectAngle) * deflectPower
      );
      return;
    } else {
      acquireBall(ctx, player);
      return;
    }
  }

  // 드리블 상태의 공
  if (ball.owner && ball.owner.team !== player.team) {
    attemptTackle(ctx, player, ball.owner);
  } else if (!ball.owner) {
    acquireBall(ctx, player);
  } else if (ball.owner && ball.owner.team === player.team) {
    acquireBall(ctx, player);
  }
}

/**
 * 패스 관련 액션
 */

import Phaser from 'phaser';
import type { PlayerSprite, GameContext } from '../types';

/**
 * 패스 경로에 있는 상대 선수 찾기
 */
export function getPlayersInPath(
  ctx: GameContext,
  from: PlayerSprite,
  to: PlayerSprite
): PlayerSprite[] {
  return ctx.players.filter(p => {
    if (p === from || p === to) return false;
    if (p.team === from.team) return false;

    // 두 점 사이의 거리와 p까지의 거리로 경로상에 있는지 확인
    const totalDist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const distFromStart = Phaser.Math.Distance.Between(from.x, from.y, p.x, p.y);
    const distToEnd = Phaser.Math.Distance.Between(p.x, p.y, to.x, to.y);

    // 경로 근처에 있는지 확인 (오차 허용)
    return distFromStart + distToEnd < totalDist + 40;
  });
}

/**
 * 최적의 패스 대상 찾기
 */
export function findBestPassTarget(
  ctx: GameContext,
  player: PlayerSprite,
  teammates: PlayerSprite[]
): PlayerSprite | null {
  const goalY = player.team === 'red' ? ctx.fieldHeight : 0;

  // 너무 가까운 선수는 제외
  const validTargets = teammates.filter(t =>
    Phaser.Math.Distance.Between(player.x, player.y, t.x, t.y) > 40
  );

  if (validTargets.length === 0) return null;

  // 각 팀원에게 점수 부여 (상대 골대에 가까울수록 높은 점수)
  const scoredTargets = validTargets.map(target => {
    const distToGoal = Math.abs(target.y - goalY);
    const maxDist = ctx.fieldHeight;

    // 골대에 가까울수록 높은 점수 (0~1 범위)
    const goalProximityScore = 1 - (distToGoal / maxDist);

    // 패스 거리 점수 (너무 멀면 감점)
    const passDist = Phaser.Math.Distance.Between(player.x, player.y, target.x, target.y);
    const passDistScore = Math.max(0, 1 - (passDist / (ctx.fieldWidth * 0.8)));

    // 상대 골대 근접성에 더 높은 가중치
    const totalScore = goalProximityScore * 2 + passDistScore;

    return { target, score: totalScore };
  });

  // 점수 기반 확률적 선택
  const totalScore = scoredTargets.reduce((sum, t) => sum + t.score, 0);

  if (totalScore <= 0) {
    return validTargets[0];
  }

  // 가중치 랜덤 선택
  let random = Math.random() * totalScore;
  for (const { target, score } of scoredTargets) {
    random -= score;
    if (random <= 0) {
      return target;
    }
  }

  return scoredTargets[0].target;
}

/**
 * 땅볼 패스 실행
 */
export function groundPass(
  ctx: GameContext,
  player: PlayerSprite,
  target: PlayerSprite
): void {
  if (!ctx.ball) return;

  const stats = player.playerData.stats;

  // 공 소유권 해제
  player.hasBall = false;
  ctx.ball.owner = null;
  player.ballAcquireCooldown = 500;

  // 패스 정확도에 따른 오차
  const accuracy = stats.shootingAccuracy;
  const errorRange = (100 - accuracy) * 0.4;
  const targetX = target.x + (Math.random() - 0.5) * errorRange;
  const targetY = target.y + (Math.random() - 0.5) * errorRange;

  // 공 속도 설정
  const angle = Phaser.Math.Angle.Between(ctx.ball.x, ctx.ball.y, targetX, targetY);
  const power = stats.shootingPower * 2.5 + 100;

  ctx.ball.setVelocity(
    Math.cos(angle) * power,
    Math.sin(angle) * power
  );
}

/**
 * 공중 패스 실행
 */
export function airPass(
  ctx: GameContext,
  player: PlayerSprite,
  target: PlayerSprite
): void {
  if (!ctx.ball) return;

  const stats = player.playerData.stats;

  // 공 소유권 해제
  player.hasBall = false;
  ctx.ball.owner = null;
  ctx.ball.isAirborne = true;
  player.ballAcquireCooldown = 800;

  // 공중 패스는 정확도가 낮음
  const accuracy = stats.shootingAccuracy * 0.7;
  const errorRange = (100 - accuracy) * 1.2;
  const targetX = target.x + (Math.random() - 0.5) * errorRange;
  const targetY = target.y + (Math.random() - 0.5) * errorRange;

  ctx.ball.targetPosition = { x: targetX, y: targetY };

  // 공중 패스 애니메이션
  const duration = Phaser.Math.Distance.Between(ctx.ball.x, ctx.ball.y, targetX, targetY) * 4;

  ctx.scene.tweens.add({
    targets: ctx.ball,
    x: targetX,
    y: targetY,
    duration: duration,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      if (ctx.ball) {
        ctx.ball.isAirborne = false;
        ctx.ball.targetPosition = null;
      }
    }
  });

  ctx.scene.tweens.add({
    targets: ctx.ball,
    scaleX: 1.4,
    scaleY: 1.4,
    duration: duration / 2,
    ease: 'Sine.easeOut',
    yoyo: true,
    onComplete: () => {
      if (ctx.ball) {
        ctx.ball.setScale(1);
      }
    }
  });
}

/**
 * 패스 시도
 */
export function attemptPass(ctx: GameContext, player: PlayerSprite): void {
  const teammates = ctx.players.filter(p =>
    p.team === player.team &&
    p !== player &&
    !p.playerData.isGoalkeeper
  );

  if (teammates.length === 0) return;

  const stats = player.playerData.stats;

  // 가장 좋은 패스 대상 찾기
  const target = findBestPassTarget(ctx, player, teammates);
  if (!target) return;

  // 패스 경로에 상대팀이 있는지 확인
  const opponents = getPlayersInPath(ctx, player, target);

  // 패스 타입 결정
  const passAccuracy = stats.shootingAccuracy;
  const useAirPass = opponents.length > 0 && Math.random() < passAccuracy / 100;

  if (useAirPass) {
    airPass(ctx, player, target);
  } else {
    groundPass(ctx, player, target);
  }
}

/**
 * 킥오프 패스
 */
export function attemptKickoffPass(ctx: GameContext, player: PlayerSprite): void {
  if (!ctx.ball) return;

  // 아군 진영에 있는 팀원 찾기
  const teammates = ctx.players.filter(p =>
    p.team === player.team &&
    p !== player &&
    !p.playerData.isGoalkeeper
  );

  // 아군 진영에 있는 팀원 필터링
  const teammatesInOwnHalf = teammates.filter(p => {
    if (player.team === 'red') {
      return p.y < ctx.fieldHeight / 2;
    } else {
      return p.y > ctx.fieldHeight / 2;
    }
  });

  const passTargets = teammatesInOwnHalf.length > 0 ? teammatesInOwnHalf : teammates;

  if (passTargets.length === 0) {
    ctx.setKickoffState(false, null);
    return;
  }

  // 가장 가까운 팀원 선택
  passTargets.sort((a, b) =>
    Phaser.Math.Distance.Between(player.x, player.y, a.x, a.y) -
    Phaser.Math.Distance.Between(player.x, player.y, b.x, b.y)
  );

  const target = passTargets[0];

  // 공 소유권 해제
  player.hasBall = false;
  ctx.ball.owner = null;
  player.ballAcquireCooldown = 300;

  // 패스 실행
  const angle = Phaser.Math.Angle.Between(ctx.ball.x, ctx.ball.y, target.x, target.y);
  const power = 180;

  ctx.ball.setVelocity(
    Math.cos(angle) * power,
    Math.sin(angle) * power
  );

  // 킥오프 상태 해제
  ctx.setKickoffState(false, null);
}

/**
 * 크로스 또는 컷백 시도
 */
export function attemptCrossOrCutback(ctx: GameContext, player: PlayerSprite): void {
  if (!ctx.ball) return;

  const stats = player.playerData.stats;
  const goalCenterX = ctx.fieldWidth / 2;
  const penaltyAreaY = player.team === 'red'
    ? ctx.fieldHeight - 80
    : 80;

  // 팀원 찾기
  const teammates = ctx.players.filter(p =>
    p.team === player.team &&
    p !== player &&
    !p.playerData.isGoalkeeper
  );

  // 컷백 대상
  const cutbackTargets = teammates.filter(t => {
    const isBehind = player.team === 'red'
      ? t.y < player.y - 30
      : t.y > player.y + 30;
    const isNearCenter = Math.abs(t.x - goalCenterX) < ctx.fieldWidth * 0.35;
    return isBehind && isNearCenter;
  });

  // 크로스 대상
  const crossTargets = teammates.filter(t => {
    const isNearPenaltyArea = player.team === 'red'
      ? t.y > ctx.fieldHeight * 0.7 && t.y < ctx.fieldHeight * 0.95
      : t.y < ctx.fieldHeight * 0.3 && t.y > ctx.fieldHeight * 0.05;
    const isNotOnSameSide = Math.abs(t.x - player.x) > 60;
    return isNearPenaltyArea && isNotOnSameSide;
  });

  const visionFactor = stats.vision / 100;

  let useCross = false;
  let target: PlayerSprite | null = null;

  if (crossTargets.length > 0 && cutbackTargets.length > 0) {
    useCross = Math.random() < (0.4 + visionFactor * 0.2);
    target = useCross
      ? crossTargets[Math.floor(Math.random() * crossTargets.length)]
      : cutbackTargets[Math.floor(Math.random() * cutbackTargets.length)];
  } else if (crossTargets.length > 0) {
    useCross = true;
    target = crossTargets[Math.floor(Math.random() * crossTargets.length)];
  } else if (cutbackTargets.length > 0) {
    useCross = false;
    target = cutbackTargets[Math.floor(Math.random() * cutbackTargets.length)];
  } else {
    useCross = true;
  }

  // 공 소유권 해제
  player.hasBall = false;
  ctx.ball.owner = null;
  player.ballAcquireCooldown = 600;

  if (useCross) {
    // 크로스
    ctx.ball.isAirborne = true;

    let targetX: number;
    let targetY: number;

    if (target) {
      const accuracy = stats.shootingAccuracy * 0.8 + stats.vision * 0.2;
      const errorRange = (100 - accuracy) * 0.8;
      targetX = target.x + (Math.random() - 0.5) * errorRange;
      targetY = target.y + (Math.random() - 0.5) * errorRange * 0.5;
    } else {
      targetX = goalCenterX + (Math.random() - 0.5) * 60;
      targetY = penaltyAreaY + (player.team === 'red' ? 20 : -20);
    }

    ctx.ball.targetPosition = { x: targetX, y: targetY };

    const duration = Phaser.Math.Distance.Between(ctx.ball.x, ctx.ball.y, targetX, targetY) * 3.5;

    ctx.scene.tweens.add({
      targets: ctx.ball,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (ctx.ball) {
          ctx.ball.isAirborne = false;
          ctx.ball.targetPosition = null;
        }
      }
    });

    ctx.scene.tweens.add({
      targets: ctx.ball,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: duration / 2,
      ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: () => {
        if (ctx.ball) {
          ctx.ball.setScale(1);
        }
      }
    });
  } else {
    // 컷백
    if (!target) return;

    const accuracy = stats.shootingAccuracy * 0.6 + stats.vision * 0.4;
    const errorRange = (100 - accuracy) * 0.5;
    const targetX = target.x + (Math.random() - 0.5) * errorRange;
    const targetY = target.y + (Math.random() - 0.5) * errorRange * 0.5;

    const angle = Phaser.Math.Angle.Between(ctx.ball.x, ctx.ball.y, targetX, targetY);
    const power = stats.shootingPower * 2 + 120;

    ctx.ball.setVelocity(
      Math.cos(angle) * power,
      Math.sin(angle) * power
    );
  }
}

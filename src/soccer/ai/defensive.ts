/**
 * 수비 AI 로직
 */

import Phaser from 'phaser';
import type { PlayerSprite, GameContext } from '../types';
import { moveToward, getPositionZone } from './movement';
import { acquireBall } from '../physics/collision';

/**
 * 골키퍼 AI
 */
export function goalkeeperAI(
  ctx: GameContext,
  player: PlayerSprite,
  delta: number
): void {
  if (!ctx.ball) return;

  const stats = player.playerData.stats;
  const isAIGoalkeeper = player.playerData.name === 'AI GK';

  const goalY = player.team === 'red' ? 25 : ctx.fieldHeight - 25;
  const goalCenterX = ctx.fieldWidth / 2;
  const goalLeftX = goalCenterX - ctx.goalWidth / 2 + 10;
  const goalRightX = goalCenterX + ctx.goalWidth / 2 - 10;

  // 공이 골대를 향해 오는지 확인
  const ballVelocity = ctx.ball.body?.velocity as Phaser.Math.Vector2 | undefined;
  const isBallComingToGoal = player.team === 'red'
    ? (ballVelocity && ballVelocity.y < -30)
    : (ballVelocity && ballVelocity.y > 30);

  if (isBallComingToGoal && Math.abs(ctx.ball.y - goalY) < ctx.fieldHeight * 0.35) {
    const targetX = Phaser.Math.Clamp(ctx.ball.x, goalLeftX, goalRightX);
    const speed = isAIGoalkeeper ? stats.speed * 1.8 : stats.speed * 1.2;
    moveToward(player, targetX, goalY, speed);
  } else {
    const targetX = Phaser.Math.Clamp(ctx.ball.x, goalLeftX, goalRightX);
    moveToward(player, targetX, goalY, stats.speed * 0.4);
  }

  // 공 잡기 시도
  if (!ctx.ball.isAirborne && !ctx.ball.owner && player.ballAcquireCooldown <= 0) {
    const distance = Phaser.Math.Distance.Between(player.x, player.y, ctx.ball.x, ctx.ball.y);
    if (distance < 22) {
      acquireBall(ctx, player);
    }
  }
}

/**
 * 수비 AI (상대팀이 공을 가졌을 때)
 */
export function defendingAI(
  ctx: GameContext,
  player: PlayerSprite,
  delta: number
): void {
  if (!ctx.ball || !ctx.ball.owner) return;

  const ballOwner = ctx.ball.owner;
  const stats = player.playerData.stats;
  const zone = getPositionZone(player, ctx.fieldHeight);
  const positioningFactor = stats.positioning / 100;

  const goalY = player.team === 'red' ? 30 : ctx.fieldHeight - 30;
  const goalCenterX = ctx.fieldWidth / 2;

  // 공 소유자와의 거리로 정렬
  const myTeamPlayers = ctx.players.filter(p =>
    p.team === player.team && !p.playerData.isGoalkeeper
  );
  const sortedByDistToOwner = [...myTeamPlayers].sort((a, b) =>
    Phaser.Math.Distance.Between(a.x, a.y, ballOwner.x, ballOwner.y) -
    Phaser.Math.Distance.Between(b.x, b.y, ballOwner.x, ballOwner.y)
  );

  const closestPlayer = sortedByDistToOwner[0];
  const isClosestToBallOwner = closestPlayer === player;

  // 추격 결정
  player.chaseDecisionTime -= delta;

  if (isClosestToBallOwner && player.chaseDecisionTime <= 0) {
    player.chaseDecisionTime = 1000 + Math.random() * 500;
    const chaseChance = 0.2 + (stats.positioning / 100) * 0.7;
    player.isPressing = Math.random() < chaseChance;
  }

  if (!isClosestToBallOwner) {
    player.isPressing = false;
  }

  const secondClosestPlayer = sortedByDistToOwner[1];

  const shouldPress = (isClosestToBallOwner && player.isPressing);
                     

  if (shouldPress) {
    const targetX = ballOwner.x;
    const targetY = ballOwner.y;

    moveToward(player, targetX, targetY, stats.speed * 1);
  } else {
    // 수비 라인 유지
    const centerX = ctx.fieldWidth / 2;
    const homeY = (zone.minY + zone.maxY) / 2;

    const lineDefenders = myTeamPlayers.filter(p => {
      const isPressingPlayer = (p === closestPlayer && closestPlayer.isPressing) ||
                              (p === secondClosestPlayer && closestPlayer?.isPressing);
      return !isPressingPlayer;
    });
    const sortedLineByX = [...lineDefenders].sort((a, b) => a.x - b.x);
    const myLineIndex = sortedLineByX.findIndex(p => p === player);
    const totalLineDefenders = sortedLineByX.length;

    let homeX: number;
    if (totalLineDefenders <= 1) {
      homeX = centerX;
    } else if (myLineIndex === 0) {
      homeX = ctx.fieldWidth * 0.25;
    } else if (myLineIndex === totalLineDefenders - 1) {
      homeX = ctx.fieldWidth * 0.75;
    } else {
      homeX = centerX;
    }

    const slideFactor = 0.3 + positioningFactor * 0.2;
    const slideX = homeX + (ballOwner.x - centerX) * slideFactor;

    const blockRatio = 0.35 + positioningFactor * 0.25;
    const blockY = Phaser.Math.Linear(ballOwner.y, goalY, blockRatio);

    let targetX = Phaser.Math.Linear(homeX, slideX, 0.3 + positioningFactor * 0.4);
    let targetY = Phaser.Math.Linear(homeY, blockY, positioningFactor);

    targetY = Phaser.Math.Clamp(targetY, zone.minY, zone.maxY);
    targetX = Phaser.Math.Clamp(targetX, 30, ctx.fieldWidth - 30);

    // 혼잡 회피
    const nearbyTeammates = ctx.players.filter(p =>
      p.team === player.team &&
      p !== player &&
      Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y) < 60
    );

    if (nearbyTeammates.length > 0) {
      nearbyTeammates.forEach(teammate => {
        const angle = Phaser.Math.Angle.Between(teammate.x, teammate.y, player.x, player.y);
        targetX += Math.cos(angle) * 20;
        targetY += Math.sin(angle) * 20;
      });
      targetY = Phaser.Math.Clamp(targetY, zone.minY, zone.maxY);
      targetX = Phaser.Math.Clamp(targetX, 30, ctx.fieldWidth - 30);
    }

    moveToward(player, targetX, targetY, stats.speed * 1);
  }
}

/**
 * 자유 상태의 공 추격
 */
export function chaseBall(
  ctx: GameContext,
  player: PlayerSprite,
  delta: number
): void {
  if (!ctx.ball) return;

  const stats = player.playerData.stats;
  const positioningFactor = stats.positioning / 100;

  const myTeamPlayers = ctx.players.filter(p =>
    p.team === player.team && !p.playerData.isGoalkeeper
  );
  const sortedByDist = [...myTeamPlayers].sort((a, b) =>
    Phaser.Math.Distance.Between(a.x, a.y, ctx.ball!.x, ctx.ball!.y) -
    Phaser.Math.Distance.Between(b.x, b.y, ctx.ball!.x, ctx.ball!.y)
  );

  const myIndex = sortedByDist.findIndex(p => p === player);
  const maxChasers = Math.round(2 + (1 - positioningFactor) * 2);

  if (myIndex < maxChasers) {
    moveToward(player, ctx.ball.x, ctx.ball.y, stats.speed * 0.9);
  } else {
    const zone = getPositionZone(player, ctx.fieldHeight);
    const homeY = (zone.minY + zone.maxY) / 2;
    const centerX = ctx.fieldWidth / 2;

    const supporters = myTeamPlayers.filter((_, idx) => idx >= maxChasers);
    const sortedByX = [...supporters].sort((a, b) => a.x - b.x);
    const mySupportIndex = sortedByX.findIndex(p => p === player);
    const totalSupporters = sortedByX.length;

    let baseX: number;
    if (totalSupporters <= 1) {
      baseX = centerX;
    } else if (mySupportIndex === 0) {
      baseX = ctx.fieldWidth * 0.2;
    } else if (mySupportIndex === totalSupporters - 1) {
      baseX = ctx.fieldWidth * 0.8;
    } else {
      baseX = centerX;
    }

    const targetX = Phaser.Math.Linear(baseX, ctx.ball.x, 0.25);
    const targetY = Phaser.Math.Clamp(
      Phaser.Math.Linear(homeY, ctx.ball.y, 0.2),
      zone.minY,
      zone.maxY
    );
    moveToward(player, targetX, targetY, stats.speed * 0.5);
  }
}

/**
 * 공이 없는 플레이어의 AI
 */
export function aiWithoutBall(
  ctx: GameContext,
  player: PlayerSprite,
  delta: number
): void {
  if (!ctx.ball) return;

  const ballOwner = ctx.ball.owner;

  // 골키퍼
  if (player.role === 'goalkeeper') {
    goalkeeperAI(ctx, player, delta);
    return;
  }

  // 팀이 공을 가진 경우 - supportingRun은 offensive.ts에 있음
  if (ballOwner && ballOwner.team === player.team) {
    // 이 함수는 offensive.ts의 supportingRun을 호출해야 함
    // 순환 참조를 피하기 위해 여기서는 구현하지 않음
    return;
  } else if (ballOwner && ballOwner.team !== player.team) {
    defendingAI(ctx, player, delta);
  } else {
    chaseBall(ctx, player, delta);
  }
}

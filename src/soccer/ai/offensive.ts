/**
 * 공격 AI 로직
 */

import Phaser from 'phaser';
import type { PlayerSprite, GameContext } from '../types';
import { getNearbyOpponents, getPositionZone, findGapBetweenDefenders, moveToward } from './movement';
import { attemptPass, attemptKickoffPass, attemptCrossOrCutback } from '../actions/passing';
import { attemptShot } from '../actions/shooting';
import { dribble } from '../actions/dribbling';

/**
 * 공을 가진 플레이어의 AI
 */
export function aiWithBall(
  ctx: GameContext,
  player: PlayerSprite,
  delta: number
): void {
  const stats = player.playerData.stats;

  // 킥오프 시 아군 진영으로 패스
  if (ctx.isKickoff && player === ctx.kickoffPlayer) {
    attemptKickoffPass(ctx, player);
    return;
  }

  // 골키퍼는 높은 확률로 패스 선택. vision 능력치의 영향을 받음.
  if (player.role === 'goalkeeper' && Math.random() < 0.001 + (stats.vision / 100) * 0.01) {
    attemptPass(ctx, player);
    return;
  }
 
  // 상대팀 플레이어 리스트
  const opponents = ctx.players.filter(p => p.team !== player.team && !p.playerData.isGoalkeeper);
  // 각도가 골대 범위 내에 있는지 확인 (각도 정규화 필요)
  const normalizeAngle = (angle: number) => {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  };
  // 플레이어에서 골대 양 끝까지의 각도 계산
  const goalY = player.team === 'red' ? ctx.fieldHeight : 0;
  const goalCenterX = ctx.fieldWidth / 2;
  const goalLeftX = goalCenterX - ctx.goalWidth / 2;
  const goalRightX = goalCenterX + ctx.goalWidth / 2;
  const angleToLeftPost = Phaser.Math.Angle.Between(player.x, player.y, goalLeftX, goalY);
  const angleToRightPost = Phaser.Math.Angle.Between(player.x, player.y, goalRightX, goalY);
  const normLeft = normalizeAngle(angleToLeftPost);
  const normRight = normalizeAngle(angleToRightPost);
  
  // 골대를 가로막는 상대팀 플레이어 리스트
  
  const blockingOpponents = opponents.filter(p => {
    // 자신과 상대를 잇는 직선이 상대 골대 범위에 포함되는지 확인
    
    
    
    const angleToOpponent = Phaser.Math.Angle.Between(player.x, player.y, p.x, p.y);
    const normOpponent = normalizeAngle(angleToOpponent);
    
    // 각도 범위 내에 있는지 확인
    let isInAngleRange = false;
    if (normLeft < normRight) {
      isInAngleRange = normOpponent >= normLeft && normOpponent <= normRight;
    } else {
      // 각도 범위가 -PI와 PI를 넘어가는 경우
      isInAngleRange = normOpponent >= normLeft || normOpponent <= normRight;
    }
    
    // 상대 플레이어가 플레이어와 골대 사이에 있는지 확인 (거리 체크)
    const distToGoal = Phaser.Math.Distance.Between(player.x, player.y, goalCenterX, goalY);
    const distToOpponent = Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y);
    const distOpponentToGoal = Phaser.Math.Distance.Between(p.x, p.y, goalCenterX, goalY);
    const isBetweenPlayerAndGoal = distToOpponent < distToGoal && distOpponentToGoal < distToGoal;
    
    // 골대를 가로막는 조건: 각도 범위 내에 있고, 플레이어와 골대 사이에 위치
    const isBlocking = isInAngleRange && isBetweenPlayerAndGoal;

    const isCloseOpponent = distToOpponent < ctx.fieldHeight * 0.3;

    return isBlocking && isCloseOpponent;
  });

  if (player.role !== 'goalkeeper' && Math.random() < 0.001 + (stats.vision / 100) * 0.005 && blockingOpponents.length > 0) {
    attemptPass(ctx, player);
    return;
  }

  // 상대 진영 코너 지역에서 크로스/컷백 시도
  const cornerZoneY = player.team === 'red'
    ? ctx.fieldHeight * 0.85
    : ctx.fieldHeight * 0.15;
  const isInCornerZoneY = player.team === 'red'
    ? player.y > cornerZoneY
    : player.y < cornerZoneY;
  const cornerZoneX = 80;
  const isInCornerZoneX = player.x < cornerZoneX || player.x > ctx.fieldWidth - cornerZoneX;

  if (isInCornerZoneY && isInCornerZoneX) {
    const crossCutbackChance = 0.1 + (stats.vision / 100) * 0.5;
    if (Math.random() < crossCutbackChance * 0.1) {
      attemptCrossOrCutback(ctx, player);
      return;
    }
  }

  // 슈팅 가능한 거리 확인
  const distanceToGoal = Math.abs(player.y - goalY);

  // 중거리슛
  if (distanceToGoal < ctx.fieldHeight * 0.4 && Math.random() < stats.longShotFrequency / 2000) {
    attemptShot(ctx, player);
    return;
  }

  // 근거리 슈팅
  if (distanceToGoal < ctx.fieldHeight * 0.2 && Math.random() < 0.02) {
    attemptShot(ctx, player);
    return;
  }

  // 패스 또는 드리블 결정
  const nearbyOpponents = getNearbyOpponents(ctx, player, 70);

  if (nearbyOpponents.length > 0) {
    const passChance = 0.6 - (stats.dribbleAttempt / 100) * 0.5;
    const opponentMultiplier = 1 + (nearbyOpponents.length - 1) * 0.3;

    if (Math.random() < passChance * opponentMultiplier * 0.05) {
      attemptPass(ctx, player);
      return;
    }
  }

  dribble(ctx, player, delta);
}

/**
 * 공격 지원 움직임 (팀이 공을 가졌을 때)
 */
export function supportingRun(
  ctx: GameContext,
  player: PlayerSprite,
  delta: number
): void {
  if (!ctx.ball || !ctx.ball.owner) return;

  const zone = getPositionZone(player, ctx.fieldHeight);
  const stats = player.playerData.stats;
  const owner = ctx.ball.owner;
  const positioningFactor = stats.positioning / 100;

  const leftWing = 50;
  const rightWing = ctx.fieldWidth - 50;
  const centerX = ctx.fieldWidth / 2;

  // 같은 팀 필드 플레이어들
  const teamFieldPlayers = ctx.players.filter(p =>
    p.team === player.team && p !== owner && !p.playerData.isGoalkeeper
  );

  const myIndex = teamFieldPlayers.findIndex(p => p === player);
  const totalPlayers = teamFieldPlayers.length;

  const goalY = player.team === 'red' ? ctx.fieldHeight : 0;
  const goalDirection = player.team === 'red' ? 1 : -1;

  // 역할 분배
  let isRearSupport = false;
  let isWingRole = false;

  if (myIndex === 0) {
    isWingRole = true;
  } else if (myIndex === totalPlayers - 1) {
    isWingRole = true;
  } else if (myIndex === 1 && totalPlayers > 2) {
    // 중앙 전방 지원
  } else {
    isRearSupport = true;
  }

  // 침투 결정
  player.penetratingDecisionTime -= delta;

  if (player.penetratingDecisionTime <= 0) {
    player.penetratingDecisionTime = 500 + Math.random() * 500;

    if (!isRearSupport) {
      const ownerDistToGoal = Math.abs(owner.y - goalY);
      const myDistToGoal = Math.abs(player.y - goalY);
      const ownerIsCloserToGoal = ownerDistToGoal < myDistToGoal;

      let penetrationChance: number;
      if (ownerIsCloserToGoal) {
        penetrationChance = 0.7 + positioningFactor * 0.25;
      } else {
        penetrationChance = 0.2 + positioningFactor * 0.4;
      }

      if (Math.random() < penetrationChance) {
        const penetrationDepth = 150 + positioningFactor * 100;
        let penetrationY = player.team === 'red'
          ? player.y + penetrationDepth
          : player.y - penetrationDepth;

        const penetrationLimit = player.team === 'red'
          ? ctx.fieldHeight * 0.85
          : ctx.fieldHeight * 0.15;
        if (player.team === 'red') {
          penetrationY = Math.min(penetrationY, penetrationLimit);
        } else {
          penetrationY = Math.max(penetrationY, penetrationLimit);
        }

        const gapX = findGapBetweenDefenders(ctx, player.team, player.x);
        const penetrationX = gapX !== null ? gapX : player.x;

        player.isPenetrating = true;
        player.penetratingTarget = { x: penetrationX, y: penetrationY };
      } else {
        player.isPenetrating = false;
        player.penetratingTarget = null;
      }
    } else {
      player.isPenetrating = false;
      player.penetratingTarget = null;
    }
  }

  let targetX: number;
  let targetY: number;

  if (player.isPenetrating && player.penetratingTarget) {
    targetX = player.penetratingTarget.x;
    targetY = player.penetratingTarget.y;

    const distToTarget = Phaser.Math.Distance.Between(player.x, player.y, targetX, targetY);
    if (distToTarget < 30) {
      player.isPenetrating = false;
      player.penetratingTarget = null;
      player.penetratingDecisionTime = 0;
    }
  } else {
    if (myIndex === 0) {
      targetX = leftWing;
      targetY = owner.y + goalDirection * 80;
    } else if (myIndex === totalPlayers - 1) {
      targetX = rightWing;
      targetY = owner.y + goalDirection * 80;
    } else if (myIndex === 1 && totalPlayers > 2) {
      targetX = owner.x + (owner.x < centerX ? 60 : -60);
      targetY = owner.y + goalDirection * 120;
    } else {
      targetX = centerX + (myIndex % 2 === 0 ? -80 : 80);
      targetY = owner.y - goalDirection * 60;
    }

    if (isWingRole && Math.abs(targetX - owner.x) < 80) {
      targetX = targetX < centerX ? rightWing : leftWing;
    }

    const homeY = (zone.minY + zone.maxY) / 2;
    if (!isWingRole) {
      const homeX = centerX;
      targetX = Phaser.Math.Linear(homeX, targetX, 0.6 + positioningFactor * 0.4);
    }
    targetY = Phaser.Math.Linear(homeY, targetY, 0.5 + positioningFactor * 0.5);

    const frontLineLimit = player.team === 'red'
      ? Math.max(owner.y + 100, zone.minY)
      : Math.min(owner.y - 100, zone.maxY);
    if (player.team === 'red') {
      targetY = Math.min(targetY, frontLineLimit);
    } else {
      targetY = Math.max(targetY, frontLineLimit);
    }
    targetY = Phaser.Math.Clamp(targetY, zone.minY, zone.maxY);
  }

  targetX = Phaser.Math.Clamp(targetX, leftWing, rightWing);

  // 혼잡 회피
  const separationRadius = 80;
  const nearbyTeammates = ctx.players.filter(p =>
    p.team === player.team &&
    p !== player &&
    Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y) < separationRadius
  );

  if (nearbyTeammates.length > 0) {
    nearbyTeammates.forEach(teammate => {
      const dist = Phaser.Math.Distance.Between(player.x, player.y, teammate.x, teammate.y);
      const angle = Phaser.Math.Angle.Between(teammate.x, teammate.y, player.x, player.y);
      const repulsion = (separationRadius - dist) * 0.6;
      targetX += Math.cos(angle) * repulsion;
      targetY += Math.sin(angle) * repulsion;
    });
    if (!player.isPenetrating) {
      targetY = Phaser.Math.Clamp(targetY, zone.minY, zone.maxY);
    }
    targetX = Phaser.Math.Clamp(targetX, leftWing, rightWing);
  }

  const speed = player.isPenetrating ? stats.speed * 1.2 : stats.speed * 0.7;
  moveToward(player, targetX, targetY, speed);
}

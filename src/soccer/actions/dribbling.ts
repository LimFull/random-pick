/**
 * 드리블 관련 액션
 */

import Phaser from 'phaser';
import type { PlayerSprite, GameContext } from '../types';

/**
 * 드리블 실행
 */
export function dribble(
  ctx: GameContext,
  player: PlayerSprite,
  delta: number
): void {
  const stats = player.playerData.stats;
  const goalY = player.team === 'red' ? ctx.fieldHeight : 0;
  const speed = stats.dribbleSpeed * 1.5;

  // 드리블 목표 유지 시간 감소
  player.dribbleTargetTime -= delta;

  // 목표가 없거나 시간이 만료되면 새로운 목표 설정
  if (!player.dribbleTarget || player.dribbleTargetTime <= 0) {
    // 주변 상대 선수 확인
    const nearbyOpponents = ctx.players.filter(p =>
      p.team !== player.team &&
      !p.playerData.isGoalkeeper &&
      Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y) < 100
    );

    let targetX = player.x;
    let targetY = goalY;

    // 상대가 있으면 피할지 돌파할지 결정
    if (nearbyOpponents.length > 0) {
      const goStraightChance = stats.breakthroughAttempt / 100;

      if (Math.random() > goStraightChance) {
        // 상대를 피해서 드리블
        let avoidX = 0;
        let avoidY = 0;

        nearbyOpponents.forEach(opponent => {
          const dx = player.x - opponent.x;
          const dy = player.y - opponent.y;
          const dist = Math.max(Phaser.Math.Distance.Between(player.x, player.y, opponent.x, opponent.y), 1);

          const weight = (100 - dist) / 100;
          avoidX += (dx / dist) * weight * 80;
          avoidY += (dy / dist) * weight * 40;
        });

        targetX = Phaser.Math.Clamp(player.x + avoidX, 50, ctx.fieldWidth - 50);

        const goalDirection = player.team === 'red' ? 1 : -1;
        targetY = player.y + (goalDirection * 60) + avoidY;
      }
    }

    // 새 목표 설정
    player.dribbleTarget = { x: targetX, y: targetY };
    player.dribbleTargetTime = 300 + Math.random() * 200;
  }

  // 캐시된 목표로 드리블
  const targetX = player.dribbleTarget.x;
  const targetY = player.dribbleTarget.y;

  const angle = Phaser.Math.Angle.Between(player.x, player.y, targetX, targetY);

  player.setVelocity(
    Math.cos(angle) * speed,
    Math.sin(angle) * speed
  );
  player.facingAngle = angle;
}

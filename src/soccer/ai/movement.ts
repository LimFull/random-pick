/**
 * 이동 및 위치 관련 유틸리티
 */

import Phaser from 'phaser';
import type { PlayerSprite, GameContext, PositionZone, GapInfo } from '../types';
import type { Team } from '../../types/soccer';

/**
 * 플레이어를 목표 지점으로 이동
 */
export function moveToward(
  player: PlayerSprite,
  targetX: number,
  targetY: number,
  speed: number
): void {
  const angle = Phaser.Math.Angle.Between(player.x, player.y, targetX, targetY);
  const distance = Phaser.Math.Distance.Between(player.x, player.y, targetX, targetY);

  // 목표 지점 근처에서는 멈춤 (떨림 방지)
  if (distance > 15) {
    // 목표에 가까워지면 속도 감소 (부드러운 감속)
    const speedFactor = Math.min(1, distance / 50);
    const finalSpeed = speed * (0.3 + speedFactor * 0.7);

    player.setVelocity(
      Math.cos(angle) * finalSpeed,
      Math.sin(angle) * finalSpeed
    );
    player.facingAngle = angle;
  } else {
    player.setVelocity(0, 0);
  }
}

/**
 * 역할별 위치 영역 정의
 */
export function getPositionZone(
  player: PlayerSprite,
  fieldHeight: number
): PositionZone {
  if (player.role === 'goalkeeper') {
    const y = player.team === 'red' ? 0 : fieldHeight * 0.88;
    return { minY: y, maxY: y + fieldHeight * 0.12 };
  }

  if (player.team === 'red') {
    switch (player.role) {
      case 'defender': return { minY: fieldHeight * 0.08, maxY: fieldHeight * 0.32 };
      case 'midfielder': return { minY: fieldHeight * 0.22, maxY: fieldHeight * 0.52 };
      case 'attacker': return { minY: fieldHeight * 0.38, maxY: fieldHeight * 0.68 };
    }
  } else {
    switch (player.role) {
      case 'defender': return { minY: fieldHeight * 0.68, maxY: fieldHeight * 0.92 };
      case 'midfielder': return { minY: fieldHeight * 0.48, maxY: fieldHeight * 0.78 };
      case 'attacker': return { minY: fieldHeight * 0.32, maxY: fieldHeight * 0.62 };
    }
  }

  return { minY: 0, maxY: fieldHeight };
}

/**
 * 수비수들 사이의 빈 공간 찾기
 */
export function findGapBetweenDefenders(
  ctx: GameContext,
  attackingTeam: Team,
  playerX: number
): number | null {
  const defenders = ctx.players.filter(p =>
    p.team !== attackingTeam &&
    !p.playerData.isGoalkeeper &&
    (p.role === 'defender' || p.role === 'midfielder')
  );

  if (defenders.length < 2) {
    // 수비수가 1명 이하면 중앙으로 침투
    return ctx.fieldWidth / 2;
  }

  // 수비수들을 X 좌표로 정렬
  const sortedDefenders = [...defenders].sort((a, b) => a.x - b.x);

  // 수비수들 사이의 간격 계산
  const gaps: GapInfo[] = [];

  // 왼쪽 경계와 첫 번째 수비수 사이
  gaps.push({
    x: (50 + sortedDefenders[0].x) / 2,
    width: sortedDefenders[0].x - 50
  });

  // 수비수들 사이
  for (let i = 0; i < sortedDefenders.length - 1; i++) {
    const gapWidth = sortedDefenders[i + 1].x - sortedDefenders[i].x;
    gaps.push({
      x: (sortedDefenders[i].x + sortedDefenders[i + 1].x) / 2,
      width: gapWidth
    });
  }

  // 마지막 수비수와 오른쪽 경계 사이
  const lastDefender = sortedDefenders[sortedDefenders.length - 1];
  gaps.push({
    x: (lastDefender.x + ctx.fieldWidth - 50) / 2,
    width: ctx.fieldWidth - 50 - lastDefender.x
  });

  // 최소 간격 이상인 갭만 필터링
  const validGaps = gaps.filter(gap => gap.width > 60);

  if (validGaps.length === 0) return null;

  // 플레이어 위치에서 가장 가까운 유효한 갭 선택
  validGaps.sort((a, b) => Math.abs(a.x - playerX) - Math.abs(b.x - playerX));

  return validGaps[0].x;
}

/**
 * 주변 상대 선수 찾기
 */
export function getNearbyOpponents(
  ctx: GameContext,
  player: PlayerSprite,
  radius: number
): PlayerSprite[] {
  return ctx.players.filter(p =>
    p.team !== player.team &&
    Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y) < radius
  );
}

/**
 * 주변 같은 팀 선수 찾기
 */
export function getNearbyTeammates(
  ctx: GameContext,
  player: PlayerSprite,
  radius: number
): PlayerSprite[] {
  return ctx.players.filter(p =>
    p.team === player.team &&
    p !== player &&
    Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y) < radius
  );
}

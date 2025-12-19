/**
 * 참가자 색상 할당 유틸리티
 * 각 참가자에게 고유한 색상을 자동으로 할당합니다.
 */

import type { Participant, ParticipantInput } from '../types/participant';

// 구분 가능한 색상 팔레트 (최소 20개 이상)
const COLOR_PALETTE: readonly string[] = [
  '#FF6B6B', // 빨강
  '#4ECDC4', // 청록
  '#45B7D1', // 파랑
  '#FFA07A', // 연어색
  '#98D8C8', // 민트
  '#F7DC6F', // 노랑
  '#BB8FCE', // 보라
  '#85C1E2', // 하늘색
  '#F8B739', // 주황
  '#52BE80', // 초록
  '#E74C3C', // 진한 빨강
  '#3498DB', // 밝은 파랑
  '#9B59B6', // 진한 보라
  '#1ABC9C', // 청록
  '#F39C12', // 주황
  '#E67E22', // 갈색
  '#D35400', // 진한 주황
  '#C0392B', // 와인색
  '#16A085', // 진한 청록
  '#27AE60', // 진한 초록
  '#2980B9', // 진한 파랑
  '#8E44AD', // 진한 보라
  '#D63031', // 빨강
  '#00B894', // 청록
  '#0984E3', // 파랑
  '#6C5CE7', // 보라
  '#A29BFE', // 연한 보라
  '#FD79A8', // 핑크
  '#FDCB6E', // 노랑
  '#E17055', // 코랄
] as const;

/**
 * 참가자 데이터를 정규화합니다.
 * 문자열 배열인 경우 객체 배열로 변환하고 색상을 할당합니다.
 * 
 * @param participants - 참가자 배열
 * @returns 정규화된 참가자 배열
 */
export function normalizeParticipants(participants: ParticipantInput[]): Participant[] {
  if (!Array.isArray(participants)) {
    return [];
  }

  // 이미 객체 배열인 경우 색상이 있으면 그대로 반환, 없으면 색상 할당
  if (participants.length > 0 && typeof participants[0] === 'object' && participants[0] !== null && 'name' in participants[0]) {
    // 색상이 없는 참가자에게 색상 할당
    return participants.map((p, index) => {
      const participant = p as Participant;
      if (participant.color) {
        return participant;
      }
      // 색상이 없는 경우 할당
      const usedColors = participants
        .filter((prev, i) => i < index && typeof prev === 'object' && prev !== null && 'color' in prev)
        .map(prev => (prev as Participant).color);
      const availableColors = COLOR_PALETTE.filter(color => !usedColors.includes(color));
      return {
        ...participant,
        color: availableColors.length > 0 ? availableColors[0] : COLOR_PALETTE[index % COLOR_PALETTE.length],
      };
    });
  }

  // 문자열 배열인 경우 객체 배열로 변환
  return participants.map((name, index) => {
    if (typeof name === 'string') {
      return {
        name,
        color: assignColor(participants, index),
      };
    }
    return name as Participant;
  });
}

/**
 * 참가자에게 색상을 할당합니다.
 * 기존 참가자의 색상은 유지하고, 새로운 참가자에게는 사용되지 않은 색상을 할당합니다.
 * 
 * @param participants - 참가자 배열
 * @param index - 현재 참가자의 인덱스
 * @returns 할당된 색상 (HEX 코드)
 */
export function assignColor(participants: ParticipantInput[], index: number): string {
  // 기존 참가자들의 색상 추출
  const usedColors = participants
    .filter((p, i) => i < index && typeof p === 'object' && p !== null && 'color' in p)
    .map((p) => (p as Participant).color);

  // 사용 가능한 색상 찾기
  const availableColors = COLOR_PALETTE.filter((color) => !usedColors.includes(color));

  // 사용 가능한 색상이 있으면 할당, 없으면 팔레트에서 순환
  if (availableColors.length > 0) {
    return availableColors[0];
  }

  // 모든 색상이 사용된 경우 팔레트에서 순환
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

/**
 * 새로운 참가자를 추가할 때 색상을 할당합니다.
 * 
 * @param existingParticipants - 기존 참가자 배열
 * @returns 할당된 색상 (HEX 코드)
 */
export function assignColorToNewParticipant(existingParticipants: Participant[]): string {
  const usedColors = existingParticipants.map((p) => p.color);
  const availableColors = COLOR_PALETTE.filter((color) => !usedColors.includes(color));

  if (availableColors.length > 0) {
    return availableColors[0];
  }

  // 모든 색상이 사용된 경우 순환
  return COLOR_PALETTE[existingParticipants.length % COLOR_PALETTE.length];
}

/**
 * 색상 팔레트를 반환합니다.
 * 
 * @returns 색상 팔레트 배열
 */
export function getColorPalette(): readonly string[] {
  return [...COLOR_PALETTE];
}

/**
 * 당첨자 선정 로직
 * 
 * 이 파일은 돌림판에서 당첨자를 선정하는 핵심 로직을 담고 있습니다.
 * 공정하고 투명한 랜덤 선택 알고리즘을 구현합니다.
 */

import type { ParticipantInput } from '../types/participant';

/**
 * 돌림판의 회전 각도를 기반으로 당첨자를 선정합니다.
 * 
 * 알고리즘 설명:
 * 1. 돌림판이 멈춘 회전 각도(rotationAngle)를 받습니다.
 * 2. 참가자 수에 따라 각 섹션의 각도를 계산합니다 (2π / 섹션 수).
 * 3. 회전 각도를 정규화하여 0 이상 2π 미만의 값으로 변환합니다.
 * 4. 포인터가 위쪽(0도)을 가리키므로, 각도를 조정하여 올바른 섹션을 찾습니다.
 * 5. 포인터 각도를 섹션 각도로 나누어 섹션 인덱스를 계산합니다.
 * 6. 해당 인덱스의 참가자를 당첨자로 선택합니다.
 * 
 * 이 방법은 돌림판의 물리 시뮬레이션 결과를 기반으로 하며,
 * 각 참가자가 동일한 크기의 섹션을 가지므로 공정한 선택을 보장합니다.
 * 
 * @param participants - 참가자 배열 (랜덤 배치된 순서)
 * @param rotationAngle - 돌림판의 회전 각도 (라디안)
 * @returns 선택된 당첨자 이름
 * @throws {Error} 참가자가 없거나 빈 배열인 경우 에러 발생
 */
export function selectWinner(participants: ParticipantInput[], rotationAngle: number): string {
  // 입력 검증
  if (!participants || participants.length === 0) {
    throw new Error('참가자가 없습니다. 최소 1명 이상의 참가자가 필요합니다.');
  }

  // 참가자 이름 추출 (객체 배열인 경우)
  const participantNames = participants.map(p => 
    typeof p === 'string' ? p : p.name
  );

  // 중복 제거 (같은 이름이 여러 번 입력된 경우)
  const uniqueParticipants = [...new Set(participantNames)];
  
  if (uniqueParticipants.length === 0) {
    throw new Error('유효한 참가자가 없습니다.');
  }

  // 각도 검증
  if (typeof rotationAngle !== 'number' || isNaN(rotationAngle)) {
    throw new Error('유효한 회전 각도가 필요합니다.');
  }

  // 섹션 수와 각 섹션의 각도 계산
  const sections = uniqueParticipants.length;
  const anglePerSection = (Math.PI * 2) / sections;
  
  // 회전 각도를 정규화 (0 이상 2π 미만)
  const normalizedAngle = ((rotationAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  
  // 포인터가 위쪽(0도)을 가리키므로, 각도를 조정하여 올바른 섹션 찾기
  const pointerAngle = (Math.PI * 2 - normalizedAngle) % (Math.PI * 2);
  
  // 섹션 인덱스 계산
  const sectionIndex = Math.floor(pointerAngle / anglePerSection);
  const winnerIndex = sectionIndex % sections;
  
  // 선택된 당첨자 반환
  return uniqueParticipants[winnerIndex];
}

/**
 * 참가자 배열의 각 인원에 대한 선택 확률을 계산합니다.
 * (디버깅 및 투명성 확인용)
 * 
 * @param participants - 참가자 이름 배열
 * @returns 각 참가자의 선택 확률 (퍼센트)
 */
export function calculateProbabilities(participants: string[]): Record<string, string> {
  if (!participants || participants.length === 0) {
    return {};
  }

  const uniqueParticipants = [...new Set(participants)];
  const probability = (1 / uniqueParticipants.length) * 100;
  
  const result: Record<string, string> = {};
  uniqueParticipants.forEach(name => {
    result[name] = probability.toFixed(2) + '%';
  });
  
  return result;
}


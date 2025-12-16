/**
 * 당첨자 선정 로직
 * 
 * 이 파일은 돌림판에서 당첨자를 선정하는 핵심 로직을 담고 있습니다.
 * 공정하고 투명한 랜덤 선택 알고리즘을 구현합니다.
 * 
 * @param {string[]} participants - 참가자 이름 배열
 * @returns {string} 선택된 당첨자 이름
 */

/**
 * 참가자 배열에서 랜덤으로 한 명을 선택합니다.
 * 
 * 알고리즘 설명:
 * 1. Math.random()을 사용하여 0 이상 1 미만의 랜덤 실수를 생성합니다.
 * 2. 참가자 배열의 길이를 곱하여 0 이상 배열 길이 미만의 실수를 만듭니다.
 * 3. Math.floor()를 사용하여 정수 인덱스로 변환합니다.
 * 4. 해당 인덱스의 참가자를 당첨자로 선택합니다.
 * 
 * 이 방법은 각 참가자가 동일한 확률로 선택되도록 보장합니다.
 * 시드값이나 예측 가능한 요소가 없으며, 브라우저의 암호학적으로 안전한
 * 랜덤 생성기를 사용합니다.
 * 
 * @param {string[]} participants - 참가자 이름 배열
 * @returns {string} 선택된 당첨자 이름
 * @throws {Error} 참가자가 없거나 빈 배열인 경우 에러 발생
 */
export function selectWinner(participants) {
  // 입력 검증
  if (!participants || participants.length === 0) {
    throw new Error('참가자가 없습니다. 최소 1명 이상의 참가자가 필요합니다.');
  }

  // 중복 제거 (같은 이름이 여러 번 입력된 경우)
  const uniqueParticipants = [...new Set(participants)];
  
  if (uniqueParticipants.length === 0) {
    throw new Error('유효한 참가자가 없습니다.');
  }

  // 랜덤 인덱스 생성
  // Math.random()은 0 이상 1 미만의 값을 반환하므로,
  // 배열 길이를 곱하고 floor를 취하면 0부터 (length-1)까지의 정수를 얻을 수 있습니다.
  const randomIndex = Math.floor(Math.random() * uniqueParticipants.length);
  
  // 선택된 당첨자 반환
  return uniqueParticipants[randomIndex];
}

/**
 * 참가자 배열의 각 인원에 대한 선택 확률을 계산합니다.
 * (디버깅 및 투명성 확인용)
 * 
 * @param {string[]} participants - 참가자 이름 배열
 * @returns {Object} 각 참가자의 선택 확률 (퍼센트)
 */
export function calculateProbabilities(participants) {
  if (!participants || participants.length === 0) {
    return {};
  }

  const uniqueParticipants = [...new Set(participants)];
  const probability = (1 / uniqueParticipants.length) * 100;
  
  const result = {};
  uniqueParticipants.forEach(name => {
    result[name] = probability.toFixed(2) + '%';
  });
  
  return result;
}


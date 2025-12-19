/**
 * 참가자 관련 타입 정의
 */

/**
 * 참가자 객체 타입
 */
export interface Participant {
  name: string;
  color: string;
}

/**
 * 참가자 배열 타입 (문자열 또는 객체)
 */
export type ParticipantInput = string | Participant;

/**
 * 참가자 배열 타입
 */
export type ParticipantArray = Participant[];

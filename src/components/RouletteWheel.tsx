import { useEffect, useRef, useState } from 'react';
import { selectWinner } from '../utils/winnerSelection';
import './RouletteWheel.css';
import type { Participant } from '../types/participant';
import type { SpinCompleteResult } from '../types/game';

/**
 * 참가자 배열을 랜덤하게 섞는 함수 (Fisher-Yates 알고리즘)
 */
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * 돌림판 컴포넌트 Props
 */
interface RouletteWheelProps {
  participants: Participant[];
  onSpinComplete: (result: SpinCompleteResult) => void;
  isSpinning: boolean;
  setIsSpinning: (spinning: boolean) => void;
}

/**
 * 물리엔진을 활용한 돌림판 컴포넌트
 * Canvas 2D와 물리 시뮬레이션을 사용하여 리얼한 물리 효과를 구현합니다.
 */
export function RouletteWheel({ participants, onSpinComplete, isSpinning, setIsSpinning }: RouletteWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const rotationRef = useRef(0);
  const angularVelocityRef = useRef(0);
  const frictionRef = useRef(0.99); // 마찰 계수
  const participantsRef = useRef(participants);
  const onSpinCompleteRef = useRef(onSpinComplete);
  const isSpinningRef = useRef(isSpinning);
  const [canvasSize, setCanvasSize] = useState(400);
  
  // 랜덤 배치된 참가자 배열 (state로 관리하여 participants 변경 시 자동 재배치)
  const [shuffledParticipants, setShuffledParticipants] = useState<Participant[]>(() => 
    participants.length > 0 ? shuffleArray(participants) : []
  );

  // ref 업데이트 및 참가자 랜덤 배치
  useEffect(() => {
    participantsRef.current = participants;
    // 참가자가 변경되면 랜덤하게 섞기
    if (participants.length > 0) {
      setShuffledParticipants(shuffleArray(participants));
    } else {
      setShuffledParticipants([]);
    }
  }, [participants]);

  useEffect(() => {
    onSpinCompleteRef.current = onSpinComplete;
  }, [onSpinComplete]);

  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);

  // 돌림판 그리기 함수
  const drawWheel = (ctx: CanvasRenderingContext2D, rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.4;
    const sections = shuffledParticipants.length;
    const anglePerSection = (Math.PI * 2) / sections;

    // 캔버스 클리어
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 현재 회전 각도 적용
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    // 각 섹션 그리기
    for (let i = 0; i < sections; i++) {
      const angle = i * anglePerSection - Math.PI / 2;
      const nextAngle = (i + 1) * anglePerSection - Math.PI / 2;
      const middleAngle = (angle + nextAngle) / 2;

      // 섹션 색상 (참가자의 색상 사용)
      const participant = shuffledParticipants[i];
      const participantColor = participant?.color || (i % 2 === 0 ? '#4a90e2' : '#6bb6ff'); // 폴백 색상
      ctx.fillStyle = participantColor;
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;

      // 섹션 그리기
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angle, nextAngle);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 섹션 구분선
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.stroke();

      // 참가자 이름 그리기
      const labelRadius = radius * 0.65; // 돌림판 안쪽에 이름 배치
      const labelX = Math.cos(middleAngle) * labelRadius;
      const labelY = Math.sin(middleAngle) * labelRadius;

      ctx.save();
      ctx.translate(labelX, labelY);
      ctx.rotate(middleAngle + Math.PI / 2); // 텍스트를 섹션 방향으로 회전
      
      // 폰트 크기는 섹션 수에 따라 조정
      const fontSize = Math.max(12, Math.min(18, 400 / sections));
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const name = participant?.name || '';
      // 긴 이름은 자르기 (최대 10자)
      const displayName = name.length > 10 ? name.substring(0, 8) + '...' : name;
      
      // 텍스트 외곽선 (가독성 향상)
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(displayName, 0, 0);
      
      // 텍스트 채우기
      ctx.fillStyle = '#ffffff';
      ctx.fillText(displayName, 0, 0);
      
      ctx.restore();
    }

    // 중앙 원 그리기
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // 애니메이션 루프
  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 각속도 적용
    rotationRef.current += angularVelocityRef.current;
    
    // 마찰 적용
    angularVelocityRef.current *= frictionRef.current;

    // 돌림판 그리기
    drawWheel(ctx, rotationRef.current);

    // 거의 멈췄을 때 감지
    if (Math.abs(angularVelocityRef.current) < 0.001 && isSpinningRef.current) {
      angularVelocityRef.current = 0;
      setIsSpinning(false);
      
      // 당첨자 계산 (투명하게 공개된 selectWinner 함수 사용)
      const winner = selectWinner(shuffledParticipants, rotationRef.current);
      
      setTimeout(() => {
        onSpinCompleteRef.current(winner);
      }, 500);
    } else if (isSpinningRef.current) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  };

  // Canvas 크기 조정
  useEffect(() => {
    const updateCanvasSize = () => {
      if (wrapperRef.current && canvasRef.current) {
        const wrapperWidth = wrapperRef.current.offsetWidth;
        const wrapperHeight = wrapperRef.current.offsetHeight;
        const size = Math.min(wrapperWidth, wrapperHeight, 400);
        setCanvasSize(size);
        canvasRef.current.width = size;
        canvasRef.current.height = size;
      }
    };

    // 초기 크기 설정을 위해 약간의 지연
    const timer = setTimeout(updateCanvasSize, 100);
    window.addEventListener('resize', updateCanvasSize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || participants.length === 0) {
      // 참가자가 없으면 초기화
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas 크기 설정
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // 초기 그리기
    drawWheel(ctx, rotationRef.current);

    // 애니메이션 시작
    if (isSpinning) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [participants.length, shuffledParticipants, isSpinning, setIsSpinning, canvasSize]);

  const handleSpin = () => {
    if (isSpinning || participants.length === 0) return;
    
    setIsSpinning(true);
    // 랜덤한 각속도와 방향으로 회전
    const spinPower = 0.25 + Math.random() * 0.2; // 0.25 ~ 0.45
    const direction = Math.random() > 0.5 ? 1 : -1;
    angularVelocityRef.current = spinPower * direction;
    
    // 애니메이션 시작
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  return (
    <div className="roulette-container">
      <div className="roulette-wrapper" ref={wrapperRef}>
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          className="roulette-canvas"
        />
        <div className="roulette-pointer" />
      </div>
      <button
        onClick={handleSpin}
        disabled={isSpinning || participants.length === 0}
        className="btn-spin"
      >
        {isSpinning ? '돌리는 중...' : '돌림판 돌리기'}
      </button>
    </div>
  );
}

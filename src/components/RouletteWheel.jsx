import { useEffect, useRef, useState } from 'react';
import './RouletteWheel.css';

/**
 * 물리엔진을 활용한 돌림판 컴포넌트
 * Canvas 2D와 물리 시뮬레이션을 사용하여 리얼한 물리 효과를 구현합니다.
 */
export function RouletteWheel({ participants, onSpinComplete, isSpinning, setIsSpinning }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const animationFrameRef = useRef(null);
  const rotationRef = useRef(0);
  const angularVelocityRef = useRef(0);
  const frictionRef = useRef(0.98); // 마찰 계수
  const participantsRef = useRef(participants);
  const onSpinCompleteRef = useRef(onSpinComplete);
  const isSpinningRef = useRef(isSpinning);
  const [canvasSize, setCanvasSize] = useState(400);

  // ref 업데이트
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    onSpinCompleteRef.current = onSpinComplete;
  }, [onSpinComplete]);

  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);

  // 돌림판 그리기 함수
  const drawWheel = (ctx, rotation) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.4;
    const sections = participantsRef.current.length;
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

      // 섹션 색상 (교대로 변경)
      ctx.fillStyle = i % 2 === 0 ? '#4a90e2' : '#6bb6ff';
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
      
      const name = participantsRef.current[i];
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
      
      // 당첨자 계산
      const sections = participantsRef.current.length;
      const anglePerSection = (Math.PI * 2) / sections;
      const normalizedAngle = ((rotationRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      // 포인터가 위쪽(0도)을 가리키므로, 각도를 조정하여 올바른 섹션 찾기
      const pointerAngle = (Math.PI * 2 - normalizedAngle) % (Math.PI * 2);
      const sectionIndex = Math.floor(pointerAngle / anglePerSection);
      const winnerIndex = sectionIndex % sections;
      
      setTimeout(() => {
        onSpinCompleteRef.current(participantsRef.current[winnerIndex]);
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [participants.length, isSpinning, setIsSpinning, canvasSize]);

  const handleSpin = () => {
    if (isSpinning || participants.length === 0) return;
    
    setIsSpinning(true);
    // 랜덤한 각속도와 방향으로 회전
    const spinPower = 0.15 + Math.random() * 0.1; // 0.15 ~ 0.25
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

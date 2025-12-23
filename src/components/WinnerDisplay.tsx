import { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import './WinnerDisplay.css';
import type { Ranking } from '../types/game';

/**
 * 당첨자 표시 컴포넌트 Props
 */
interface WinnerDisplayProps {
  winner: string;
  rankings?: Ranking[];
  onClose: () => void;
}

/**
 * 당첨자 표시 컴포넌트
 * 폭죽 이펙트와 함께 당첨자를 화면에 표시합니다.
 */
export function WinnerDisplay({ winner, rankings = [], onClose }: WinnerDisplayProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    if (winner) {
      setShowConfetti(true);
      // 5초 후 폭죽 중지
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);

      const handleResize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      };

      window.addEventListener('resize', handleResize);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [winner]);

  if (!winner) return null;

  return (
    <>
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}
      <div className="winner-overlay" onClick={onClose}>
        <div className="winner-modal" onClick={(e) => e.stopPropagation()}>
          <div className="winner-content">
            <div className="winner-celebration">🎉</div>
            <h1 className="winner-title">축하합니다!</h1>
            <div className="winner-name">{winner}</div>
            <p className="winner-message">당첨을 축하드립니다!</p>
            {rankings.length > 0 && (
              <div className="rankings-list">
                {rankings.map((item, index) => (
                  <div key={index} className="ranking-item">
                    <span className="ranking-number">{item.rank}등</span>
                    <span className="ranking-name">{item.name}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={onClose} className="btn-close">
              닫기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}


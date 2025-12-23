import { useState } from 'react';
import './ParticipantList.css';
import type { Participant } from '../types/participant';

/**
 * 참가 인원 관리 컴포넌트 Props
 */
interface ParticipantListProps {
  participants: Participant[];
  onAdd: (name: string) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onShuffle: () => void;
}

/**
 * 참가 인원 관리 컴포넌트
 * 참가자를 추가하고 제거할 수 있는 기능을 제공합니다.
 */
export function ParticipantList({ participants, onAdd, onRemove, onClear, onShuffle }: ParticipantListProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      onAdd(trimmedValue);
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  return (
    <div className="participant-list">
      <h2>참가 인원 관리</h2>
      
      <form onSubmit={handleSubmit} className="participant-form">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="참가자 이름을 입력하세요"
          className="participant-input"
          aria-label="참가자 이름 입력"
        />
        <button type="submit" className="btn btn-add">
          추가
        </button>
      </form>

      {participants.length > 0 && (
        <div className="participant-actions">
          <button onClick={onShuffle} className="btn btn-shuffle">
            색깔 섞기
          </button>
          <button onClick={onClear} className="btn btn-clear">
            전체 삭제
          </button>
        </div>
      )}

      <div className="participant-items">
        {participants.length === 0 ? (
          <p className="empty-message">참가자가 없습니다. 위에서 추가해주세요.</p>
        ) : (
          <ul className="participant-ul">
            {participants.map((participant, index) => {
              const name = participant.name;
              const color = participant.color || '#4a90e2';
              return (
                <li key={index} className="participant-item">
                  <div className="participant-info">
                    <span 
                      className="participant-color-indicator" 
                      style={{ backgroundColor: color }}
                      aria-label={`${name}의 색상`}
                    />
                    <span className="participant-name">{name}</span>
                  </div>
                  <button
                    onClick={() => onRemove(index)}
                    className="btn btn-remove"
                    aria-label={`${name} 삭제`}
                  >
                    삭제
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {participants.length > 0 && (
        <div className="participant-count">
          총 {participants.length}명의 참가자
        </div>
      )}
    </div>
  );
}


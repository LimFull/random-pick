import { useState } from 'react';
import './ParticipantList.css';

/**
 * 참가 인원 관리 컴포넌트
 * 참가자를 추가하고 제거할 수 있는 기능을 제공합니다.
 */
export function ParticipantList({ participants, onAdd, onRemove, onClear }) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      onAdd(trimmedValue);
      setInputValue('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
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
            {participants.map((name, index) => (
              <li key={index} className="participant-item">
                <span className="participant-name">{name}</span>
                <button
                  onClick={() => onRemove(index)}
                  className="btn btn-remove"
                  aria-label={`${name} 삭제`}
                >
                  삭제
                </button>
              </li>
            ))}
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


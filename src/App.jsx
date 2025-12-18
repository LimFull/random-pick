import { useState, useEffect } from 'react';
import { ParticipantList } from './components/ParticipantList';
import { RouletteWheel } from './components/RouletteWheel';
import { HorseRace } from './components/HorseRace';
import { WinnerDisplay } from './components/WinnerDisplay';
import { useLocalStorage } from './hooks/useLocalStorage';
import { normalizeParticipants, assignColorToNewParticipant } from './utils/colorAssignment';
import './App.css';

function App() {
  const [participantsRaw, setParticipantsRaw] = useLocalStorage('participants', []);
  const [participants, setParticipants] = useState([]);
  const [winner, setWinner] = useState(null);
  const [rankings, setRankings] = useState([]); // 경마 순위 정보
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentView, setCurrentView] = useState('participants'); // 'participants', 'roulette', or 'horseRace'

  // 참가자 데이터 정규화 (문자열 배열 → 객체 배열)
  useEffect(() => {
    // participantsRaw 유효성 검사
    const isValidParticipantsRaw = Array.isArray(participantsRaw) && 
      participantsRaw.every(p => 
        typeof p === 'object' && 
        p !== null && 
        typeof p.name === 'string' && 
        typeof p.color === 'string'
      );
    
    // 유효하지 않으면 빈 배열로 초기화
    if (!isValidParticipantsRaw) {
      setParticipantsRaw([]);
      setParticipants([]);
      return;
    }
    
    const normalized = normalizeParticipants(participantsRaw);
    setParticipants(normalized);
  }, [participantsRaw, setParticipantsRaw]);

  const handleAddParticipant = (name) => {
    // 현재 정규화된 participants를 기준으로 색상 할당
    const newColor = assignColorToNewParticipant(participants);
    const newParticipant = { name, color: newColor };
    
    // 로컬 스토리지에 객체 형태로 저장
    const updated = [...participants, newParticipant];
    setParticipantsRaw(updated.map(p => ({ name: p.name, color: p.color })));
  };

  const handleRemoveParticipant = (index) => {
    const updated = participants.filter((_, i) => i !== index);
    // 색상 정보를 유지하면서 저장
    setParticipantsRaw(updated.map((p) => ({ name: p.name, color: p.color })));
  };

  const handleClearParticipants = () => {
    if (window.confirm('모든 참가자를 삭제하시겠습니까?')) {
      setParticipantsRaw([]);
    }
  };

  const handleSpinComplete = (selectedParticipant) => {
    // 경마에서 온 경우: { winner, rankings } 객체
    // 돌림판에서 온 경우: 이름 문자열 또는 객체
    if (typeof selectedParticipant === 'object' && selectedParticipant.winner) {
      // 경마 결과
      setWinner(selectedParticipant.winner);
      setRankings(selectedParticipant.rankings || []);
    } else {
      // 돌림판 결과
      const winnerName = typeof selectedParticipant === 'string' 
        ? selectedParticipant 
        : selectedParticipant.name || selectedParticipant;
      setWinner(winnerName);
      setRankings([]);
    }
  };

  const handleCloseWinner = () => {
    setWinner(null);
    setRankings([]);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎯 돌림판 당첨자 선정</h1>
        <p>참가자를 추가하고 돌림판을 돌려 당첨자를 선정하세요!</p>
      </header>

      {/* 탭 네비게이션 */}
      <nav className="app-nav">
        <button
          className={`nav-button ${currentView === 'participants' ? 'active' : ''}`}
          onClick={() => setCurrentView('participants')}
        >
          👥 참가 인원 관리
        </button>
        <button
          className={`nav-button ${currentView === 'roulette' ? 'active' : ''}`}
          onClick={() => setCurrentView('roulette')}
          disabled={participants.length === 0}
        >
          🎰 돌림판
        </button>
        <button
          className={`nav-button ${currentView === 'horseRace' ? 'active' : ''}`}
          onClick={() => setCurrentView('horseRace')}
          disabled={participants.length === 0}
        >
          🐎 경마
        </button>
      </nav>

      <main className={`app-main ${currentView === 'roulette' ? 'roulette-view' : ''} ${currentView === 'horseRace' ? 'horse-race-view' : ''}`}>
        {currentView === 'participants' && (
          <div className="participants-view">
            <ParticipantList
              participants={participants}
              onAdd={handleAddParticipant}
              onRemove={handleRemoveParticipant}
              onClear={handleClearParticipants}
            />
            {participants.length > 0 && (
              <div className="view-hint">
                <p>✅ 참가자가 추가되었습니다!</p>
                <p>위의 "돌림판" 또는 "경마" 탭을 클릭하여 게임을 시작해보세요.</p>
              </div>
            )}
          </div>
        )}

        {currentView === 'roulette' && (
          <div className="roulette-view-content">
            {participants.length > 0 ? (
              <RouletteWheel
                participants={participants}
                onSpinComplete={handleSpinComplete}
                isSpinning={isSpinning}
                setIsSpinning={setIsSpinning}
              />
            ) : (
              <div className="empty-state">
                <p>⚠️ 참가자가 없습니다.</p>
                <p>먼저 "참가 인원 관리" 탭에서 참가자를 추가해주세요.</p>
                <button
                  className="btn-go-to-participants"
                  onClick={() => setCurrentView('participants')}
                >
                  참가 인원 관리로 이동
                </button>
              </div>
            )}
          </div>
        )}

        {currentView === 'horseRace' && (
          <div className="horse-race-view-content">
            {participants.length > 0 ? (
              <HorseRace
                participants={participants}
                onRaceComplete={handleSpinComplete}
              />
            ) : (
              <div className="empty-state">
                <p>⚠️ 참가자가 없습니다.</p>
                <p>먼저 "참가 인원 관리" 탭에서 참가자를 추가해주세요.</p>
                <button
                  className="btn-go-to-participants"
                  onClick={() => setCurrentView('participants')}
                >
                  참가 인원 관리로 이동
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {winner && (
        <WinnerDisplay winner={winner} rankings={rankings} onClose={handleCloseWinner} />
      )}

    </div>
  );
}

export default App;

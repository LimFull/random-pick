import { useState } from 'react';
import { ParticipantList } from './components/ParticipantList';
import { RouletteWheel } from './components/RouletteWheel';
import { WinnerDisplay } from './components/WinnerDisplay';
import { useLocalStorage } from './hooks/useLocalStorage';
import './App.css';

function App() {
  const [participants, setParticipants] = useLocalStorage('participants', []);
  const [winner, setWinner] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentView, setCurrentView] = useState('participants'); // 'participants' or 'roulette'

  const handleAddParticipant = (name) => {
    setParticipants([...participants, name]);
  };

  const handleRemoveParticipant = (index) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const handleClearParticipants = () => {
    if (window.confirm('모든 참가자를 삭제하시겠습니까?')) {
      setParticipants([]);
    }
  };

  const handleSpinComplete = (selectedParticipant) => {
    setWinner(selectedParticipant);
  };

  const handleCloseWinner = () => {
    setWinner(null);
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
      </nav>

      <main className={`app-main ${currentView === 'roulette' ? 'roulette-view' : ''}`}>
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
                <p>위의 "돌림판" 탭을 클릭하여 돌림판을 돌려보세요.</p>
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
      </main>

      {winner && (
        <WinnerDisplay winner={winner} onClose={handleCloseWinner} />
      )}

      <footer className="app-footer">
        <p>
          당첨자 선정 로직은{' '}
          <code>src/utils/winnerSelection.js</code>에 구현되어 있습니다.
        </p>
      </footer>
    </div>
  );
}

export default App;

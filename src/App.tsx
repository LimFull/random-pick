import { useState, useEffect, useMemo } from 'react';
import { ParticipantList } from './components/ParticipantList';
import { RouletteWheel } from './components/RouletteWheel';
import { HorseRace } from './components/HorseRace';
import { SoccerTeamSetup } from './components/SoccerTeamSetup';
import { WinnerDisplay } from './components/WinnerDisplay';
import { useLocalStorage } from './hooks/useLocalStorage';
import { normalizeParticipants, assignColorToNewParticipant } from './utils/colorAssignment';
import './App.css';
import type { Participant } from './types/participant';
import type { ViewType } from './types/common';
import type { SpinCompleteResult, RaceResult, Ranking } from './types/game';
import type { SoccerResult } from './types/soccer';

function App() {
  const [participantsRaw, setParticipantsRaw] = useLocalStorage<Array<{ name: string; color: string }>>('participants', []);
  const [winner, setWinner] = useState<string | null>(null);
  const [rankings, setRankings] = useState<Ranking[]>([]); // 경마 순위 정보
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('participants'); // 'participants', 'roulette', or 'horseRace'

  // participantsRaw 유효성 검사
  const isValidParticipantsRaw = useMemo(() => {
    return Array.isArray(participantsRaw) && 
      participantsRaw.every(p => 
        typeof p === 'object' && 
        p !== null && 
        typeof p.name === 'string' && 
        typeof p.color === 'string'
      );
  }, [participantsRaw]);

  // 유효하지 않은 데이터 초기화 (한 번만 실행)
  useEffect(() => {
    if (!isValidParticipantsRaw && participantsRaw.length > 0) {
      setParticipantsRaw([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValidParticipantsRaw, participantsRaw.length]);

  // 참가자 데이터 정규화 (문자열 배열 → 객체 배열)
  const participants = useMemo(() => {
    // 유효하지 않으면 빈 배열 반환
    if (!isValidParticipantsRaw) {
      return [];
    }
    
    return normalizeParticipants(participantsRaw);
  }, [participantsRaw, isValidParticipantsRaw]);

  const handleAddParticipant = (name: string) => {
    // 현재 정규화된 participants를 기준으로 색상 할당
    const newColor = assignColorToNewParticipant(participants);
    const newParticipant = { name, color: newColor };
    
    // 로컬 스토리지에 객체 형태로 저장
    const updated = [...participants, newParticipant];
    setParticipantsRaw(updated.map(p => ({ name: p.name, color: p.color })));
  };

  const handleRemoveParticipant = (index: number) => {
    const updated = participants.filter((_, i) => i !== index);
    // 색상 정보를 유지하면서 저장
    setParticipantsRaw(updated.map((p) => ({ name: p.name, color: p.color })));
  };

  const handleClearParticipants = () => {
    if (window.confirm('모든 참가자를 삭제하시겠습니까?')) {
      setParticipantsRaw([]);
    }
  };

  const handleShuffleColors = () => {
    if (participants.length === 0) return;
    
    // 현재 참가자들의 색상을 수집
    const colors = participants.map(p => p.color);
    
    // Fisher-Yates 알고리즘으로 색상 배열 섞기
    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    
    // 섞인 색상을 참가자들에게 재할당
    const shuffled = participants.map((p, index) => ({
      name: p.name,
      color: colors[index]
    }));
    
    setParticipantsRaw(shuffled);
  };

  const handleSpinComplete = (selectedParticipant: SpinCompleteResult) => {
    // 경마에서 온 경우: { winner, rankings } 객체
    // 돌림판에서 온 경우: 이름 문자열 또는 객체
    if (typeof selectedParticipant === 'object' && selectedParticipant !== null && 'winner' in selectedParticipant) {
      // 경마 결과
      const raceResult = selectedParticipant as RaceResult;
      setWinner(raceResult.winner);
      setRankings(raceResult.rankings || []);
    } else {
      // 돌림판 결과
      const winnerName = typeof selectedParticipant === 'string' 
        ? selectedParticipant 
        : (selectedParticipant as Participant).name || String(selectedParticipant);
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
        <button
          className={`nav-button ${currentView === 'soccer' ? 'active' : ''}`}
          onClick={() => setCurrentView('soccer')}
          disabled={participants.length < 2}
        >
          ⚽ 축구
        </button>
      </nav>

      <main className={`app-main ${currentView === 'roulette' ? 'roulette-view' : ''} ${currentView === 'horseRace' ? 'horse-race-view' : ''} ${currentView === 'soccer' ? 'soccer-view' : ''}`}>
        {currentView === 'participants' && (
          <div className="participants-view">
            <ParticipantList
              participants={participants}
              onAdd={handleAddParticipant}
              onRemove={handleRemoveParticipant}
              onClear={handleClearParticipants}
              onShuffle={handleShuffleColors}
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

        {currentView === 'soccer' && (
          <div className="soccer-view-content">
            {participants.length >= 2 ? (
              <SoccerTeamSetup
                participants={participants}
              />
            ) : (
              <div className="empty-state">
                <p>⚠️ 참가자가 2명 이상 필요합니다.</p>
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

import { useState, useMemo } from 'react';
import { SoccerGame } from './SoccerGame';
import type { Participant } from '../types/participant';
import type { Team, TeamAssignment, SoccerPlayer, SoccerSetup } from '../types/soccer';
import { generateRandomStats } from '../types/soccer';
import { shuffleArray } from '../utils/calc';
import './SoccerTeamSetup.css';

interface SoccerTeamSetupProps {
  participants: Participant[];
}

export function SoccerTeamSetup({ participants }: SoccerTeamSetupProps) {
  // 게임 상태: 'setup' | 'playing'
  const [gameState, setGameState] = useState<'setup' | 'playing'>('setup');

  // 팀 할당 상태 (진입 시 랜덤 초기화)
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>(() => {
    const shuffled = shuffleArray([...participants]);
    return shuffled.map((participant, index) => ({
      participant,
      team: index < Math.ceil(shuffled.length / 2) ? 'red' : 'blue' as Team,
    }));
  });

  // 경기 시간 (분)
  const [matchDuration, setMatchDuration] = useState(1);

  // AI 골키퍼 사용 여부
  const [useAIGoalkeeper, setUseAIGoalkeeper] = useState(true);

  // 게임 설정
  const [soccerSetup, setSoccerSetup] = useState<SoccerSetup | null>(null);

  // 팀별 참가자 분류
  const redTeamMembers = useMemo(() =>
    teamAssignments.filter(a => a.team === 'red'),
    [teamAssignments]
  );

  const blueTeamMembers = useMemo(() =>
    teamAssignments.filter(a => a.team === 'blue'),
    [teamAssignments]
  );

  // 팀 전환 핸들러
  const handleToggleTeam = (participantName: string) => {
    setTeamAssignments(prev =>
      prev.map(assignment =>
        assignment.participant.name === participantName
          ? { ...assignment, team: assignment.team === 'red' ? 'blue' : 'red' as Team }
          : assignment
      )
    );
  };

  // 경기 시간 변경 핸들러
  const handleDurationChange = (delta: number) => {
    setMatchDuration(prev => Math.max(1, Math.min(10, prev + delta)));
  };

  // 팀 랜덤 셔플
  const handleRandomShuffle = () => {
    const shuffled = shuffleArray([...participants]);
    setTeamAssignments(shuffled.map((participant, index) => ({
      participant,
      team: index < Math.ceil(shuffled.length / 2) ? 'red' : 'blue' as Team,
    })));
  };

  // 게임 시작 핸들러
  const handleStartGame = () => {
    // 능력치 랜덤 생성 및 SoccerPlayer 변환
    const redTeam: SoccerPlayer[] = redTeamMembers.map((a, index) => ({
      ...a.participant,
      team: 'red' as Team,
      stats: generateRandomStats(),
      isGoalkeeper: useAIGoalkeeper ? false : index === 0,
    }));

    const blueTeam: SoccerPlayer[] = blueTeamMembers.map((a, index) => ({
      ...a.participant,
      team: 'blue' as Team,
      stats: generateRandomStats(),
      isGoalkeeper: useAIGoalkeeper ? false : index === 0,
    }));

    // AI 골키퍼 추가
    if (useAIGoalkeeper) {
      redTeam.unshift({
        name: 'AI GK',
        color: '#FF6B6B',
        team: 'red',
        stats: {
          shootingAccuracy: 30,
          shootingPower: 40,
          longShotFrequency: 10,
          dribbleSpeed: 20,
          dribbleAttempt: 10,
          strength: 70,
          defense: 90,
          speed: 60,
          positioning: 85,
        },
        isGoalkeeper: true,
      });

      blueTeam.unshift({
        name: 'AI GK',
        color: '#4ECDC4',
        team: 'blue',
        stats: {
          shootingAccuracy: 30,
          shootingPower: 40,
          longShotFrequency: 10,
          dribbleSpeed: 20,
          dribbleAttempt: 10,
          strength: 70,
          defense: 90,
          speed: 60,
          positioning: 85,
        },
        isGoalkeeper: true,
      });
    }

    const setup: SoccerSetup = {
      redTeam,
      blueTeam,
      matchDuration,
      useAIGoalkeeper,
    };

    setSoccerSetup(setup);
    setGameState('playing');
  };

  // 게임 종료 핸들러 (설정 화면으로 돌아가기)
  const handleGameEnd = () => {
    setGameState('setup');
    setSoccerSetup(null);
  };

  // 게임 중일 때
  if (gameState === 'playing' && soccerSetup) {
    return <SoccerGame setup={soccerSetup} onGameEnd={handleGameEnd} />;
  }

  // 팀 구성 화면
  return (
    <div className="soccer-team-setup">
      <div className="setup-container">
        <h2 className="setup-title">팀 구성</h2>

        {/* 팀 영역 */}
        <div className="teams-container">
          {/* RED 팀 */}
          <div className="team-column red-team">
            <h3 className="team-header red">RED ({redTeamMembers.length})</h3>
            <div className="team-members">
              {redTeamMembers.map(({ participant }) => (
                <button
                  key={participant.name}
                  className="member-button"
                  style={{ backgroundColor: participant.color }}
                  onClick={() => handleToggleTeam(participant.name)}
                >
                  {participant.name}
                </button>
              ))}
            </div>
          </div>

          {/* BLUE 팀 */}
          <div className="team-column blue-team">
            <h3 className="team-header blue">BLUE ({blueTeamMembers.length})</h3>
            <div className="team-members">
              {blueTeamMembers.map(({ participant }) => (
                <button
                  key={participant.name}
                  className="member-button"
                  style={{ backgroundColor: participant.color }}
                  onClick={() => handleToggleTeam(participant.name)}
                >
                  {participant.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 설정 영역 */}
        <div className="settings-container">
          {/* 경기 시간 설정 */}
          <div className="setting-row">
            <span className="setting-label">경기 시간</span>
            <div className="setting-controls">
              <button
                className="control-button"
                onClick={() => handleDurationChange(-1)}
                disabled={matchDuration <= 1}
              >
                -
              </button>
              <span className="setting-value">{matchDuration}분</span>
              <button
                className="control-button"
                onClick={() => handleDurationChange(1)}
                disabled={matchDuration >= 10}
              >
                +
              </button>
            </div>
          </div>

          {/* AI 골키퍼 설정 */}
          <div className="setting-row">
            <span className="setting-label">AI 골키퍼</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={useAIGoalkeeper}
                onChange={(e) => setUseAIGoalkeeper(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="buttons-container">
          <button className="shuffle-button" onClick={handleRandomShuffle}>
            🔀 랜덤 배치
          </button>
          <button
            className="start-button"
            onClick={handleStartGame}
            disabled={redTeamMembers.length === 0 || blueTeamMembers.length === 0}
          >
            ⚽ 게임 시작
          </button>
        </div>
      </div>
    </div>
  );
}

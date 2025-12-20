import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import type { SoccerSetup, SoccerPlayer, Team } from '../types/soccer';
import './SoccerGame.css';

interface SoccerGameProps {
  setup: SoccerSetup;
  onGameEnd: () => void;
}

type GamePhase = 'playing' | 'goal' | 'finished';

// 엔티티 인터페이스 정의
interface PlayerSprite extends Phaser.Physics.Arcade.Sprite {
  playerData: SoccerPlayer;
  team: Team;
  hasBall: boolean;
  facingAngle: number;
  nameText: Phaser.GameObjects.Text;
  role: 'goalkeeper' | 'defender' | 'midfielder' | 'attacker';
  tackleCooldown: number; // 태클 쿨다운 (밀리초)
  stunTime: number; // 스턴 시간 - 이 시간 동안 AI 이동 불가
  ballAcquireCooldown: number; // 공 획득 쿨다운 - 패스/슈팅 후 바로 다시 공을 잡지 못하도록
}

interface BallSprite extends Phaser.Physics.Arcade.Sprite {
  owner: PlayerSprite | null;
  isAirborne: boolean;
  targetPosition: { x: number; y: number } | null;
}

export function SoccerGame({ setup, onGameEnd }: SoccerGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('playing');
  const [score, setScore] = useState({ red: 0, blue: 0 });
  const [remainingTime, setRemainingTime] = useState(setup.matchDuration * 60);

  // Phaser 게임 초기화
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width || window.innerWidth, 300);
    const height = Math.max(rect.height || window.innerHeight, 400);

    // 기존 게임 인스턴스가 있으면 제거
    if (gameInstanceRef.current) {
      gameInstanceRef.current.destroy(true);
      gameInstanceRef.current = null;
    }

    // Phaser Scene 클래스 정의
    class SoccerScene extends Phaser.Scene {
      players: PlayerSprite[] = [];
      ball: BallSprite | null = null;
      redGoal: Phaser.GameObjects.Rectangle | null = null;
      blueGoal: Phaser.GameObjects.Rectangle | null = null;
      fieldWidth = 0;
      fieldHeight = 0;
      goalWidth = 0;
      goalHeight = 0;

      // 게임 상태
      matchTime = 0;
      maxMatchTime = 0;
      redScore = 0;
      blueScore = 0;
      isPaused = false;
      setupData: SoccerSetup | null = null;
      isKickoff = false;
      kickoffPlayer: PlayerSprite | null = null;

      // 콜백
      onScoreUpdate: ((red: number, blue: number) => void) | null = null;
      onTimeUpdate: ((remaining: number) => void) | null = null;
      onGameEnd: (() => void) | null = null;

      constructor() {
        super({ key: 'SoccerScene' });
      }

      init(data: { setup: SoccerSetup }) {
        this.setupData = data.setup;
        this.maxMatchTime = data.setup.matchDuration * 60 * 1000; // 밀리초
        this.matchTime = 0;
        this.redScore = 0;
        this.blueScore = 0;
        this.players = [];
        this.isPaused = false;
        this.isKickoff = false;
        this.kickoffPlayer = null;
      }

      create() {
        const { width, height } = this.cameras.main;
        this.fieldWidth = width;
        this.fieldHeight = height;

        // 골대 크기 설정 (라인 그리기 전에 필요)
        this.goalWidth = width * 0.3;
        this.goalHeight = 15;

        // 경기장 배경
        this.add.rectangle(0, 0, width, height, 0x2d5a27).setOrigin(0, 0);

        // 경기장 라인
        this.drawFieldLines();

        // Red 팀 골대 (위쪽) - Blue 팀이 공격
        this.redGoal = this.add.rectangle(
          width / 2,
          this.goalHeight / 2,
          this.goalWidth,
          this.goalHeight,
          0xff6b6b
        );
        this.physics.add.existing(this.redGoal, true);

        // Blue 팀 골대 (아래쪽) - Red 팀이 공격
        this.blueGoal = this.add.rectangle(
          width / 2,
          height - this.goalHeight / 2,
          this.goalWidth,
          this.goalHeight,
          0x4ecdc4
        );
        this.physics.add.existing(this.blueGoal, true);

        // 공 생성
        this.createBall();

        // 선수 생성
        this.createPlayers();

        // 충돌 설정
        this.setupCollisions();

        // 초기 킥오프 전 1초 대기
        this.isPaused = true;
        this.time.delayedCall(1000, () => {
          this.isPaused = false;
        });
      }

      drawFieldLines() {
        const { width, height } = this.cameras.main;
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0xffffff, 0.6);

        // 중앙선
        graphics.lineBetween(0, height / 2, width, height / 2);

        // 센터 서클
        graphics.strokeCircle(width / 2, height / 2, 50);

        // 페널티 영역 (위쪽)
        const penaltyWidth = this.goalWidth * 2;
        const penaltyHeight = 80;
        graphics.strokeRect((width - penaltyWidth) / 2, 0, penaltyWidth, penaltyHeight);

        // 페널티 영역 (아래쪽)
        graphics.strokeRect((width - penaltyWidth) / 2, height - penaltyHeight, penaltyWidth, penaltyHeight);

        // 골 영역 (위쪽)
        const goalAreaWidth = this.goalWidth + 20;
        const goalAreaHeight = 30;
        graphics.strokeRect((width - goalAreaWidth) / 2, 0, goalAreaWidth, goalAreaHeight);

        // 골 영역 (아래쪽)
        graphics.strokeRect((width - goalAreaWidth) / 2, height - goalAreaHeight, goalAreaWidth, goalAreaHeight);
      }

      createBall() {
        const { width, height } = this.cameras.main;

        // 공 그래픽 텍스처 생성
        const ballGraphics = this.add.graphics();
        ballGraphics.fillStyle(0xffffff, 1);
        ballGraphics.fillCircle(12, 12, 10);
        ballGraphics.lineStyle(2, 0x000000, 1);
        ballGraphics.strokeCircle(12, 12, 10);
        ballGraphics.generateTexture('ball', 24, 24);
        ballGraphics.destroy();

        this.ball = this.physics.add.sprite(width / 2, height / 2, 'ball') as BallSprite;
        this.ball.setCircle(10, 2, 2);
        this.ball.setCollideWorldBounds(true);
        this.ball.setBounce(0.7);
        this.ball.setDrag(80);
        this.ball.setMaxVelocity(600);

        this.ball.owner = null;
        this.ball.isAirborne = false;
        this.ball.targetPosition = null;
      }

      createPlayers() {
        if (!this.setupData) return;

        const { width, height } = this.cameras.main;

        // Red 팀 선수 배치 (위쪽 절반)
        this.setupData.redTeam.forEach((player, index) => {
          const positions = this.getFormationPositions('red', this.setupData!.redTeam.length, index, player.isGoalkeeper);
          this.createPlayer(player, positions.x * width, positions.y * height);
        });

        // Blue 팀 선수 배치 (아래쪽 절반)
        this.setupData.blueTeam.forEach((player, index) => {
          const positions = this.getFormationPositions('blue', this.setupData!.blueTeam.length, index, player.isGoalkeeper);
          this.createPlayer(player, positions.x * width, positions.y * height);
        });

        // 초기 킥오프: 랜덤 팀에서 한 명을 공 옆에 배치
        const kickoffTeam: Team = Math.random() < 0.5 ? 'red' : 'blue';
        this.placeKickoffPlayer(kickoffTeam);

        // 플레이어 능력치 로그
        console.log('=== 플레이어 능력치 ===');
        console.log('--- RED 팀 ---');
        this.setupData.redTeam.forEach(player => {
          console.log(`[${player.name}]`, player.stats);
        });
        console.log('--- BLUE 팀 ---');
        this.setupData.blueTeam.forEach(player => {
          console.log(`[${player.name}]`, player.stats);
        });
      }

      placeKickoffPlayer(kickoffTeam: Team) {
        const { width, height } = this.cameras.main;

        // 킥오프 팀의 필드 플레이어들 (골키퍼 제외)
        const kickoffPlayers = this.players.filter(
          p => p.team === kickoffTeam && p.role !== 'goalkeeper'
        );

        if (kickoffPlayers.length === 0) return;

        // 랜덤으로 한 명 선택
        const selectedPlayer = kickoffPlayers[Math.floor(Math.random() * kickoffPlayers.length)];

        // 공 옆에 배치 (팀에 따라 약간 다른 위치)
        const ballX = width / 2;
        const ballY = height / 2;
        const offsetY = kickoffTeam === 'red' ? -20 : 20;

        selectedPlayer.setPosition(ballX, ballY + offsetY);
        selectedPlayer.setVelocity(0, 0);

        // 킥오프 상태 설정 및 공 소유
        this.isKickoff = true;
        this.kickoffPlayer = selectedPlayer;
        selectedPlayer.hasBall = true;
        if (this.ball) {
          this.ball.owner = selectedPlayer;
          this.ball.setVelocity(0, 0);
        }
      }

      getFormationPositions(team: Team, totalPlayers: number, index: number, isGoalkeeper: boolean): { x: number; y: number } {
        if (isGoalkeeper) {
          return team === 'red' ? { x: 0.5, y: 0.06 } : { x: 0.5, y: 0.94 };
        }

        // 골키퍼를 제외한 필드 플레이어 인덱스 계산
        const fieldPlayerIndex = isGoalkeeper ? index : index - (this.setupData?.redTeam.some(p => p.isGoalkeeper) || this.setupData?.blueTeam.some(p => p.isGoalkeeper) ? 0 : 0);

        const playersPerRow = 3;
        const row = Math.floor(fieldPlayerIndex / playersPerRow);
        const col = fieldPlayerIndex % playersPerRow;

        // 열 위치 계산 (좌, 중앙, 우)
        let colOffset: number;
        if (playersPerRow === 1) {
          colOffset = 0;
        } else if (col === 0) {
          colOffset = -0.25;
        } else if (col === 1) {
          colOffset = 0;
        } else {
          colOffset = 0.25;
        }

        if (team === 'red') {
          const yBase = 0.18 + row * 0.12;
          return { x: 0.5 + colOffset, y: Math.min(yBase, 0.42) };
        } else {
          const yBase = 0.82 - row * 0.12;
          return { x: 0.5 + colOffset, y: Math.max(yBase, 0.58) };
        }
      }

      createPlayer(playerData: SoccerPlayer, x: number, y: number) {
        const color = playerData.team === 'red' ? 0xff6b6b : 0x4ecdc4;
        const radius = playerData.isGoalkeeper ? 16 : 13;

        // 플레이어 그래픽 생성
        const textureKey = `player-${playerData.name}-${playerData.team}-${Date.now()}`;
        const graphics = this.add.graphics();
        graphics.fillStyle(color, 1);
        graphics.fillCircle(radius + 3, radius + 3, radius);
        graphics.lineStyle(2, 0x000000, 1);
        graphics.strokeCircle(radius + 3, radius + 3, radius);
        graphics.generateTexture(textureKey, (radius + 3) * 2, (radius + 3) * 2);
        graphics.destroy();

        const player = this.physics.add.sprite(x, y, textureKey) as PlayerSprite;
        player.setCircle(radius, 3, 3);
        player.setCollideWorldBounds(true);
        player.setBounce(0.3);
        player.setDrag(150);
        player.setMaxVelocity(playerData.stats.speed * 2.5);

        player.playerData = playerData;
        player.team = playerData.team;
        player.hasBall = false;
        player.facingAngle = playerData.team === 'red' ? Math.PI / 2 : -Math.PI / 2;
        player.tackleCooldown = 0;
        player.stunTime = 0;
        player.ballAcquireCooldown = 0;

        // 역할 할당
        const teamPlayers = this.players.filter(p => p.team === playerData.team);
        player.role = playerData.isGoalkeeper ? 'goalkeeper' : this.assignRole(playerData.team, teamPlayers.length);

        // 이름 표시 (90도 회전)
        player.nameText = this.add.text(x, y - radius - 8, playerData.name, {
          fontSize: '10px',
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.6)',
          padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(100).setAngle(90);

        this.players.push(player);
      }

      assignRole(team: Team, index: number): 'defender' | 'midfielder' | 'attacker' {
        if (index < 1) return 'defender';
        if (index < 3) return 'midfielder';
        return 'attacker';
      }

      setupCollisions() {
        // 플레이어 간 충돌
        this.physics.add.collider(
          this.players,
          this.players,
          (obj1, obj2) => this.handlePlayerCollision(obj1 as PlayerSprite, obj2 as PlayerSprite),
          undefined,
          this
        );

        // 공과 플레이어 충돌
        if (this.ball) {
          this.physics.add.overlap(
            this.ball,
            this.players,
            (obj1, obj2) => {
              const ball = obj1 as BallSprite;
              const player = obj2 as PlayerSprite;
              this.handleBallPlayerCollision(ball, player);
            },
            undefined,
            this
          );

          // 공과 골대 충돌 (골 판정)
          if (this.redGoal) {
            this.physics.add.overlap(
              this.ball,
              this.redGoal,
              () => this.handleGoal('blue'),
              undefined,
              this
            );
          }
          if (this.blueGoal) {
            this.physics.add.overlap(
              this.ball,
              this.blueGoal,
              () => this.handleGoal('red'),
              undefined,
              this
            );
          }
        }
      }

      handlePlayerCollision(player1: PlayerSprite, player2: PlayerSprite) {
        // 같은 팀이면 단순 충돌
        if (player1.team === player2.team) return;

        // 한 선수가 공을 가진 경우 - 태클 시도
        if (player1.hasBall) {
          this.attemptTackle(player2, player1);
        } else if (player2.hasBall) {
          this.attemptTackle(player1, player2);
        }
      }

      handleBallPlayerCollision(ball: BallSprite, player: PlayerSprite) {
        if (ball.isAirborne) return; // 공중 패스는 인터셉트 불가
        if (ball.owner === player) return; // 이미 공을 가진 선수
        if (player.ballAcquireCooldown > 0) return; // 패스/슈팅 직후 쿨다운 중

        // 골키퍼는 특별 처리 - 공을 반드시 막음
        if (player.playerData.isGoalkeeper) {
          // 빠른 공(슈팅)은 세이브 처리
          const ballSpeed = ball.body?.velocity ?
            Math.sqrt(ball.body.velocity.x ** 2 + ball.body.velocity.y ** 2) : 0;

          if (ballSpeed > 150) {
            // 세이브! 공을 튕겨냄
            const deflectAngle = Phaser.Math.Angle.Between(player.x, player.y, ball.x, ball.y);
            const deflectPower = ballSpeed * 0.4; // 원래 속도의 40%로 튕김
            ball.setVelocity(
              Math.cos(deflectAngle) * deflectPower,
              Math.sin(deflectAngle) * deflectPower
            );
            return;
          } else {
            // 느린 공은 잡기
            this.acquireBall(player);
            return;
          }
        }

        // 드리블 상태의 공인 경우 - 태클 시도
        if (ball.owner && ball.owner.team !== player.team) {
          this.attemptTackle(player, ball.owner);
        } else if (!ball.owner) {
          // 자유 상태의 공 - 획득
          this.acquireBall(player);
        } else if (ball.owner && ball.owner.team === player.team) {
          // 같은 팀의 패스 받기
          this.acquireBall(player);
        }
      }

      attemptTackle(tackler: PlayerSprite, ballOwner: PlayerSprite) {
        // 쿨다운 중이면 태클 불가
        if (tackler.tackleCooldown > 0) {
          return;
        }

        const tacklerStats = tackler.playerData.stats;
        const ownerStats = ballOwner.playerData.stats;

        // 태클 성공 확률 계산
        const tackleChance = (tacklerStats.defense + tacklerStats.strength) /
                             (ownerStats.dribbleSpeed + ownerStats.strength + 80);

        const roll = Math.random();

        if (roll < tackleChance) {
          // 태클 성공 - 공 빼앗기
          this.acquireBall(tackler);

          // 기존 소유자가 튕겨남
          const angle = Phaser.Math.Angle.Between(tackler.x, tackler.y, ballOwner.x, ballOwner.y);
          const pushForce = 200 + tacklerStats.strength * 2;
          ballOwner.setVelocity(
            Math.cos(angle) * pushForce,
            Math.sin(angle) * pushForce
          );

          // 공을 빼앗긴 선수도 쿨다운 적용
          ballOwner.tackleCooldown = 800;
          tackler.tackleCooldown = 500;

          // 스턴 적용 - AI가 velocity를 덮어쓰지 않도록
          ballOwner.stunTime = 400;
        } else {
          // 태클 실패 - 태클 시도자가 멀리 튕겨남
          const angle = Phaser.Math.Angle.Between(ballOwner.x, ballOwner.y, tackler.x, tackler.y);
          const pushForce = 350 + ownerStats.strength * 3;

          tackler.setVelocity(
            Math.cos(angle) * pushForce,
            Math.sin(angle) * pushForce
          );

          // 태클 실패 시 더 긴 쿨다운
          tackler.tackleCooldown = 1200;

          // 스턴 적용 - AI가 velocity를 덮어쓰지 않도록 (태클 실패 시 더 긴 스턴)
          tackler.stunTime = 600;
        }
      }

      acquireBall(player: PlayerSprite) {
        if (!this.ball) return;

        // 기존 소유자 해제
        if (this.ball.owner) {
          this.ball.owner.hasBall = false;
        }

        // 새 소유자 설정
        this.ball.owner = player;
        player.hasBall = true;
        this.ball.setVelocity(0, 0);
      }

      handleGoal(scoringTeam: Team) {
        if (this.isPaused) return;
        if (!this.ball) return;

        // 공이 실제로 골대 안에 있는지 확인
        const goalWidth = this.goalWidth;
        const ballX = this.ball.x;
        const fieldCenterX = this.fieldWidth / 2;

        if (Math.abs(ballX - fieldCenterX) > goalWidth / 2) {
          return; // 골대 범위 밖
        }

        this.isPaused = true;

        // 점수 업데이트
        if (scoringTeam === 'red') {
          this.redScore++;
        } else {
          this.blueScore++;
        }

        if (this.onScoreUpdate) {
          this.onScoreUpdate(this.redScore, this.blueScore);
        }

        // 골 이펙트
        this.showGoalEffect(scoringTeam);

        // 실점한 팀이 킥오프
        const concedingTeam: Team = scoringTeam === 'red' ? 'blue' : 'red';

        // 2초 후 리셋, 그 후 1초 대기 후 재개
        this.time.delayedCall(2000, () => {
          this.resetPositions(concedingTeam);
          // 킥오프 전 1초 대기
          this.time.delayedCall(1000, () => {
            this.isPaused = false;
          });
        });
      }

      showGoalEffect(scoringTeam: Team) {
        const { width, height } = this.cameras.main;

        // 화면 중앙에 "GOAL!" 텍스트
        const goalText = this.add.text(width / 2, height / 2, 'GOAL!', {
          fontSize: '48px',
          color: scoringTeam === 'red' ? '#ff6b6b' : '#4ecdc4',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
        }).setOrigin(0.5).setDepth(200);

        // 애니메이션
        this.tweens.add({
          targets: goalText,
          scaleX: { from: 0.5, to: 1.3 },
          scaleY: { from: 0.5, to: 1.3 },
          alpha: { from: 1, to: 0 },
          duration: 1500,
          ease: 'Bounce.easeOut',
          onComplete: () => goalText.destroy()
        });

        // 화면 흔들림
        this.cameras.main.shake(300, 0.01);
      }

      resetPositions(kickoffTeam?: Team) {
        if (!this.setupData) return;

        const { width, height } = this.cameras.main;

        // 공을 중앙으로
        if (this.ball) {
          this.ball.setPosition(width / 2, height / 2);
          this.ball.setVelocity(0, 0);
          this.ball.owner = null;
          this.ball.isAirborne = false;
          this.ball.setScale(1);
        }

        // 선수들 원위치
        const redPlayers = this.players.filter(p => p.team === 'red');
        const bluePlayers = this.players.filter(p => p.team === 'blue');

        redPlayers.forEach((player, index) => {
          player.hasBall = false;
          const pos = this.getFormationPositions('red', redPlayers.length, index, player.playerData.isGoalkeeper);
          player.setPosition(pos.x * width, pos.y * height);
          player.setVelocity(0, 0);
        });

        bluePlayers.forEach((player, index) => {
          player.hasBall = false;
          const pos = this.getFormationPositions('blue', bluePlayers.length, index, player.playerData.isGoalkeeper);
          player.setPosition(pos.x * width, pos.y * height);
          player.setVelocity(0, 0);
        });

        // 킥오프 팀의 선수 한 명을 공 옆에 배치
        if (kickoffTeam) {
          this.placeKickoffPlayer(kickoffTeam);
        }
      }

      update(time: number, delta: number) {
        // 이름 텍스트 위치는 항상 업데이트 (일시정지 중에도) - 회전되었으므로 옆에 배치
        this.players.forEach(player => {
          player.nameText.setPosition(player.x + 20, player.y);
        });

        if (this.isPaused) return;

        // 시간 업데이트
        this.matchTime += delta;
        const remaining = Math.max(0, Math.ceil((this.maxMatchTime - this.matchTime) / 1000));
        if (this.onTimeUpdate) this.onTimeUpdate(remaining);

        // 경기 종료 체크
        if (this.matchTime >= this.maxMatchTime) {
          this.endMatch();
          return;
        }

        // 쿨다운/스턴 감소
        this.players.forEach(player => {
          // 태클 쿨다운 감소
          if (player.tackleCooldown > 0) {
            player.tackleCooldown -= delta;
          }
          // 스턴 시간 감소
          if (player.stunTime > 0) {
            player.stunTime -= delta;
          }
          // 공 획득 쿨다운 감소
          if (player.ballAcquireCooldown > 0) {
            player.ballAcquireCooldown -= delta;
          }
        });

        // AI 로직
        this.updateAI(delta);

        // 드리블 상태 공 위치 업데이트
        this.updateBallPosition();
      }

      updateAI(delta: number) {
        this.players.forEach(player => {
          // 스턴 상태면 AI 이동 스킵 (velocity 유지)
          if (player.stunTime > 0) {
            return;
          }

          if (player.hasBall) {
            this.aiWithBall(player, delta);
          } else {
            this.aiWithoutBall(player, delta);
          }
        });
      }

      aiWithBall(player: PlayerSprite, delta: number) {
        const stats = player.playerData.stats;

        // 킥오프 시 아군 진영으로 패스
        if (this.isKickoff && player === this.kickoffPlayer) {
          this.attemptKickoffPass(player);
          return;
        }

        // 슈팅 가능한 거리인지 확인
        const goalY = player.team === 'red' ? this.fieldHeight : 0;
        const distanceToGoal = Math.abs(player.y - goalY);

        // 중거리슛 시도
        if (distanceToGoal < this.fieldHeight * 0.4 && Math.random() < stats.longShotFrequency / 2000) {
          this.attemptShot(player);
          return;
        }

        // 근거리 슈팅
        if (distanceToGoal < this.fieldHeight * 0.2 && Math.random() < 0.02) {
          this.attemptShot(player);
          return;
        }

        // 패스 또는 드리블 결정
        const nearbyOpponents = this.getNearbyOpponents(player, 60);

        if (nearbyOpponents.length > 0 && Math.random() < 0.015) {
          this.attemptPass(player);
        } else {
          this.dribble(player, delta);
        }
      }

      attemptKickoffPass(player: PlayerSprite) {
        if (!this.ball) return;

        // 아군 진영에 있는 팀원 찾기 (골키퍼 제외, 자신 제외)
        const teammates = this.players.filter(p =>
          p.team === player.team &&
          p !== player &&
          !p.playerData.isGoalkeeper
        );

        // 아군 진영에 있는 팀원 필터링
        const teammatesInOwnHalf = teammates.filter(p => {
          if (player.team === 'red') {
            return p.y < this.fieldHeight / 2; // red팀은 위쪽이 아군 진영
          } else {
            return p.y > this.fieldHeight / 2; // blue팀은 아래쪽이 아군 진영
          }
        });

        // 아군 진영에 팀원이 없으면 가장 가까운 팀원에게 패스
        const passTargets = teammatesInOwnHalf.length > 0 ? teammatesInOwnHalf : teammates;

        if (passTargets.length === 0) {
          this.isKickoff = false;
          this.kickoffPlayer = null;
          return;
        }

        // 가장 가까운 팀원 선택
        passTargets.sort((a, b) =>
          Phaser.Math.Distance.Between(player.x, player.y, a.x, a.y) -
          Phaser.Math.Distance.Between(player.x, player.y, b.x, b.y)
        );

        const target = passTargets[0];

        // 공 소유권 해제
        player.hasBall = false;
        this.ball.owner = null;
        player.ballAcquireCooldown = 300;

        // 패스 실행
        const angle = Phaser.Math.Angle.Between(this.ball.x, this.ball.y, target.x, target.y);
        const power = 180;

        this.ball.setVelocity(
          Math.cos(angle) * power,
          Math.sin(angle) * power
        );

        // 킥오프 상태 해제
        this.isKickoff = false;
        this.kickoffPlayer = null;
      }

      aiWithoutBall(player: PlayerSprite, delta: number) {
        if (!this.ball) return;

        const ballOwner = this.ball.owner;

        // 역할에 따른 행동 분기
        if (player.role === 'goalkeeper') {
          this.goalkeeperAI(player, delta);
          return;
        }

        // 팀이 공을 가지고 있는 경우
        if (ballOwner && ballOwner.team === player.team) {
          this.supportingRun(player, delta);
        } else if (ballOwner && ballOwner.team !== player.team) {
          // 상대팀이 공을 가진 경우
          this.defendingAI(player, delta);
        } else {
          // 자유 상태의 공 - 추격
          this.chaseBall(player, delta);
        }
      }

      goalkeeperAI(player: PlayerSprite, delta: number) {
        if (!this.ball) return;

        const stats = player.playerData.stats;
        const isAIGoalkeeper = player.playerData.name === 'AI GK';

        const goalY = player.team === 'red' ? 25 : this.fieldHeight - 25;
        const goalCenterX = this.fieldWidth / 2;
        const goalLeftX = goalCenterX - this.goalWidth / 2 + 10;
        const goalRightX = goalCenterX + this.goalWidth / 2 - 10;

        // 공이 골대를 향해 오는지 확인
        const ballVelocity = this.ball.body?.velocity as Phaser.Math.Vector2 | undefined;
        const isBallComingToGoal = player.team === 'red'
          ? (ballVelocity && ballVelocity.y < -30)
          : (ballVelocity && ballVelocity.y > 30);

        if (isBallComingToGoal && Math.abs(this.ball.y - goalY) < this.fieldHeight * 0.35) {
          // 공을 막으러 이동
          const targetX = Phaser.Math.Clamp(this.ball.x, goalLeftX, goalRightX);
          const speed = isAIGoalkeeper ? stats.speed * 1.8 : stats.speed * 1.2;
          this.moveToward(player, targetX, goalY, speed);
        } else {
          // 기본 위치 유지
          const targetX = Phaser.Math.Clamp(this.ball.x, goalLeftX, goalRightX);
          this.moveToward(player, targetX, goalY, stats.speed * 0.4);
        }

        // 공이 가까우면 잡기 시도 (직접 충돌 범위만)
        if (!this.ball.isAirborne && !this.ball.owner && player.ballAcquireCooldown <= 0) {
          const distance = Phaser.Math.Distance.Between(player.x, player.y, this.ball.x, this.ball.y);

          // 골키퍼 몸에 직접 닿는 범위만 (약 20px)
          if (distance < 22) {
            this.acquireBall(player);
          }
        }
      }

      // 역할별 위치 영역 정의
      getPositionZone(player: PlayerSprite): { minY: number; maxY: number } {
        const { height } = this.cameras.main;

        if (player.role === 'goalkeeper') {
          const y = player.team === 'red' ? 0 : height * 0.88;
          return { minY: y, maxY: y + height * 0.12 };
        }

        if (player.team === 'red') {
          switch (player.role) {
            case 'defender': return { minY: height * 0.08, maxY: height * 0.32 };
            case 'midfielder': return { minY: height * 0.22, maxY: height * 0.52 };
            case 'attacker': return { minY: height * 0.38, maxY: height * 0.68 };
          }
        } else {
          switch (player.role) {
            case 'defender': return { minY: height * 0.68, maxY: height * 0.92 };
            case 'midfielder': return { minY: height * 0.48, maxY: height * 0.78 };
            case 'attacker': return { minY: height * 0.32, maxY: height * 0.62 };
          }
        }

        return { minY: 0, maxY: height };
      }

      // 수비수들 사이의 빈 공간 찾기
      findGapBetweenDefenders(attackingTeam: Team, playerX: number): number | null {
        const defenders = this.players.filter(p =>
          p.team !== attackingTeam &&
          !p.playerData.isGoalkeeper &&
          (p.role === 'defender' || p.role === 'midfielder')
        );

        if (defenders.length < 2) {
          // 수비수가 1명 이하면 중앙으로 침투
          return this.fieldWidth / 2;
        }

        // 수비수들을 X 좌표로 정렬
        const sortedDefenders = [...defenders].sort((a, b) => a.x - b.x);

        // 수비수들 사이의 간격 계산
        const gaps: { x: number; width: number }[] = [];

        // 왼쪽 경계와 첫 번째 수비수 사이
        gaps.push({
          x: (50 + sortedDefenders[0].x) / 2,
          width: sortedDefenders[0].x - 50
        });

        // 수비수들 사이
        for (let i = 0; i < sortedDefenders.length - 1; i++) {
          const gapWidth = sortedDefenders[i + 1].x - sortedDefenders[i].x;
          gaps.push({
            x: (sortedDefenders[i].x + sortedDefenders[i + 1].x) / 2,
            width: gapWidth
          });
        }

        // 마지막 수비수와 오른쪽 경계 사이
        const lastDefender = sortedDefenders[sortedDefenders.length - 1];
        gaps.push({
          x: (lastDefender.x + this.fieldWidth - 50) / 2,
          width: this.fieldWidth - 50 - lastDefender.x
        });

        // 최소 간격 이상인 갭만 필터링
        const validGaps = gaps.filter(gap => gap.width > 60);

        if (validGaps.length === 0) return null;

        // 플레이어 위치에서 가장 가까운 유효한 갭 선택
        validGaps.sort((a, b) => Math.abs(a.x - playerX) - Math.abs(b.x - playerX));

        return validGaps[0].x;
      }

      supportingRun(player: PlayerSprite, delta: number) {
        if (!this.ball || !this.ball.owner) return;

        const zone = this.getPositionZone(player);
        const stats = player.playerData.stats;
        const owner = this.ball.owner;
        const positioningFactor = stats.positioning / 100; // 0~1

        // 경기장 경계
        const leftWing = 50;
        const rightWing = this.fieldWidth - 50;
        const centerX = this.fieldWidth / 2;

        // 같은 팀 선수들 (소유자, 골키퍼 제외) - 고정 인덱스 사용
        const teamFieldPlayers = this.players.filter(p =>
          p.team === player.team && p !== owner && !p.playerData.isGoalkeeper
        );

        // 플레이어 배열 내 고정 인덱스 사용 (매 프레임 변하지 않음)
        const myIndex = teamFieldPlayers.findIndex(p => p === player);
        const totalPlayers = teamFieldPlayers.length;

        let targetX: number;
        let targetY: number;

        const goalY = player.team === 'red' ? this.fieldHeight : 0;
        const goalDirection = player.team === 'red' ? 1 : -1;

        // 역할 분배: 좌측 날개 / 중앙 / 우측 날개
        let isWingRole = false;
        if (myIndex === 0) {
          // 좌측 날개 - 왼쪽 가장자리
          targetX = leftWing;
          targetY = owner.y + goalDirection * 80;
          isWingRole = true;
        } else if (myIndex === totalPlayers - 1) {
          // 우측 날개 - 오른쪽 가장자리
          targetX = rightWing;
          targetY = owner.y + goalDirection * 80;
          isWingRole = true;
        } else if (myIndex === 1 && totalPlayers > 2) {
          // 중앙 전방 지원
          targetX = owner.x + (owner.x < centerX ? 60 : -60);
          targetY = owner.y + goalDirection * 120;
        } else {
          // 나머지: 중앙 후방 지원
          targetX = centerX + (myIndex % 2 === 0 ? -80 : 80);
          targetY = owner.y - goalDirection * 60;
        }

        // 윙 역할인데 공 소유자와 같은 쪽이면 반대쪽으로 (목표 위치 기준, 현재 위치 아님)
        if (isWingRole && Math.abs(targetX - owner.x) < 80) {
          targetX = targetX < centerX ? rightWing : leftWing;
        }

        // 윙 역할은 homeX lerp를 적용하지 않고 바로 목표 위치로
        // 중앙 역할만 homeX와 lerp 적용
        const homeY = (zone.minY + zone.maxY) / 2;

        if (!isWingRole) {
          // 중앙 역할만 homeX와 lerp
          const homeX = centerX;
          targetX = Phaser.Math.Linear(homeX, targetX, 0.6 + positioningFactor * 0.4);
        }
        // 윙은 targetX 그대로 유지

        targetY = Phaser.Math.Linear(homeY, targetY, 0.5 + positioningFactor * 0.5);

        // 상대 수비 라인 계산
        const opponentDefenders = this.players.filter(p =>
          p.team !== player.team &&
          !p.playerData.isGoalkeeper &&
          (p.role === 'defender' || p.role === 'midfielder')
        );

        // 상대 수비 라인 Y 좌표 (가장 뒤에 있는 수비수 기준)
        let defenderLineY: number;
        if (player.team === 'red') {
          // red팀 공격 시 blue 수비라인 = blue 수비수 중 가장 위쪽(낮은 Y)
          defenderLineY = opponentDefenders.length > 0
            ? Math.min(...opponentDefenders.map(p => p.y))
            : this.fieldHeight * 0.7;
        } else {
          // blue팀 공격 시 red 수비라인 = red 수비수 중 가장 아래쪽(높은 Y)
          defenderLineY = opponentDefenders.length > 0
            ? Math.max(...opponentDefenders.map(p => p.y))
            : this.fieldHeight * 0.3;
        }

        // 돌파 시도 (positioning이 높을수록 자주)
        const distToOwner = Phaser.Math.Distance.Between(player.x, player.y, owner.x, owner.y);
        const penetrationChance = positioningFactor * 0.5; // positioning 100이면 50% 확률
        let isPenetrating = false;
        let isBehindDefenders = false;

        // 수비 라인 뒤로 침투 시도 (positioning에 따라)
        if (distToOwner > 60 && Math.random() < penetrationChance * 0.03) {
          const goalY = player.team === 'red' ? this.fieldHeight : 0;

          // 수비 라인 뒤로 침투 목표 설정
          const behindDefenderY = player.team === 'red'
            ? defenderLineY + 40  // red팀은 blue 수비라인 아래로
            : defenderLineY - 40; // blue팀은 red 수비라인 위로

          // 상대 선수들 사이의 빈 공간 찾기
          const gapX = this.findGapBetweenDefenders(player.team, player.x);

          if (gapX !== null) {
            targetX = gapX;
            targetY = behindDefenderY;
            isPenetrating = true;
            isBehindDefenders = true;
          }
        }

        // 일반 돌파 시도 (수비 뒤 침투가 아닌 경우)
        if (!isPenetrating && distToOwner > 80 && distToOwner < 200 && Math.random() < penetrationChance * 0.04) {
          // 상대 진영 방향으로 돌파 목표 설정
          const penetrationY = player.team === 'red'
            ? player.y + 120 // red팀은 아래로 돌파
            : player.y - 120; // blue팀은 위로 돌파

          // 주변 상대 선수들 확인
          const nearbyOpponents = this.players.filter(p =>
            p.team !== player.team &&
            !p.playerData.isGoalkeeper &&
            Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y) < 120
          );

          if (nearbyOpponents.length > 0) {
            // 상대 선수들을 피해서 돌파 경로 조정
            let avoidX = 0;
            nearbyOpponents.forEach(opponent => {
              const dx = player.x - opponent.x;
              avoidX += dx > 0 ? 60 : -60;
            });
            targetX = Phaser.Math.Clamp(player.x + avoidX / nearbyOpponents.length, leftWing, rightWing);
          } else {
            targetX = player.x;
          }

          targetY = penetrationY;
          isPenetrating = true;
        }

        // 라인 유지 (과전진 방지) - 수비 뒤 침투 중이면 제한 완화
        if (!isBehindDefenders) {
          const frontLineLimit = player.team === 'red'
            ? Math.max(owner.y + 100, zone.minY)
            : Math.min(owner.y - 100, zone.maxY);
          if (player.team === 'red') {
            targetY = Math.min(targetY, frontLineLimit);
          } else {
            targetY = Math.max(targetY, frontLineLimit);
          }
          // 존 범위 내로 제한 (일반 이동 시)
          targetY = Phaser.Math.Clamp(targetY, zone.minY, zone.maxY);
        } else {
          // 수비 뒤 침투 시에는 더 넓은 범위 허용
          const penetrationLimit = player.team === 'red'
            ? this.fieldHeight * 0.85  // 골대 근처까지
            : this.fieldHeight * 0.15;
          if (player.team === 'red') {
            targetY = Math.min(targetY, penetrationLimit);
          } else {
            targetY = Math.max(targetY, penetrationLimit);
          }
        }
        targetX = Phaser.Math.Clamp(targetX, leftWing, rightWing);

        // 혼잡 회피 - 강한 반발력으로 퍼지게
        const separationRadius = 80;
        const nearbyTeammates = this.players.filter(p =>
          p.team === player.team &&
          p !== player &&
          Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y) < separationRadius
        );

        if (nearbyTeammates.length > 0) {
          nearbyTeammates.forEach(teammate => {
            const dist = Phaser.Math.Distance.Between(player.x, player.y, teammate.x, teammate.y);
            const angle = Phaser.Math.Angle.Between(teammate.x, teammate.y, player.x, player.y);
            const repulsion = (separationRadius - dist) * 0.6;
            targetX += Math.cos(angle) * repulsion;
            targetY += Math.sin(angle) * repulsion;
          });
          targetY = Phaser.Math.Clamp(targetY, zone.minY, zone.maxY);
          targetX = Phaser.Math.Clamp(targetX, leftWing, rightWing);
        }

        // 돌파 중이면 속도 증가 (수비 뒤 침투는 더 빠르게)
        let speed: number;
        if (isBehindDefenders) {
          speed = stats.speed * 1.2; // 수비 뒤 침투 시 최고 속도
        } else if (isPenetrating) {
          speed = stats.speed * 1.0;
        } else {
          speed = stats.speed * 0.7;
        }
        this.moveToward(player, targetX, targetY, speed);
      }

      defendingAI(player: PlayerSprite, delta: number) {
        if (!this.ball || !this.ball.owner) return;

        const ballOwner = this.ball.owner;
        const stats = player.playerData.stats;
        const zone = this.getPositionZone(player);
        const positioningFactor = stats.positioning / 100; // 0~1

        // 우리 골대 위치
        const goalY = player.team === 'red' ? 30 : this.fieldHeight - 30;
        const goalCenterX = this.fieldWidth / 2;

        // 공 소유자와의 거리로 정렬하여 압박할 선수 결정
        const myTeamPlayers = this.players.filter(p =>
          p.team === player.team && !p.playerData.isGoalkeeper
        );
        const sortedByDistToOwner = [...myTeamPlayers].sort((a, b) =>
          Phaser.Math.Distance.Between(a.x, a.y, ballOwner.x, ballOwner.y) -
          Phaser.Math.Distance.Between(b.x, b.y, ballOwner.x, ballOwner.y)
        );

        const myPressIndex = sortedByDistToOwner.findIndex(p => p === player);
        const pressCount = 2; // 압박할 선수 수
        const shouldPress = myPressIndex < pressCount;

        if (shouldPress) {
          // 압박 담당: 공 소유자를 추격
          // positioning이 낮을수록 무작정 추격, 높을수록 차단 위치로
          const chaseRatio = 1 - positioningFactor * 0.5; // positioning 100이면 50%만 추격

          // 차단 지점 계산 (소유자 → 골대 라인 사이)
          const blockX = Phaser.Math.Linear(ballOwner.x, goalCenterX, 0.4);
          const blockY = Phaser.Math.Linear(ballOwner.y, goalY, 0.4);

          const targetX = Phaser.Math.Linear(blockX, ballOwner.x, chaseRatio);
          const targetY = Phaser.Math.Linear(blockY, ballOwner.y, chaseRatio);

          this.moveToward(player, targetX, targetY, stats.speed * 0.85);
        } else {
          // 수비 라인 유지: 골대 방향으로 형태 유지하면서 X축으로 퍼지기
          const centerX = this.fieldWidth / 2;
          const homeY = (zone.minY + zone.maxY) / 2;

          // 수비 라인 선수들을 X축으로 분산
          const lineDefenders = myTeamPlayers.filter(p => {
            const idx = sortedByDistToOwner.findIndex(pp => pp === p);
            return idx >= pressCount; // 압박하지 않는 선수들
          });
          const sortedLineByX = [...lineDefenders].sort((a, b) => a.x - b.x);
          const myLineIndex = sortedLineByX.findIndex(p => p === player);
          const totalLineDefenders = sortedLineByX.length;

          // 수비 위치 분산: 좌측, 중앙, 우측
          let homeX: number;
          if (totalLineDefenders <= 1) {
            homeX = centerX;
          } else if (myLineIndex === 0) {
            homeX = this.fieldWidth * 0.25; // 좌측
          } else if (myLineIndex === totalLineDefenders - 1) {
            homeX = this.fieldWidth * 0.75; // 우측
          } else {
            homeX = centerX; // 중앙
          }

          // 공이 좌우로 이동하면 라인도 슬라이딩
          const slideFactor = 0.3 + positioningFactor * 0.2; // positioning 높을수록 더 잘 슬라이딩
          const slideX = homeX + (ballOwner.x - centerX) * slideFactor;

          // 차단 지점으로 이동 (positioning이 높을수록)
          // blockPoint = lerp(ownerPos, goalCenter, 0.35~0.6)
          const blockRatio = 0.35 + positioningFactor * 0.25;
          const blockY = Phaser.Math.Linear(ballOwner.y, goalY, blockRatio);

          // positioning이 높을수록 차단 위치로, 낮을수록 홈 포지션
          let targetX = Phaser.Math.Linear(homeX, slideX, 0.3 + positioningFactor * 0.4);
          let targetY = Phaser.Math.Linear(homeY, blockY, positioningFactor);

          // 존 범위 내로 제한
          targetY = Phaser.Math.Clamp(targetY, zone.minY, zone.maxY);
          targetX = Phaser.Math.Clamp(targetX, 30, this.fieldWidth - 30);

          // 혼잡 회피
          const nearbyTeammates = this.players.filter(p =>
            p.team === player.team &&
            p !== player &&
            Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y) < 60
          );

          if (nearbyTeammates.length > 0) {
            nearbyTeammates.forEach(teammate => {
              const angle = Phaser.Math.Angle.Between(teammate.x, teammate.y, player.x, player.y);
              targetX += Math.cos(angle) * 20;
              targetY += Math.sin(angle) * 20;
            });
            targetY = Phaser.Math.Clamp(targetY, zone.minY, zone.maxY);
            targetX = Phaser.Math.Clamp(targetX, 30, this.fieldWidth - 30);
          }

          this.moveToward(player, targetX, targetY, stats.speed * 0.55);
        }
      }

      chaseBall(player: PlayerSprite, delta: number) {
        if (!this.ball) return;

        const stats = player.playerData.stats;
        const positioningFactor = stats.positioning / 100;
        const distance = Phaser.Math.Distance.Between(player.x, player.y, this.ball.x, this.ball.y);

        // 같은 팀에서 공에 가까운 순서 확인
        const myTeamPlayers = this.players.filter(p =>
          p.team === player.team && !p.playerData.isGoalkeeper
        );
        const sortedByDist = [...myTeamPlayers].sort((a, b) =>
          Phaser.Math.Distance.Between(a.x, a.y, this.ball!.x, this.ball!.y) -
          Phaser.Math.Distance.Between(b.x, b.y, this.ball!.x, this.ball!.y)
        );

        const myIndex = sortedByDist.findIndex(p => p === player);

        // positioning이 높을수록 가까운 1-2명만 추격, 낮을수록 다같이 추격
        const maxChasers = Math.round(2 + (1 - positioningFactor) * 2); // positioning 0이면 4명, 100이면 2명

        if (myIndex < maxChasers) {
          this.moveToward(player, this.ball.x, this.ball.y, stats.speed * 0.9);
        } else {
          // 나머지는 지원 위치로 - X축 분산
          const zone = this.getPositionZone(player);
          const homeY = (zone.minY + zone.maxY) / 2;
          const centerX = this.fieldWidth / 2;

          // 추격하지 않는 선수들을 X축으로 분산
          const supporters = myTeamPlayers.filter((_, idx) => idx >= maxChasers);
          const sortedByX = [...supporters].sort((a, b) => a.x - b.x);
          const mySupportIndex = sortedByX.findIndex(p => p === player);
          const totalSupporters = sortedByX.length;

          let baseX: number;
          if (totalSupporters <= 1) {
            baseX = centerX;
          } else if (mySupportIndex === 0) {
            baseX = this.fieldWidth * 0.2; // 좌측
          } else if (mySupportIndex === totalSupporters - 1) {
            baseX = this.fieldWidth * 0.8; // 우측
          } else {
            baseX = centerX;
          }

          // 공 방향으로 약간 이동
          const targetX = Phaser.Math.Linear(baseX, this.ball.x, 0.25);
          const targetY = Phaser.Math.Clamp(
            Phaser.Math.Linear(homeY, this.ball.y, 0.2),
            zone.minY,
            zone.maxY
          );
          this.moveToward(player, targetX, targetY, stats.speed * 0.5);
        }
      }

      moveToward(player: PlayerSprite, targetX: number, targetY: number, speed: number) {
        const angle = Phaser.Math.Angle.Between(player.x, player.y, targetX, targetY);
        const distance = Phaser.Math.Distance.Between(player.x, player.y, targetX, targetY);

        // 목표 지점 근처에서는 멈춤 (떨림 방지)
        if (distance > 15) {
          // 목표에 가까워지면 속도 감소 (부드러운 감속)
          const speedFactor = Math.min(1, distance / 50);
          const finalSpeed = speed * (0.3 + speedFactor * 0.7);

          player.setVelocity(
            Math.cos(angle) * finalSpeed,
            Math.sin(angle) * finalSpeed
          );
          player.facingAngle = angle;
        } else {
          player.setVelocity(0, 0);
        }
      }

      dribble(player: PlayerSprite, delta: number) {
        const stats = player.playerData.stats;
        const goalY = player.team === 'red' ? this.fieldHeight : 0;

        // 골대 방향으로 드리블
        const angle = Phaser.Math.Angle.Between(player.x, player.y, player.x, goalY);
        const speed = stats.dribbleSpeed * 1.5;

        // 약간의 좌우 움직임 추가
        const sideMove = Math.sin(this.time.now / 500) * 20;

        player.setVelocity(
          sideMove,
          Math.sin(angle) * speed
        );
        player.facingAngle = angle;
      }

      attemptPass(player: PlayerSprite) {
        const teammates = this.players.filter(p =>
          p.team === player.team &&
          p !== player &&
          !p.playerData.isGoalkeeper
        );

        if (teammates.length === 0) return;

        const stats = player.playerData.stats;

        // 가장 좋은 패스 대상 찾기
        const target = this.findBestPassTarget(player, teammates);
        if (!target) return;

        // 패스 경로에 상대팀이 있는지 확인
        const opponents = this.getPlayersInPath(player, target);

        // 패스 타입 결정 (능력치에 따라)
        const passAccuracy = stats.shootingAccuracy;
        const useAirPass = opponents.length > 0 && Math.random() < passAccuracy / 100;

        if (useAirPass) {
          this.airPass(player, target);
        } else {
          this.groundPass(player, target);
        }
      }

      findBestPassTarget(player: PlayerSprite, teammates: PlayerSprite[]): PlayerSprite | null {
        const goalY = player.team === 'red' ? this.fieldHeight : 0;

        // 골대에 더 가까운 팀원을 우선
        const sortedTeammates = [...teammates].sort((a, b) => {
          const distA = Math.abs(a.y - goalY);
          const distB = Math.abs(b.y - goalY);
          return distA - distB;
        });

        // 너무 가까운 선수는 제외
        const validTargets = sortedTeammates.filter(t =>
          Phaser.Math.Distance.Between(player.x, player.y, t.x, t.y) > 40
        );

        return validTargets[0] || null;
      }

      getPlayersInPath(from: PlayerSprite, to: PlayerSprite): PlayerSprite[] {
        return this.players.filter(p => {
          if (p === from || p === to) return false;
          if (p.team === from.team) return false;

          // 두 점 사이의 거리와 p까지의 거리로 경로상에 있는지 확인
          const totalDist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
          const distFromStart = Phaser.Math.Distance.Between(from.x, from.y, p.x, p.y);
          const distToEnd = Phaser.Math.Distance.Between(p.x, p.y, to.x, to.y);

          // 경로 근처에 있는지 확인 (오차 허용)
          return distFromStart + distToEnd < totalDist + 40;
        });
      }

      groundPass(player: PlayerSprite, target: PlayerSprite) {
        if (!this.ball) return;

        const stats = player.playerData.stats;

        // 공 소유권 해제
        player.hasBall = false;
        this.ball.owner = null;
        player.ballAcquireCooldown = 500; // 패스 후 0.5초간 공 획득 불가

        // 패스 정확도에 따른 오차
        const accuracy = stats.shootingAccuracy;
        const errorRange = (100 - accuracy) * 0.4;
        const targetX = target.x + (Math.random() - 0.5) * errorRange;
        const targetY = target.y + (Math.random() - 0.5) * errorRange;

        // 공 속도 설정
        const angle = Phaser.Math.Angle.Between(this.ball.x, this.ball.y, targetX, targetY);
        const power = stats.shootingPower * 2.5 + 100;

        this.ball.setVelocity(
          Math.cos(angle) * power,
          Math.sin(angle) * power
        );
      }

      airPass(player: PlayerSprite, target: PlayerSprite) {
        if (!this.ball) return;

        const stats = player.playerData.stats;

        // 공 소유권 해제
        player.hasBall = false;
        this.ball.owner = null;
        this.ball.isAirborne = true;
        player.ballAcquireCooldown = 800; // 공중 패스 후 0.8초간 공 획득 불가

        // 공중 패스는 정확도가 낮음
        const accuracy = stats.shootingAccuracy * 0.7;
        const errorRange = (100 - accuracy) * 1.2;
        const targetX = target.x + (Math.random() - 0.5) * errorRange;
        const targetY = target.y + (Math.random() - 0.5) * errorRange;

        this.ball.targetPosition = { x: targetX, y: targetY };

        // 공중 패스 애니메이션 (크기 변화)
        const duration = Phaser.Math.Distance.Between(this.ball.x, this.ball.y, targetX, targetY) * 4;

        // 위치 이동 트윈 (yoyo 없음)
        this.tweens.add({
          targets: this.ball,
          x: targetX,
          y: targetY,
          duration: duration,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            if (this.ball) {
              this.ball.isAirborne = false;
              this.ball.targetPosition = null;
            }
          }
        });

        // 스케일 애니메이션 (yoyo로 올라갔다 내려오는 효과)
        this.tweens.add({
          targets: this.ball,
          scaleX: 1.4,
          scaleY: 1.4,
          duration: duration / 2,
          ease: 'Sine.easeOut',
          yoyo: true,
          onComplete: () => {
            if (this.ball) {
              this.ball.setScale(1);
            }
          }
        });
      }

      attemptShot(player: PlayerSprite) {
        if (!this.ball) return;

        const stats = player.playerData.stats;
        const goalY = player.team === 'red' ? this.fieldHeight : 0;
        const goalCenterX = this.fieldWidth / 2;
        const goalHalfWidth = this.goalWidth / 2;

        // 골대 좌우 포스트 위치
        const leftPostX = goalCenterX - goalHalfWidth + 5; // 포스트 안쪽으로 약간
        const rightPostX = goalCenterX + goalHalfWidth - 5;

        // 니어포스트와 파포스트 결정 (플레이어 위치 기준)
        const nearPostX = player.x < goalCenterX ? leftPostX : rightPostX;
        const farPostX = player.x < goalCenterX ? rightPostX : leftPostX;

        // 상대 골키퍼 찾기
        const opponentTeam = player.team === 'red' ? 'blue' : 'red';
        const goalkeeper = this.players.find(p => p.team === opponentTeam && p.role === 'goalkeeper');

        // 각 포스트로의 슈팅 각도 계산
        const angleToNearPost = Math.abs(Phaser.Math.Angle.Between(player.x, player.y, nearPostX, goalY));
        const angleToFarPost = Math.abs(Phaser.Math.Angle.Between(player.x, player.y, farPostX, goalY));

        // 골키퍼가 막고 있는 영역 계산
        let nearPostOpen = 1.0;
        let farPostOpen = 1.0;

        if (goalkeeper) {
          const gkX = goalkeeper.x;
          const gkBlockRadius = 35; // 골키퍼가 커버하는 반경

          // 골키퍼가 각 포스트 방향을 얼마나 막고 있는지 계산
          const distToNearPost = Math.abs(gkX - nearPostX);
          const distToFarPost = Math.abs(gkX - farPostX);

          // 골키퍼가 포스트에 가까울수록 그 방향의 열린 정도가 낮아짐
          nearPostOpen = Math.min(1.0, distToNearPost / (gkBlockRadius * 2));
          farPostOpen = Math.min(1.0, distToFarPost / (gkBlockRadius * 2));

          // 최소값 설정 (완전히 막혀도 약간의 확률은 있음)
          nearPostOpen = Math.max(0.1, nearPostOpen);
          farPostOpen = Math.max(0.1, farPostOpen);
        }

        // 슈팅 각도와 열린 정도를 종합하여 각 방향의 득점 가능성 계산
        const nearPostScore = nearPostOpen * (1 + Math.abs(Math.sin(angleToNearPost)));
        const farPostScore = farPostOpen * (1 + Math.abs(Math.sin(angleToFarPost)));

        // 확률적으로 방향 선택
        const totalScore = nearPostScore + farPostScore;
        const nearPostProbability = nearPostScore / totalScore;

        const chosenPostX = Math.random() < nearPostProbability ? nearPostX : farPostX;

        // 공 소유권 해제
        player.hasBall = false;
        this.ball.owner = null;
        player.ballAcquireCooldown = 600; // 슈팅 후 0.6초간 공 획득 불가

        // 슈팅 정확도에 따른 미스 확률 계산 (정확도 100 = 5% 미스, 정확도 0 = 70% 미스)
        const accuracy = stats.shootingAccuracy;
        const missChance = 0.05 + (100 - accuracy) * 0.0065;
        const isMiss = Math.random() < missChance;

        let targetX: number;

        if (isMiss) {
          // 미스 시 선택한 포스트 방향 바깥으로 슈팅
          const missOffset = 25 + Math.random() * 45; // 골대 바깥 25~70px

          if (chosenPostX < goalCenterX) {
            // 왼쪽 포스트를 노렸다면 왼쪽 바깥으로
            targetX = leftPostX - missOffset;
          } else {
            // 오른쪽 포스트를 노렸다면 오른쪽 바깥으로
            targetX = rightPostX + missOffset;
          }
        } else {
          // 정상 슈팅 - 선택한 포스트 부근으로 (정확도에 따른 약간의 오차)
          const errorRange = (100 - accuracy) * 0.3;
          const error = (Math.random() - 0.5) * errorRange;

          // 포스트 안쪽으로 약간 여유를 두고 조준
          if (chosenPostX < goalCenterX) {
            targetX = chosenPostX + 10 + error; // 왼쪽 포스트면 오른쪽으로 약간
          } else {
            targetX = chosenPostX - 10 + error; // 오른쪽 포스트면 왼쪽으로 약간
          }
        }

        // 공 속도 설정
        const angle = Phaser.Math.Angle.Between(this.ball.x, this.ball.y, targetX, goalY);
        const power = stats.shootingPower * 3.5 + 200;

        this.ball.setVelocity(
          Math.cos(angle) * power,
          Math.sin(angle) * power
        );
      }

      getNearbyOpponents(player: PlayerSprite, radius: number): PlayerSprite[] {
        return this.players.filter(p =>
          p.team !== player.team &&
          Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y) < radius
        );
      }

      updateBallPosition() {
        if (!this.ball || !this.ball.owner) return;

        const owner = this.ball.owner;
        const offsetDistance = 18;
        const offsetX = Math.cos(owner.facingAngle) * offsetDistance;
        const offsetY = Math.sin(owner.facingAngle) * offsetDistance;

        this.ball.setPosition(owner.x + offsetX, owner.y + offsetY);
        this.ball.setVelocity(0, 0);
      }

      endMatch() {
        this.isPaused = true;

        // 최종 결과 표시
        const { width, height } = this.cameras.main;

        let resultText = 'DRAW!';
        let resultColor = '#ffffff';
        if (this.redScore > this.blueScore) {
          resultText = 'RED WINS!';
          resultColor = '#ff6b6b';
        } else if (this.blueScore > this.redScore) {
          resultText = 'BLUE WINS!';
          resultColor = '#4ecdc4';
        }

        this.add.text(width / 2, height / 2, resultText, {
          fontSize: '36px',
          color: resultColor,
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
        }).setOrigin(0.5).setDepth(200);

        if (this.onGameEnd) {
          this.time.delayedCall(2500, () => this.onGameEnd!());
        }
      }
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height,
      parent: container,
      scene: SoccerScene,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    const game = new Phaser.Game(config);
    gameInstanceRef.current = game;

    // 씬 시작 시 데이터 전달
    game.scene.start('SoccerScene', { setup });

    // 씬이 생성된 후 콜백 설정
    setTimeout(() => {
      const scene = game.scene.getScene('SoccerScene') as SoccerScene;
      if (scene) {
        scene.onScoreUpdate = (red: number, blue: number) => {
          setScore({ red, blue });
        };
        scene.onTimeUpdate = (remaining: number) => {
          setRemainingTime(remaining);
        };
        scene.onGameEnd = () => {
          setGamePhase('finished');
        };
      }
    }, 100);

    // 리사이즈 핸들러
    const handleResize = () => {
      if (gameInstanceRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = Math.max(rect.width || window.innerWidth, 300);
        const newHeight = Math.max(rect.height || window.innerHeight, 400);
        gameInstanceRef.current.scale.resize(newWidth, newHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (gameInstanceRef.current) {
        try {
          gameInstanceRef.current.destroy(true);
        } catch (e) {
          console.error('게임 인스턴스 정리 중 오류:', e);
        }
        gameInstanceRef.current = null;
      }
    };
  }, [setup]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="soccer-game-container">
      <div className="soccer-game-canvas" ref={containerRef} />
      <div className="soccer-game-ui">
        <div className="score-display">
          <span className="red-score">{score.red}</span>
          <span className="score-separator">-</span>
          <span className="blue-score">{score.blue}</span>
        </div>
        <div className="time-display">
          {formatTime(remainingTime)}
        </div>
      </div>
      {gamePhase === 'finished' && (
        <div className="game-result-overlay">
          <div className="result-content">
            <h2>경기 종료</h2>
            <div className="final-score">
              <span className="red-score">{score.red}</span>
              <span className="score-separator">-</span>
              <span className="blue-score">{score.blue}</span>
            </div>
            <p className="result-text">
              {score.red > score.blue ? 'RED 팀 승리!' : score.blue > score.red ? 'BLUE 팀 승리!' : '무승부!'}
            </p>
            <button onClick={onGameEnd} className="return-button">돌아가기</button>
          </div>
        </div>
      )}
    </div>
  );
}

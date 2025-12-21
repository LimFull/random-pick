import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import type { SoccerSetup, SoccerPlayer, Team } from '../types/soccer';
import type { PlayerSprite, BallSprite, GameContext, GamePhase } from '../soccer/types';
import {
  // AI
  aiWithBall,
  supportingRun,
  goalkeeperAI,
  defendingAI,
  chaseBall,
  // Physics
  handlePlayerCollision,
  handleBallPlayerCollision,
  acquireBall,
} from '../soccer';
import './SoccerGame.css';

interface SoccerGameProps {
  setup: SoccerSetup;
  onGameEnd: () => void;
}

export function SoccerGame({ setup, onGameEnd }: SoccerGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('playing');
  const [score, setScore] = useState({ red: 0, blue: 0 });
  const [remainingTime, setRemainingTime] = useState(setup.matchDuration * 60);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width || window.innerWidth, 300);
    const height = Math.max(rect.height || window.innerHeight, 400);

    if (gameInstanceRef.current) {
      gameInstanceRef.current.destroy(true);
      gameInstanceRef.current = null;
    }

    class SoccerScene extends Phaser.Scene {
      players: PlayerSprite[] = [];
      ball: BallSprite | null = null;
      redGoal: Phaser.GameObjects.Rectangle | null = null;
      blueGoal: Phaser.GameObjects.Rectangle | null = null;
      fieldWidth = 0;
      fieldHeight = 0;
      goalWidth = 0;
      goalHeight = 0;
      matchTime = 0;
      maxMatchTime = 0;
      redScore = 0;
      blueScore = 0;
      isPaused = false;
      setupData: SoccerSetup | null = null;
      isKickoff = false;
      kickoffPlayer: PlayerSprite | null = null;
      onScoreUpdate: ((red: number, blue: number) => void) | null = null;
      onTimeUpdate: ((remaining: number) => void) | null = null;
      onGameEnd: (() => void) | null = null;

      constructor() {
        super({ key: 'SoccerScene' });
      }

      // GameContext 생성
      getContext(): GameContext {
        return {
          scene: this,
          players: this.players,
          ball: this.ball,
          fieldWidth: this.fieldWidth,
          fieldHeight: this.fieldHeight,
          goalWidth: this.goalWidth,
          goalHeight: this.goalHeight,
          isKickoff: this.isKickoff,
          kickoffPlayer: this.kickoffPlayer,
          setKickoffState: (isKickoff: boolean, player: PlayerSprite | null) => {
            this.isKickoff = isKickoff;
            this.kickoffPlayer = player;
          },
        };
      }

      init(data: { setup: SoccerSetup }) {
        this.setupData = data.setup;
        this.maxMatchTime = data.setup.matchDuration * 60 * 1000;
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
        this.goalWidth = width * 0.3;
        this.goalHeight = 15;

        this.add.rectangle(0, 0, width, height, 0x2d5a27).setOrigin(0, 0);
        this.drawFieldLines();

        this.redGoal = this.add.rectangle(
          width / 2, this.goalHeight / 2, this.goalWidth, this.goalHeight, 0xff6b6b
        );
        this.physics.add.existing(this.redGoal, true);

        this.blueGoal = this.add.rectangle(
          width / 2, height - this.goalHeight / 2, this.goalWidth, this.goalHeight, 0x4ecdc4
        );
        this.physics.add.existing(this.blueGoal, true);

        this.createBall();
        this.createPlayers();
        this.setupCollisions();

        this.isPaused = true;
        this.time.delayedCall(1000, () => { this.isPaused = false; });
      }

      drawFieldLines() {
        const { width, height } = this.cameras.main;
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0xffffff, 0.6);
        graphics.lineBetween(0, height / 2, width, height / 2);
        graphics.strokeCircle(width / 2, height / 2, 50);

        const penaltyWidth = this.goalWidth * 2;
        const penaltyHeight = 80;
        graphics.strokeRect((width - penaltyWidth) / 2, 0, penaltyWidth, penaltyHeight);
        graphics.strokeRect((width - penaltyWidth) / 2, height - penaltyHeight, penaltyWidth, penaltyHeight);

        const goalAreaWidth = this.goalWidth + 20;
        const goalAreaHeight = 30;
        graphics.strokeRect((width - goalAreaWidth) / 2, 0, goalAreaWidth, goalAreaHeight);
        graphics.strokeRect((width - goalAreaWidth) / 2, height - goalAreaHeight, goalAreaWidth, goalAreaHeight);
      }

      createBall() {
        const { width, height } = this.cameras.main;
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
        this.ball.setDamping(true);
        this.ball.setDrag(0.85);
        this.ball.setMaxVelocity(600);
        this.ball.owner = null;
        this.ball.isAirborne = false;
        this.ball.targetPosition = null;
      }

      createPlayers() {
        if (!this.setupData) return;
        const { width, height } = this.cameras.main;

        this.setupData.redTeam.forEach((player, index) => {
          const pos = this.getFormationPositions('red', this.setupData!.redTeam.length, index, player.isGoalkeeper);
          this.createPlayer(player, pos.x * width, pos.y * height);
        });

        this.setupData.blueTeam.forEach((player, index) => {
          const pos = this.getFormationPositions('blue', this.setupData!.blueTeam.length, index, player.isGoalkeeper);
          this.createPlayer(player, pos.x * width, pos.y * height);
        });

        const kickoffTeam: Team = Math.random() < 0.5 ? 'red' : 'blue';
        this.placeKickoffPlayer(kickoffTeam);

        console.log('=== 플레이어 능력치 ===');
        console.log('--- RED 팀 ---');
        this.setupData.redTeam.forEach(player => console.log(`[${player.name}]`, player.stats));
        console.log('--- BLUE 팀 ---');
        this.setupData.blueTeam.forEach(player => console.log(`[${player.name}]`, player.stats));
      }

      placeKickoffPlayer(kickoffTeam: Team) {
        const { width, height } = this.cameras.main;
        const kickoffPlayers = this.players.filter(p => p.team === kickoffTeam && p.role !== 'goalkeeper');
        if (kickoffPlayers.length === 0) return;

        const selectedPlayer = kickoffPlayers[Math.floor(Math.random() * kickoffPlayers.length)];
        const offsetY = kickoffTeam === 'red' ? -20 : 20;
        selectedPlayer.setPosition(width / 2, height / 2 + offsetY);
        selectedPlayer.setVelocity(0, 0);

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

        const fieldPlayerIndex = index;
        const playersPerRow = 3;
        const row = Math.floor(fieldPlayerIndex / playersPerRow);
        const col = fieldPlayerIndex % playersPerRow;

        let colOffset: number;
        if (playersPerRow === 1) colOffset = 0;
        else if (col === 0) colOffset = -0.25;
        else if (col === 1) colOffset = 0;
        else colOffset = 0.25;

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
        player.dribbleTarget = null;
        player.dribbleTargetTime = 0;
        player.isPenetrating = false;
        player.penetratingTarget = null;
        player.penetratingDecisionTime = 0;
        player.isChasing = false;
        player.chaseDecisionTime = 0;

        const teamPlayers = this.players.filter(p => p.team === playerData.team);
        player.role = playerData.isGoalkeeper ? 'goalkeeper' : this.assignRole(playerData.team, teamPlayers.length);

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
        const ctx = this.getContext();

        this.physics.add.collider(
          this.players, this.players,
          (obj1, obj2) => handlePlayerCollision(ctx, obj1 as PlayerSprite, obj2 as PlayerSprite),
          undefined, this
        );

        if (this.ball) {
          this.physics.add.overlap(
            this.ball, this.players,
            (obj1, obj2) => handleBallPlayerCollision(ctx, obj1 as BallSprite, obj2 as PlayerSprite),
            undefined, this
          );

          if (this.redGoal) {
            this.physics.add.overlap(this.ball, this.redGoal, () => this.handleGoal('blue'), undefined, this);
          }
          if (this.blueGoal) {
            this.physics.add.overlap(this.ball, this.blueGoal, () => this.handleGoal('red'), undefined, this);
          }
        }
      }

      handleGoal(scoringTeam: Team) {
        if (this.isPaused || !this.ball) return;
        if (Math.abs(this.ball.x - this.fieldWidth / 2) > this.goalWidth / 2) return;

        this.isPaused = true;

        if (scoringTeam === 'red') this.redScore++;
        else this.blueScore++;

        if (this.onScoreUpdate) this.onScoreUpdate(this.redScore, this.blueScore);

        this.showGoalEffect(scoringTeam);

        const concedingTeam: Team = scoringTeam === 'red' ? 'blue' : 'red';
        this.time.delayedCall(2000, () => {
          this.resetPositions(concedingTeam);
          this.time.delayedCall(1000, () => { this.isPaused = false; });
        });
      }

      showGoalEffect(scoringTeam: Team) {
        const { width, height } = this.cameras.main;
        const goalText = this.add.text(width / 2, height / 2, 'GOAL!', {
          fontSize: '48px',
          color: scoringTeam === 'red' ? '#ff6b6b' : '#4ecdc4',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
        }).setOrigin(0.5).setDepth(200);

        this.tweens.add({
          targets: goalText,
          scaleX: { from: 0.5, to: 1.3 },
          scaleY: { from: 0.5, to: 1.3 },
          alpha: { from: 1, to: 0 },
          duration: 1500,
          ease: 'Bounce.easeOut',
          onComplete: () => goalText.destroy()
        });

        this.cameras.main.shake(300, 0.01);
      }

      resetPositions(kickoffTeam?: Team) {
        if (!this.setupData) return;
        const { width, height } = this.cameras.main;

        if (this.ball) {
          this.ball.setPosition(width / 2, height / 2);
          this.ball.setVelocity(0, 0);
          this.ball.owner = null;
          this.ball.isAirborne = false;
          this.ball.setScale(1);
        }

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

        if (kickoffTeam) this.placeKickoffPlayer(kickoffTeam);
      }

      update(time: number, delta: number) {
        this.players.forEach(player => {
          player.nameText.setPosition(player.x + 20, player.y);
        });

        if (this.isPaused) return;

        this.matchTime += delta;
        const remaining = Math.max(0, Math.ceil((this.maxMatchTime - this.matchTime) / 1000));
        if (this.onTimeUpdate) this.onTimeUpdate(remaining);

        if (this.matchTime >= this.maxMatchTime) {
          this.endMatch();
          return;
        }

        this.players.forEach(player => {
          if (player.tackleCooldown > 0) player.tackleCooldown -= delta;
          if (player.stunTime > 0) player.stunTime -= delta;
          if (player.ballAcquireCooldown > 0) player.ballAcquireCooldown -= delta;
        });

        this.updateAI(delta);
        this.updateBallPosition();
      }

      updateAI(delta: number) {
        const ctx = this.getContext();

        this.players.forEach(player => {
          if (player.stunTime > 0) return;

          if (player.hasBall) {
            aiWithBall(ctx, player, delta);
          } else {
            this.aiWithoutBall(ctx, player, delta);
          }
        });
      }

      aiWithoutBall(ctx: GameContext, player: PlayerSprite, delta: number) {
        if (!ctx.ball) return;

        const ballOwner = ctx.ball.owner;

        if (player.role === 'goalkeeper') {
          goalkeeperAI(ctx, player, delta);
          return;
        }

        if (ballOwner && ballOwner.team === player.team) {
          supportingRun(ctx, player, delta);
        } else if (ballOwner && ballOwner.team !== player.team) {
          defendingAI(ctx, player, delta);
        } else {
          chaseBall(ctx, player, delta);
        }
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
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    };

    const game = new Phaser.Game(config);
    gameInstanceRef.current = game;

    game.scene.start('SoccerScene', { setup });

    setTimeout(() => {
      const scene = game.scene.getScene('SoccerScene') as SoccerScene;
      if (scene) {
        scene.onScoreUpdate = (red: number, blue: number) => setScore({ red, blue });
        scene.onTimeUpdate = (remaining: number) => setRemainingTime(remaining);
        scene.onGameEnd = () => setGamePhase('finished');
      }
    }, 100);

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
      <div className={`soccer-game-canvas full-screen`} ref={containerRef} />
      <div className="soccer-game-ui">
        <div className="score-display">
          <span className="red-score">{score.red}</span>
          <span className="score-separator">-</span>
          <span className="blue-score">{score.blue}</span>
        </div>
        <div className="time-display">{formatTime(remainingTime)}</div>
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

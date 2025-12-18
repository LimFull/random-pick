import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import './HorseRace.css';

const TRACK_LENGTH_MULTIPLIER = 30;
const HORSE_MIN_SPEED = 200;
const HORSE_MAX_SPEED = 450;

/**
 * 경마 게임 컴포넌트
 * Phaser 3를 사용하여 벨트스크롤 방식의 경마 게임을 구현합니다.
 */
export function HorseRace({ participants, onRaceComplete }) {
  const gameRef = useRef(null);
  const gameInstanceRef = useRef(null);
  const [gameState, setGameState] = useState('idle'); // 'idle', 'racing', 'finished'
  const containerRef = useRef(null);

  // 게임 씬 클래스
  class HorseRaceScene extends Phaser.Scene {
    constructor() {
      super({ key: 'HorseRaceScene' });
      this.participants = [];
      this.horses = [];
      this.finishLine = null;
      this.gameFinished = false;
      this.winner = null;
      this.onRaceComplete = null;
      this.raceStarted = false;
      this.startY = 0; // 출발선 Y 위치 저장
      this.trackLength = 0; // 트랙 전체 길이 저장
      this.finishOrder = []; // 결승선 통과 순서 저장
      this.finishTimer = null; // 완주 후 타이머
    }

    preload() {
      // 말 스프라이트 이미지 로드 (tile000.png ~ tile011.png)
      // Vite에서 public 폴더의 파일은 루트에서 제공됨
      for (let i = 0; i < 12; i++) {
        const num = String(i).padStart(3, '0');
        // 절대 경로 사용 (Vite 개발 서버는 public 폴더를 루트에서 제공)
        const imagePath = `/images/horse/tile${num}.png`;
        console.log(`Loading image: ${imagePath}`); // 디버깅용
        
        // 이미지 로드 실패 시 에러 처리
        this.load.image(`horse-tile-${i}`, imagePath);
        this.load.on(`filecomplete-image-horse-tile-${i}`, () => {
          console.log(`Image loaded: horse-tile-${i}`);
        });
        this.load.on(`loaderror`, (file) => {
          console.error(`Failed to load image: ${file.key} from ${file.src}`);
        });
      }
    }

    init(data) {
      if (data && data.participants) {
        this.participants = data.participants;
      }
      // 경주 초기화 시 순위 정보도 초기화
      this.finishOrder = [];
      this.winner = null;
      this.gameFinished = false;
      // 기존 타이머가 있으면 취소
      if (this.finishTimer) {
        clearTimeout(this.finishTimer);
        this.finishTimer = null;
      }
    }

    /**
     * 원본 이미지의 검정색 부분을 지정된 색상으로 변경한 텍스처 생성
     * @param {string} sourceKey - 원본 텍스처 키
     * @param {string} targetKey - 생성할 텍스처 키
     * @param {string} color - 적용할 색상 (HEX 코드)
     */
    createColoredHorseTexture(sourceKey, targetKey, color) {
      const sourceTexture = this.textures.get(sourceKey);
      if (!sourceTexture) {
        console.warn(`Source texture not found: ${sourceKey}`);
        return;
      }

      const sourceImage = sourceTexture.getSourceImage();
      const canvas = document.createElement('canvas');
      canvas.width = sourceImage.width;
      canvas.height = sourceImage.height;
      const ctx = canvas.getContext('2d', { alpha: true }); // 투명도 지원

      // 캔버스를 투명하게 초기화
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 원본 이미지를 캔버스에 그리기
      ctx.drawImage(sourceImage, 0, 0);

      // 이미지 데이터 가져오기
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 색상 값을 RGB로 변환
      const targetColor = this.hexToRgb(color);

      // 각 픽셀을 순회하며 검정색 부분만 색상 변경
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 흰색 또는 밝은 배경 감지 및 투명 처리
        // RGB 값이 모두 높고 비슷한 경우 (흰색/밝은 회색)
        const isBright = r > 200 && g > 200 && b > 200;
        const isUniform = (Math.max(r, g, b) - Math.min(r, g, b)) < 30;
        if (isBright && isUniform && a > 0) {
          // 밝은 배경을 투명하게 만들기
          data[i + 3] = 0; // alpha를 0으로 설정
          continue;
        }

        // 투명한 픽셀은 건너뛰기
        if (a === 0) continue;

        // 검정색 감지: RGB 값이 모두 낮고 비슷한 경우 (회색/검정색)
        const maxChannel = Math.max(r, g, b);
        const minChannel = Math.min(r, g, b);
        const brightness = (r + g + b) / 3;
        
        // 검정색 또는 매우 어두운 회색 감지
        // 조건: 밝기가 낮고, 채널 간 차이가 작음 (순수한 검정/회색)
        const isBlack = brightness < 100 && (maxChannel - minChannel) < 30;

        if (isBlack) {
          // 검정색 부분을 정확한 타겟 색상으로 변경
          // 타겟 색상의 RGB 비율을 유지하면서 원본의 밝기 정보만 적용
          const originalBrightness = brightness; // 0~100 범위
          
          // 타겟 색상의 밝기 계산
          const targetBrightness = (targetColor.r + targetColor.g + targetColor.b) / 3;
          
          // 원본 밝기를 타겟 색상에 적용
          // 검정색(밝기 0)은 타겟 색상의 어두운 버전
          // 회색(밝기 중간)은 타겟 색상의 밝은 버전
          if (originalBrightness < 15) {
            // 완전 검정색: 타겟 색상의 90% 밝기로 적용 (정확한 색상 유지)
            const ratio = 0.9;
            data[i] = Math.round(targetColor.r * ratio);
            data[i + 1] = Math.round(targetColor.g * ratio);
            data[i + 2] = Math.round(targetColor.b * ratio);
          } else {
            // 어두운 회색: 원본 밝기 비율을 타겟 색상에 적용
            // 원본 밝기(0~100)를 타겟 색상 밝기에 맞춰 조정
            // 밝기 비율: (원본 밝기 / 100)을 사용하여 타겟 색상의 밝기 범위에 매핑
            const brightnessRatio = originalBrightness / 100; // 0~1
            
            // 타겟 색상의 밝기 범위를 유지하면서 원본 밝기 비율 적용
            // 최소 75% ~ 최대 100% 밝기 범위 사용 (더 밝게)
            const minBrightness = targetBrightness * 0.75; // 최소 75%
            const maxBrightness = targetBrightness; // 최대 100%
            const mappedBrightness = minBrightness + (brightnessRatio * (maxBrightness - minBrightness));
            
            // 타겟 색상의 RGB 비율을 정확히 유지하면서 밝기만 조정
            const colorRatio = mappedBrightness / targetBrightness;
            data[i] = Math.round(targetColor.r * colorRatio);
            data[i + 1] = Math.round(targetColor.g * colorRatio);
            data[i + 2] = Math.round(targetColor.b * colorRatio);
          }
          // alpha는 유지
        }
      }

      // 수정된 이미지 데이터를 캔버스에 다시 그리기
      ctx.putImageData(imageData, 0, 0);

      // Phaser 텍스처로 추가 (투명도 유지)
      this.textures.addCanvas(targetKey, canvas);
      
      // 텍스처가 제대로 생성되었는지 확인
      if (this.textures.exists(targetKey)) {
        console.log(`Colored texture created: ${targetKey} with color ${color}`);
      }
    }

    /**
     * HEX 색상을 RGB로 변환
     * @param {string} hex - HEX 색상 코드 (#RRGGBB)
     * @returns {Object} {r, g, b}
     */
    hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 255, g: 0, b: 0 }; // 기본값: 빨강
    }

    create() {
      const { width, height } = this.cameras.main;
      
      console.log(`Scene create: width=${width}, height=${height}, participants=${this.participants.length}`);

      // 배경 생성 (가로로 긴 배경, 세로 방향 경주)
      this.trackLength = height * TRACK_LENGTH_MULTIPLIER; // 경주 트랙 길이 (세로로 6배, 더 긴 경주를 위해 증가)
      const trackLength = this.trackLength;
      
      // 하늘 배경 (트랙 배경 뒤에 그려지도록 depth 0으로 설정)
      this.add.rectangle(0, 0, width, trackLength, 0x87CEEB).setOrigin(0, 0).setDepth(0);
      
      // 구름 추가 (배경 장식, 트랙 배경 뒤에)
      for (let i = 0; i < 10; i++) {
        const cloudY = (trackLength / 10) * i + Math.random() * 100;
        const cloudX = Math.random() * width;
        const cloudSize = 30 + Math.random() * 40;
        this.add.circle(cloudX, cloudY, cloudSize, 0xFFFFFF, 0.3).setOrigin(0.5, 0.5).setDepth(0);
        this.add.circle(cloudX + cloudSize * 0.5, cloudY, cloudSize * 0.8, 0xFFFFFF, 0.3).setOrigin(0.5, 0.5).setDepth(0);
        this.add.circle(cloudX - cloudSize * 0.5, cloudY, cloudSize * 0.8, 0xFFFFFF, 0.3).setOrigin(0.5, 0.5).setDepth(0);
      }
      
      // 출발선 위치 계산 (나중에 사용하기 위해 먼저 계산)
      const startY = trackLength * 0.7 + 30;
      
      // 땅/잔디 배경 (출발선 위쪽부터 결승선까지, 하늘 위에 그려지도록 depth 1)
      this.add.rectangle(0, 0, width, trackLength, 0x90EE90).setOrigin(0, 0).setDepth(1);
      
      // 트랙 경계선 (좌우)
      const trackWidth = width * 0.7; // 트랙 너비
      const trackLeft = width * 0.15; // 트랙 왼쪽 시작점
      const trackRight = trackLeft + trackWidth;
      
      // 트랙 배경 (갈색/흙색) - 출발선 위쪽부터 결승선까지
      this.add.rectangle(trackLeft, 0, trackWidth, trackLength, 0xD2B48C).setOrigin(0, 0).setDepth(2);
      
      // 트랙 중앙선 (점선 효과) - 출발선 위쪽부터 결승선까지
      for (let y = 0; y < trackLength; y += 30) {
        this.add.rectangle(width / 2, y, 4, 20, 0xFFFFFF).setOrigin(0.5, 0.5).setDepth(3);
      }
      
      // 좌측 울타리 (반복 패턴) - 출발선 위쪽부터 결승선까지
      const fencePostWidth = 8;
      const fencePostHeight = 60;
      const fenceSpacing = 40;
      for (let y = 0; y < trackLength; y += fenceSpacing) {
        // 울타리 기둥
        this.add.rectangle(trackLeft - 5, y, fencePostWidth, fencePostHeight, 0x8B4513).setOrigin(0.5, 0.5).setDepth(4);
        // 울타리 가로대
        this.add.rectangle(trackLeft - 5, y - fencePostHeight / 2 + 10, fencePostWidth * 2, 4, 0x654321).setOrigin(0.5, 0.5).setDepth(4);
        this.add.rectangle(trackLeft - 5, y, fencePostWidth * 2, 4, 0x654321).setOrigin(0.5, 0.5).setDepth(4);
        this.add.rectangle(trackLeft - 5, y + fencePostHeight / 2 - 10, fencePostWidth * 2, 4, 0x654321).setOrigin(0.5, 0.5).setDepth(4);
      }
      
      // 우측 울타리 (반복 패턴) - 출발선 위쪽부터 결승선까지
      for (let y = 0; y < trackLength; y += fenceSpacing) {
        // 울타리 기둥
        this.add.rectangle(trackRight + 5, y, fencePostWidth, fencePostHeight, 0x8B4513).setOrigin(0.5, 0.5).setDepth(4);
        // 울타리 가로대
        this.add.rectangle(trackRight + 5, y - fencePostHeight / 2 + 10, fencePostWidth * 2, 4, 0x654321).setOrigin(0.5, 0.5).setDepth(4);
        this.add.rectangle(trackRight + 5, y, fencePostWidth * 2, 4, 0x654321).setOrigin(0.5, 0.5).setDepth(4);
        this.add.rectangle(trackRight + 5, y + fencePostHeight / 2 - 10, fencePostWidth * 2, 4, 0x654321).setOrigin(0.5, 0.5).setDepth(4);
      }
      
      // 트랙 양쪽 잔디/풀 (카메라 움직임을 느끼게 하는 요소) - 출발선 위쪽부터 결승선까지
      const grassSpacing = 25;
      for (let y = 0; y < trackLength; y += grassSpacing) {
        // 좌측 잔디
        for (let i = 0; i < 3; i++) {
          const grassX = trackLeft - 30 - i * 15;
          const grassHeight = 15 + Math.random() * 10;
          this.add.rectangle(grassX, y, 3, grassHeight, 0x228B22).setOrigin(0.5, 0.5).setDepth(3);
        }
        // 우측 잔디
        for (let i = 0; i < 3; i++) {
          const grassX = trackRight + 30 + i * 15;
          const grassHeight = 15 + Math.random() * 10;
          this.add.rectangle(grassX, y, 3, grassHeight, 0x228B22).setOrigin(0.5, 0.5).setDepth(3);
        }
      }

      // 결승선 생성 (아래쪽, 트랙 위에)
      const finishY = trackLength * 0.95; // 트랙의 95% 지점 (더 먼 거리)
      this.finishLine = this.add.rectangle(trackLeft, finishY, trackWidth, 10, 0xFF0000).setOrigin(0, 0);
      this.finishLine.setDepth(10); // 말(depth 50~)보다 낮게 설정하여 말이 결승선 위에 보이도록

      // 결승선 텍스트
      this.add.text(width / 2, finishY + 20, '결승선', {
        fontSize: '24px',
        color: '#FF0000',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(11); // 말(depth 50~)보다 낮게 설정

      // 출발선 생성 (위쪽, 트랙 위에)
      this.startY = startY;
      this.add.rectangle(trackLeft, this.startY, trackWidth, 10, 0x000000).setOrigin(0, 0).setDepth(5);
      this.add.text(width / 2, this.startY - 20, '출발선', {
        fontSize: '24px',
        color: '#000000',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(5);

      // 말 생성 (트랙 위에 가로로 분산 배치, 위에서 시작)
      const horseSpacing = trackWidth / (this.participants.length + 1);
      this.horses = this.participants.map((participant, index) => {
        const x = trackLeft + horseSpacing * (index + 1);
        const name = typeof participant === 'string' ? participant : participant.name;
        const color = typeof participant === 'object' && participant.color ? participant.color : '#FF6B6B';

        // 말 스프라이트 생성 (첫 번째 프레임 사용)
        // 이미지가 로드되지 않았을 경우를 대비해 체크
        let horse;
        if (this.textures.exists('horse-tile-0')) {
          // 각 말마다 고유한 텍스처 키 생성
          const coloredTextureKey = `horse-colored-${index}`;
          
          // 색상이 적용된 텍스처가 없으면 생성
          if (!this.textures.exists(coloredTextureKey)) {
            this.createColoredHorseTexture('horse-tile-0', coloredTextureKey, color);
          }
          
          horse = this.add.sprite(x, this.startY + 30, coloredTextureKey);
          horse.setScale(2);
          // 말을 아래쪽을 향하도록 회전 (90도)
          horse.setRotation(Math.PI / 2);
          // 왼쪽 말이 오른쪽 말보다 위에 보이도록 depth 설정 (인덱스가 작을수록 높은 depth)
          // 결승선(depth 10)보다 위에 보이도록 depth 50 이상으로 설정
          horse.setDepth(50 - index); // 왼쪽 말(인덱스 0)이 가장 높은 depth (50)
        } else {
          // 이미지가 없으면 사각형으로 대체
          console.warn('Horse image not found, using rectangle placeholder');
          horse = this.add.rectangle(x, startY + 30, 60, 40, parseInt(color.replace('#', ''), 16));
          horse.setDepth(50 - index); // 사각형도 동일한 depth 적용
        }
        horse.setOrigin(0.5, 0.5);

        // 말 이름 표시 (말 위쪽에)
        const nameText = this.add.text(x, this.startY + 10, name, {
          fontSize: '16px',
          color: '#000000',
          fontStyle: 'bold',
          backgroundColor: '#FFFFFF',
          padding: { x: 8, y: 4 },
        }).setOrigin(0.5, 0.5);
        // 이름 텍스트도 말과 같은 방향으로 회전 (90도, 아래쪽 향함)
        nameText.setRotation(Math.PI / 2);
        // 이름 텍스트도 말과 같은 depth로 설정 (말 위에 표시되도록)
        nameText.setDepth(50 - index + 0.1); // 말보다 약간 위에

        // 애니메이션 생성 (색상이 적용된 텍스처 사용)
        const animKey = `horse-run-${index}`;
        const coloredTextureKey = `horse-colored-${index}`;
        
        if (!this.anims.exists(animKey) && this.textures.exists('horse-tile-0')) {
          // 각 프레임에 대해 색상이 적용된 텍스처 생성
          const frameObjects = [];
          for (let i = 0; i < 12; i++) {
            const sourceKey = `horse-tile-${i}`;
            const coloredFrameKey = `horse-colored-${index}-frame-${i}`;
            
            if (this.textures.exists(sourceKey)) {
              // 색상이 적용된 프레임 텍스처가 없으면 생성
              if (!this.textures.exists(coloredFrameKey)) {
                this.createColoredHorseTexture(sourceKey, coloredFrameKey, color);
              }
              frameObjects.push({ key: coloredFrameKey });
            }
          }
          
          if (frameObjects.length > 0) {
            this.anims.create({
              key: animKey,
              frames: frameObjects,
              frameRate: 30,
              repeat: -1,
            });
          }
        }

        // 말 객체에 속성 추가
        horse.x = x;
        horse.y = this.startY + 30;
        horse.speed = 0;
        horse.targetSpeed = 0;
        horse.speedChangeTimer = 0;
        horse.name = name;
        horse.color = color;
        horse.nameText = nameText;
        horse.index = index;
        horse.finishY = finishY; // 결승선 Y 위치 저장
        horse.finished = false; // 도착 여부 추적
        horse.slowAnimationCounter = 0; // 느린 애니메이션용 프레임 카운터
        horse.currentSlowFrameIndex = 0; // 느린 애니메이션 모드에서의 현재 프레임 인덱스
        horse.slowAnimationMode = false; // 느린 애니메이션 모드 여부
        horse.frameRepeatCount = 0; // 현재 프레임 반복 횟수

        return horse;
      });

      // 경주 시작 전에는 애니메이션을 재생하지 않음 (정지 상태)
      // startRace()에서 애니메이션을 시작함
      
      // 카메라를 출발선 위치로 초기화 (경주 시작 전에도 트랙이 보이도록)
      // 화면 상단에 출발선이 보이도록 설정 (0 이상으로 제한)
      const initialScrollY = Math.max(0, this.startY - 50);
      this.cameras.main.setScroll(0, initialScrollY);
    }

    update(time, delta) {
      if (this.gameFinished || !this.raceStarted) return;

      const finishY = this.horses.length > 0 ? this.horses[0].finishY : this.cameras.main.height * 2.7;

      // 각 말 업데이트
      this.horses.forEach((horse) => {
        // 속도 변경 타이머 업데이트
        horse.speedChangeTimer -= delta;

        if (horse.speedChangeTimer <= 0) {
          // 새로운 속도 설정 (1~5초 후 다시 변경)
          const minSpeed = HORSE_MIN_SPEED;
          const maxSpeed = HORSE_MAX_SPEED;
          horse.targetSpeed = minSpeed + Math.random() * (maxSpeed - minSpeed);
          horse.speedChangeTimer = 1000 + Math.random() * 4000; // 1~5초
        }

        // 속도 보간 (부드러운 가속/감속)
        const speedDiff = horse.targetSpeed - horse.speed;
        horse.speed += speedDiff * 0.1;

        // 말 이동 (아래로, y 증가)
        horse.y += (horse.speed * delta) / 1000;
        
        // 말의 속도에 따라 애니메이션 속도 조절
        if (horse.anims && horse.anims.currentAnim) {
          // 속도 범위를 0~1로 정규화
          const speedRange = HORSE_MAX_SPEED - HORSE_MIN_SPEED;
          const normalizedSpeed = Math.max(0, Math.min(1, (horse.speed - HORSE_MIN_SPEED) / speedRange));
          
          // 평균 속도 계산
          const averageSpeed = (HORSE_MIN_SPEED + HORSE_MAX_SPEED) / 2;
          const isBelowAverage = horse.speed < averageSpeed;
          
          // 평균 속도 이하일 때: 각 프레임을 2번씩 노출
          if (isBelowAverage) {
            // 느린 애니메이션 모드로 전환
            if (!horse.slowAnimationMode) {
              horse.slowAnimationMode = true;
              horse.anims.pause();
              // 현재 프레임 인덱스 저장
              const animKey = `horse-run-${horse.index}`;
              if (this.anims.exists(animKey)) {
                const anim = this.anims.get(animKey);
                const progress = horse.anims.currentAnim.progress || 0;
                horse.currentSlowFrameIndex = Math.floor(progress * anim.frames.length);
                horse.frameRepeatCount = 0;
              }
            }
            
            // 프레임 카운터 증가
            horse.slowAnimationCounter += delta;
            const frameDisplayTime = (1000 / 30) * 2; // 30fps 기준, 각 프레임을 2번 표시 (약 66ms)
            
            if (horse.slowAnimationCounter >= frameDisplayTime) {
              horse.slowAnimationCounter = 0;
              horse.frameRepeatCount++;
              
              // 같은 프레임을 2번 표시한 후 다음 프레임으로 이동
              if (horse.frameRepeatCount >= 2) {
                horse.frameRepeatCount = 0;
                const animKey = `horse-run-${horse.index}`;
                if (this.anims.exists(animKey)) {
                  const anim = this.anims.get(animKey);
                  horse.currentSlowFrameIndex = (horse.currentSlowFrameIndex + 1) % anim.frames.length;
                  
                  // 현재 프레임의 텍스처 설정
                  const currentFrame = anim.frames[horse.currentSlowFrameIndex];
                  if (currentFrame && currentFrame.textureKey) {
                    if (this.textures.exists(currentFrame.textureKey)) {
                      horse.setTexture(currentFrame.textureKey);
                    }
                  }
                }
              } else {
                // 같은 프레임을 다시 표시
                const animKey = `horse-run-${horse.index}`;
                if (this.anims.exists(animKey)) {
                  const anim = this.anims.get(animKey);
                  const currentFrame = anim.frames[horse.currentSlowFrameIndex];
                  if (currentFrame && currentFrame.textureKey) {
                    if (this.textures.exists(currentFrame.textureKey)) {
                      horse.setTexture(currentFrame.textureKey);
                    }
                  }
                }
              }
            }
          } else {
            // 평균 속도 이상일 때: 정상 애니메이션
            if (horse.slowAnimationMode) {
              horse.slowAnimationMode = false;
              horse.slowAnimationCounter = 0;
              horse.frameRepeatCount = 0;
              const animKey = `horse-run-${horse.index}`;
              if (this.anims.exists(animKey)) {
                horse.anims.resume();
                horse.anims.play(animKey);
              }
            }
            
            // 비선형 매핑으로 속도 차이를 더 강조 (제곱 함수 사용)
            // 빠른 속도일 때 더 큰 timeScale을 적용
            const speedFactor = Math.pow(normalizedSpeed, 0.6); // 0.6 제곱으로 빠른 속도 더 강조
            
            // timeScale 범위: 최소 0.1 (매우 느릴 때) ~ 최대 6.0 (매우 빠를 때) - 더 큰 범위
            const timeScale = 0.1 + (speedFactor * 5.9);
            
            // Phaser 3에서는 timeScale 속성을 직접 설정
            horse.anims.currentAnim.timeScale = timeScale;
          }
        }

        // 이름 텍스트 위치 업데이트 (말 위쪽에)
        if (horse.nameText) {
          horse.nameText.x = horse.x;
          horse.nameText.y = horse.y - 30;
        }

        // 결승선 도달 확인 (y가 finishY 이상이면 도달)
        if (horse.y + 100 >= finishY && !horse.finished) {
          horse.finished = true;
          
          // 결승선 통과 순서 기록
          this.finishOrder.push({
            name: horse.name,
            rank: this.finishOrder.length + 1
          });
          
          // 첫 번째로 도착한 말이 우승자
          if (!this.winner) {
            this.winner = horse.name;
          }
        }
      });

      // 모든 말이 도착했는지 확인
      const allFinished = this.horses.every(horse => horse.finished);
      if (allFinished && !this.gameFinished && this.horses.length > 0 && !this.finishTimer) {
        // 모든 말이 완주한 후 2초 후에 게임 종료 처리
        this.finishTimer = setTimeout(() => {
          this.gameFinished = true;
          
          // 우승자 및 순위 정보 콜백 호출
          if (this.onRaceComplete) {
            this.onRaceComplete({
              winner: this.winner,
              rankings: this.finishOrder
            });
          }
          
          this.finishTimer = null;
        }, 2000); // 2초 후
      }

      // 카메라 업데이트 (경주가 시작되면 가장 앞선 말을 따라감)
      // 결승선을 통과한 말이 한 마리라도 있으면 카메라 이동 중지
      const hasFinishedHorse = this.horses.some(horse => horse.finished);
      
      if (this.raceStarted && this.horses.length > 0 && !hasFinishedHorse) {
        const leadingHorse = this.horses.reduce((prev, curr) => 
          curr.y > prev.y ? curr : prev
        );
        
        // 최소 스크롤 위치: 출발선 상단이 화면 상단에 오도록 (0 이상으로 제한)
        const minScrollY = Math.max(0, this.startY - 50);
        
        // 최대 스크롤 위치: 트랙 끝이 화면에 보이도록 (트랙 길이 - 화면 높이)
        const maxScrollY = Math.max(0, this.trackLength - this.cameras.main.height);
        
        // 말이 출발선보다 아래로 내려갔을 때만 카메라가 따라가도록
        if (leadingHorse.y > this.startY + 50) {
          // 카메라 스크롤 위치 계산 (말이 화면 하단에 오도록 조정)
          // 말의 위치에서 화면 높이의 20%만 빼서 말이 화면 하단 쪽에 위치하도록 함
          const targetScrollY = leadingHorse.y - this.cameras.main.height * 0.75;
          
          // 스크롤 위치를 최소/최대 범위 내로 제한 (트랙 범위를 벗어나지 않도록)
          const scrollY = Math.max(minScrollY, Math.min(targetScrollY, maxScrollY));
          this.cameras.main.setScroll(0, scrollY);
        } else {
          // 말이 아직 출발선 근처에 있으면 카메라는 출발선 위치 유지
          this.cameras.main.setScroll(0, minScrollY);
        }
      }
    }

    startRace() {
      // 게임 시작 시 각 말의 초기 속도 설정
      this.raceStarted = true;
      
      // 카메라는 update()에서 자연스럽게 따라가도록 함 (여기서 재설정하지 않음)
      
      this.horses.forEach((horse, index) => {
        const minSpeed = HORSE_MIN_SPEED;
        const maxSpeed = HORSE_MAX_SPEED;
        horse.targetSpeed = minSpeed + Math.random() * (maxSpeed - minSpeed);
        horse.speedChangeTimer = 1000 + Math.random() * 4000;
        
        // 경주 시작 시 달리는 애니메이션 시작
        const animKey = `horse-run-${index}`;
        if (this.anims.exists(animKey) && horse.play) {
          horse.play(animKey);
        }
      });
    }
  }

  // Phaser 게임 초기화
  useEffect(() => {
    if (!containerRef.current || participants.length === 0) {
      return;
    }

    // 컨테이너 크기 확인
    const container = containerRef.current;
    if (!container) return;

    // 컨테이너 크기 계산 함수
    const getContainerSize = () => {
      const rect = container.getBoundingClientRect();
      let width = rect.width;
      let height = rect.height;
      
      // 크기가 0이거나 너무 작으면 부모 컨테이너 크기 사용
      if (width === 0 || height === 0 || width < 100 || height < 100) {
        const parent = container.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          width = parentRect.width || window.innerWidth;
          height = parentRect.height || window.innerHeight;
        } else {
          width = window.innerWidth;
          height = window.innerHeight;
        }
      }
      
      // 최소 크기 보장 (너무 작으면 최소값 사용)
      width = Math.max(width, 300);
      height = Math.max(height, 200);
      
      return { width, height };
    };
    
    const { width: gameWidth, height: gameHeight } = getContainerSize();
    console.log(`Game container size: ${gameWidth}x${gameHeight}`); // 디버깅용

    // 기존 게임 인스턴스가 있으면 제거
    if (gameInstanceRef.current) {
      gameInstanceRef.current.destroy(true);
      gameInstanceRef.current = null;
    }

    const config = {
      type: Phaser.AUTO,
      width: gameWidth,
      height: gameHeight,
      parent: container,
      scene: HorseRaceScene,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false,
        },
      },
    };

    const game = new Phaser.Game(config);
    gameInstanceRef.current = game;

    // 씬 시작 시 참가자 데이터 전달
    game.scene.start('HorseRaceScene', { participants });
    
    // 씬이 생성된 후 콜백 설정 (약간의 지연 후)
    setTimeout(() => {
      const scene = game.scene.getScene('HorseRaceScene');
      if (scene) {
        scene.onRaceComplete = (winner) => {
          setGameState('finished');
          if (onRaceComplete) {
            onRaceComplete(winner);
          }
        };
      }
    }, 100);

    // 리사이즈 이벤트 핸들러 (화면 크기 변경 시 게임 크기 조정)
    const handleResize = () => {
      if (gameInstanceRef.current && containerRef.current) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        let newWidth = rect.width || window.innerWidth;
        let newHeight = rect.height || window.innerHeight;
        
        // 최소 크기 보장
        newWidth = Math.max(newWidth, 300);
        newHeight = Math.max(newHeight, 200);
        
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
  }, [participants, onRaceComplete]);

  const handleStartRace = () => {
    if (gameInstanceRef.current) {
      const scene = gameInstanceRef.current.scene.getScene('HorseRaceScene');
      if (scene && gameState === 'idle') {
        // 먼저 스크롤 실행
        if (containerRef.current) {
          const container = containerRef.current;
          const containerRect = container.getBoundingClientRect();
          const scrollY = window.scrollY + containerRect.bottom - window.innerHeight;
          window.scrollTo({
            top: Math.max(0, scrollY),
            behavior: 'smooth'
          });
        }
        
        // 스크롤이 완료된 후 게임 시작 (smooth 스크롤 완료 대기)
        setTimeout(() => {
          setGameState('racing');
          scene.startRace();
        }, 800); // 스크롤 완료 대기 시간 (800ms)
      }
    }
  };

  const handleResetRace = () => {
    if (gameInstanceRef.current) {
      const scene = gameInstanceRef.current.scene.getScene('HorseRaceScene');
      if (scene) {
        scene.scene.restart({ participants });
        setGameState('idle');
      }
    }
  };

  if (participants.length === 0) {
    return (
      <div className="horse-race-empty">
        <p>⚠️ 참가자가 없습니다.</p>
        <p>먼저 "참가 인원 관리" 탭에서 참가자를 추가해주세요.</p>
      </div>
    );
  }

  return (
    <div className="horse-race-container">
      <div className="horse-race-game" ref={containerRef} />
      <div className={`horse-race-controls ${gameState === 'racing' ? 'racing' : ''}`}>
        {gameState === 'idle' && (
          <button onClick={handleStartRace} className="btn-start-race">
            경주 시작
          </button>
        )}
        {gameState === 'racing' && (
          <div className="racing-status">경주 진행 중...</div>
        )}
        {gameState === 'finished' && (
          <button onClick={handleResetRace} className="btn-reset-race">
            다시 시작
          </button>
        )}
      </div>
    </div>
  );
}

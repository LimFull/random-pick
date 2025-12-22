import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import './HorseRace.css';
import { mapRange, shuffleArray } from '../utils/calc';
import { horseImages } from '../assets/horseImages';
import type { Participant } from '../types/participant';
import type { RaceResult, GameState } from '../types/game';

const TRACK_LENGTH_MULTIPLIER = 30;
const HORSE_MIN_SPEED = 200;
const HORSE_MAX_SPEED = 450;

/**
 * 말 객체에 추가된 속성
 */
interface HorseSprite extends Phaser.GameObjects.Sprite {
  speed: number;
  targetSpeed: number;
  speedChangeTimer: number;
  name: string;
  color: string;
  nameText?: Phaser.GameObjects.Text;
  index: number;
  finishY: number;
  finished: boolean;
  burning: boolean;
}

/**
 * 경마 씬 데이터
 */
interface HorseRaceSceneData {
  participants?: Participant[];
}

/**
 * 경마 컴포넌트 Props
 */
interface HorseRaceProps {
  participants: Participant[];
  onRaceComplete: (result: RaceResult) => void;
}

/**
 * 경마 게임 컴포넌트
 * Phaser 3를 사용하여 벨트스크롤 방식의 경마 게임을 구현합니다.
 */
export function HorseRace({ participants, onRaceComplete }: HorseRaceProps) {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const [gameState, setGameState] = useState<GameState>('idle'); // 'idle', 'racing', 'finished'
  const containerRef = useRef<HTMLDivElement>(null);

  // 게임 씬 클래스
  class HorseRaceScene extends Phaser.Scene {
    participants: Participant[] = [];
    horses: HorseSprite[] = [];
    finishLine: Phaser.GameObjects.Rectangle | null = null;
    gameFinished = false;
    winner: string | null = null;
    onRaceComplete: ((result: RaceResult) => void) | null = null;
    raceStarted = false;
    startY = 0; // 출발선 Y 위치 저장
    trackLength = 0; // 트랙 전체 길이 저장
    finishOrder: Array<{ name: string; rank: number }> = []; // 결승선 통과 순서 저장
    finishTimer: ReturnType<typeof setTimeout> | null = null; // 완주 후 타이머
    burningPotentialIndex: number | null = null;
    firstLastDistance = 0;

    constructor() {
      super({ key: 'HorseRaceScene' });
    }

    preload() {
      // 말 스프라이트 이미지 로드 (base64 인라인 이미지 사용)
      // file:// 프로토콜에서도 작동하도록 base64 데이터 URL 사용
      for (let i = 0; i < horseImages.length; i++) {
        const imageKey = `horse-tile-${i}`;
        // base64 데이터 URL을 load.image에 직접 전달
        this.load.image(imageKey, horseImages[i]);
      }

      // 모든 텍스처가 로드된 후 필터 설정
      this.load.on('complete', () => {
        for (let i = 0; i < horseImages.length; i++) {
          const texture = this.textures.get(`horse-tile-${i}`);
          if (texture) {
            texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
          }
        }
      });
    }

    init(data?: HorseRaceSceneData) {
      if (data && data.participants) {
        // random으로 섞는다
        this.participants = data.participants;
        this.participants = shuffleArray(this.participants);
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
     * @param sourceKey - 원본 텍스처 키
     * @param targetKey - 생성할 텍스처 키
     * @param color - 적용할 색상 (HEX 코드)
     */
    createColoredHorseTexture(sourceKey: string, targetKey: string, color: string) {
      const sourceTexture = this.textures.get(sourceKey);
      if (!sourceTexture) {
        console.warn(`Source texture not found: ${sourceKey}`);
        return;
      }

      const sourceImage = sourceTexture.getSourceImage() as HTMLImageElement;
      const canvas = document.createElement('canvas');
      canvas.width = sourceImage.width;
      canvas.height = sourceImage.height;
      const ctx = canvas.getContext('2d', { alpha: true }); // 투명도 지원
      if (!ctx) return;

      // 픽셀 아트를 위한 이미지 스무딩 비활성화
      ctx.imageSmoothingEnabled = false;
      ctx.imageSmoothingQuality = 'low';

      // 캔버스를 투명하게 초기화
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 원본 이미지를 캔버스에 그리기
      ctx.drawImage(sourceImage, 0, 0);

      // 이미지 데이터 가져오기
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 색상 값을 RGB로 변환
      const targetColor = this.hexToRgb(color);

      // 원본 데이터 백업 (가장자리 정리 단계에서 사용)
      const width = canvas.width;
      const height = canvas.height;
      const originalData = new Uint8ClampedArray(data);

      // 1단계: 밝은 배경만 먼저 투명 처리 (원본 이미지 기준)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 투명한 픽셀은 건너뛰기
        if (a === 0) continue;

        const brightness = (r + g + b) / 3;
        const maxChannel = Math.max(r, g, b);
        const minChannel = Math.min(r, g, b);
        const channelDiff = maxChannel - minChannel;

        // 흰색 또는 밝은 배경 감지 및 투명 처리
        // 밝기가 높고 채널 간 차이가 작은 경우 (순수 흰색/밝은 회색 배경)
        // 조건을 조정하여 더 많은 밝은 배경을 제거하되 검정색 말은 보호
        const isVeryBright = brightness > 200; // 밝은 픽셀
        const isUniform = channelDiff < 40; // 채널 간 차이가 작음 (회색/흰색)
        
        // 밝은 배경 투명 처리
        if (isVeryBright && isUniform) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 0; // alpha를 0으로 설정
        }
      }

      // 2단계: 검정색/회색 부분을 색상으로 변경 (모든 어두운 픽셀 처리)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 투명한 픽셀은 건너뛰기
        if (a === 0) continue;

        const brightness = (r + g + b) / 3;
        const maxChannel = Math.max(r, g, b);
        const minChannel = Math.min(r, g, b);
        const channelDiff = maxChannel - minChannel;

        // 검정색 또는 회색 감지 (밝은 배경이 아닌 모든 어두운/중간 픽셀)
        // 조건: 밝기가 낮거나 중간이고, 채널 간 차이가 작음 (검정/회색)
        // 밝은 배경은 이미 1단계에서 처리되었으므로, 나머지는 모두 말의 일부로 간주
        // 모든 검정색 픽셀을 포함하도록 조건 완화
        const isDarkOrGray = brightness < 220 && channelDiff < 60;

        if (isDarkOrGray) {
          // 검정색/회색 부분을 정확한 타겟 색상으로 변경
          // 타겟 색상의 RGB 비율을 유지하면서 원본의 밝기 정보만 적용
          const originalBrightness = brightness; // 0~220 범위
          
          // 타겟 색상의 밝기 계산
          const targetBrightness = (targetColor.r + targetColor.g + targetColor.b) / 3;
          
          // 원본 밝기를 타겟 색상에 적용
          if (originalBrightness < 15) {
            // 완전 검정색: 타겟 색상의 90% 밝기로 적용 (정확한 색상 유지)
            const ratio = 0.9;
            data[i] = Math.round(targetColor.r * ratio);
            data[i + 1] = Math.round(targetColor.g * ratio);
            data[i + 2] = Math.round(targetColor.b * ratio);
          } else {
            // 회색: 원본 밝기 비율을 타겟 색상에 적용
            // 원본 밝기(0~220)를 타겟 색상 밝기에 맞춰 조정
            const brightnessRatio = Math.min(originalBrightness / 220, 1); // 0~1로 정규화
            
            // 타겟 색상의 밝기 범위를 유지하면서 원본 밝기 비율 적용
            // 최소 75% ~ 최대 100% 밝기 범위 사용
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
        } else {
          // 검정색도 아니고 밝은 배경도 아닌 중간 픽셀들도 투명 처리
          // (안티앨리어싱으로 인한 반투명 픽셀 제거)
          if (brightness > 100 && brightness < 200) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 0;
          }
        }
      }

      // 2.5단계: 남은 검정색 픽셀 처리 (모든 검정색 점 제거)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 투명한 픽셀은 건너뛰기
        if (a === 0) continue;

        const brightness = (r + g + b) / 3;
        
        // 남은 검정색 픽셀 (밝기가 매우 낮고 색상이 거의 없는 경우)을 색상으로 변경
        if (brightness < 50 && r < 50 && g < 50 && b < 50) {
          // 검정색을 타겟 색상으로 변경
          const ratio = 0.9;
          data[i] = Math.round(targetColor.r * ratio);
          data[i + 1] = Math.round(targetColor.g * ratio);
          data[i + 2] = Math.round(targetColor.b * ratio);
        }
      }

      // 3단계: 가장자리 정리 및 남은 검정색 점 제거
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const a = data[idx + 3];
          
          // 현재 픽셀이 투명하지 않은 경우
          if (a > 0) {
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const brightness = (r + g + b) / 3;
            
            // 원본 이미지의 밝기 확인 (색상 적용 전)
            const origR = originalData[idx];
            const origG = originalData[idx + 1];
            const origB = originalData[idx + 2];
            const origBrightness = (origR + origG + origB) / 3;
            
            // 남은 검정색 점 처리 (색상이 적용되지 않은 검정색 픽셀)
            if (brightness < 50 && r < 50 && g < 50 && b < 50) {
              // 주변에 색상이 있는 픽셀이 있는지 확인
              let hasColoredNeighbor = false;
              const neighbors = [
                { x: x - 1, y }, { x: x + 1, y },
                { x, y: y - 1 }, { x, y: y + 1 },
                { x: x - 1, y: y - 1 }, { x: x + 1, y: y - 1 },
                { x: x - 1, y: y + 1 }, { x: x + 1, y: y + 1 }
              ];
              
              for (const neighbor of neighbors) {
                if (neighbor.x >= 0 && neighbor.x < width && neighbor.y >= 0 && neighbor.y < height) {
                  const nIdx = (neighbor.y * width + neighbor.x) * 4;
                  if (data[nIdx + 3] > 0) {
                    const nR = data[nIdx];
                    const nG = data[nIdx + 1];
                    const nB = data[nIdx + 2];
                    const nBrightness = (nR + nG + nB) / 3;
                    // 주변에 색상이 있는 픽셀이 있으면 검정색 점을 색상으로 변경
                    if (nBrightness > 50) {
                      hasColoredNeighbor = true;
                      break;
                    }
                  }
                }
              }
              
              // 색상이 있는 픽셀 옆에 있는 검정색 점을 색상으로 변경
              if (hasColoredNeighbor) {
                const ratio = 0.9;
                data[idx] = Math.round(targetColor.r * ratio);
                data[idx + 1] = Math.round(targetColor.g * ratio);
                data[idx + 2] = Math.round(targetColor.b * ratio);
              } else {
                // 고립된 검정색 점은 투명 처리
                data[idx] = 0;
                data[idx + 1] = 0;
                data[idx + 2] = 0;
                data[idx + 3] = 0;
              }
            }
            
            // 원본이 매우 밝은 배경이었던 경우만 확인 (색상이 적용된 말은 제외)
            if (origBrightness > 200) {
              // 주변 픽셀 확인 (상하좌우)
              let hasTransparentNeighbor = false;
              const neighbors = [
                { x: x - 1, y }, { x: x + 1, y },
                { x, y: y - 1 }, { x, y: y + 1 }
              ];
              
              for (const neighbor of neighbors) {
                if (neighbor.x >= 0 && neighbor.x < width && neighbor.y >= 0 && neighbor.y < height) {
                  const nIdx = (neighbor.y * width + neighbor.x) * 4;
                  if (data[nIdx + 3] === 0) {
                    hasTransparentNeighbor = true;
                    break;
                  }
                }
              }
              
              // 투명한 픽셀 옆에 있는 원본 밝은 픽셀만 제거 (흰색 테두리 제거)
              // 색상이 적용된 말은 원본이 어두우므로 보호됨
              if (hasTransparentNeighbor && brightness > 150) {
                data[idx] = 0;
                data[idx + 1] = 0;
                data[idx + 2] = 0;
                data[idx + 3] = 0;
              }
            }
          }
        }
      }

      // 4단계: 외곽선 추가 - 색상이 있는 픽셀의 외곽에 검정색 선 그리기
      const outlineWidth = 1; // 외곽선 굵기 (픽셀 단위)
      
      // 외곽선을 그릴 위치를 저장할 배열 (투명한 픽셀 위치에만 그리기)
      const outlinePixels = new Set<string>();
      
      // 색상이 있는 픽셀의 경계를 찾기
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const a = data[idx + 3];
          
          // 현재 픽셀이 색상이 있는 경우
          if (a > 0) {
            // 주변 4방향(상하좌우) 픽셀 확인
            const neighbors = [
              { x: x, y: y - 1 },   // 위
              { x: x, y: y + 1 },   // 아래
              { x: x - 1, y },      // 왼쪽
              { x: x + 1, y }       // 오른쪽
            ];
            
            // 주변에 투명한 픽셀이 있으면 외곽선 위치로 표시
            for (const neighbor of neighbors) {
              if (neighbor.x >= 0 && neighbor.x < width && neighbor.y >= 0 && neighbor.y < height) {
                const nIdx = (neighbor.y * width + neighbor.x) * 4;
                if (data[nIdx + 3] === 0) {
                  // 외곽선을 그릴 위치 저장
                  outlinePixels.add(`${neighbor.y},${neighbor.x}`);
                  
                  // 외곽선 굵기만큼 확장 (대각선 방향도 포함)
                  if (outlineWidth > 1) {
                    for (let dy = -outlineWidth + 1; dy < outlineWidth; dy++) {
                      for (let dx = -outlineWidth + 1; dx < outlineWidth; dx++) {
                        if (dx === 0 && dy === 0) continue; // 이미 추가됨
                        const outlineX = neighbor.x + dx;
                        const outlineY = neighbor.y + dy;
                        if (outlineX >= 0 && outlineX < width && outlineY >= 0 && outlineY < height) {
                          const dist = Math.sqrt(dx * dx + dy * dy);
                          if (dist < outlineWidth) {
                            outlinePixels.add(`${outlineY},${outlineX}`);
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                // 이미지 경계 밖도 외곽선 위치로 표시
                outlinePixels.add(`${neighbor.y},${neighbor.x}`);
              }
            }
          }
        }
      }
      
      // 외곽선 그리기 (투명한 픽셀 위치에만 검정색으로 그리기)
      for (const pixelKey of outlinePixels) {
        const [y, x] = pixelKey.split(',').map(Number);
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          // 해당 위치가 투명한 경우에만 외곽선 그리기
          if (data[idx + 3] === 0) {
            data[idx] = 0;     // R (검정)
            data[idx + 1] = 0; // G (검정)
            data[idx + 2] = 0; // B (검정)
            data[idx + 3] = 255; // A (불투명)
          }
        }
      }


      // 수정된 이미지 데이터를 캔버스에 다시 그리기
      ctx.putImageData(imageData, 0, 0);

      // Phaser 텍스처로 추가 (투명도 유지, 픽셀 아트 모드)
      this.textures.addCanvas(targetKey, canvas);
      // 픽셀 아트 모드 설정으로 선명한 렌더링
      const texture = this.textures.get(targetKey);
      if (texture) {
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
      
      // 텍스처가 제대로 생성되었는지 확인
      if (this.textures.exists(targetKey)) {
        console.log(`Colored texture created: ${targetKey} with color ${color}`);
      }
    }

    /**
     * HEX 색상을 RGB로 변환
     * @param hex - HEX 색상 코드 (#RRGGBB)
     * @returns {r, g, b}
     */
    hexToRgb(hex: string): { r: number; g: number; b: number } {
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
      this.add.text(width / 2, finishY + 40, '결승선', {
        fontSize: '24px',
        color: '#FF0000',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(11); // 말(depth 50~)보다 낮게 설정

      // 출발선 생성 (위쪽, 트랙 위에)
      this.startY = startY;
      this.add.rectangle(trackLeft, this.startY + 120, trackWidth, 10, 0x000000).setOrigin(0, 0).setDepth(5);
      this.add.text(width / 2, this.startY + 100, '출발선', {
        fontSize: '24px',
        color: '#000000',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setDepth(5);

      // 말 생성 (트랙 위에 가로로 분산 배치, 위에서 시작)
      const horseSpacing = trackWidth / (this.participants.length + 1);
      this.horses = this.participants.map((participant, index) => {
        const x = trackLeft + 30 + horseSpacing * (index + 1);
        const name = participant.name;
        const color = participant.color || '#FF6B6B';

        // 말 스프라이트 생성 (첫 번째 프레임 사용)
        // 이미지가 로드되지 않았을 경우를 대비해 체크
        let horse: HorseSprite;
        if (this.textures.exists('horse-tile-0')) {
          // 각 말마다 고유한 텍스처 키 생성 (참가자 이름과 색상 기반)
          // 색상 정보를 포함하여 같은 이름이라도 색상이 다르면 다른 텍스처 사용
          const coloredTextureKey = `horse-colored-${name}-${color}`;
          
          // 색상이 적용된 텍스처가 없으면 생성
          if (!this.textures.exists(coloredTextureKey)) {
            this.createColoredHorseTexture('horse-tile-0', coloredTextureKey, color);
          }
          
          horse = this.add.sprite(x, this.startY + 30, coloredTextureKey) as HorseSprite;
          horse.setScale(2);
          // 말을 아래쪽을 향하도록 회전 (90도)
          horse.setRotation(Math.PI / 2);
          // 왼쪽 말이 오른쪽 말보다 위에 보이도록 depth 설정 (인덱스가 작을수록 높은 depth)
          // 결승선(depth 10)보다 위에 보이도록 depth 500 이상으로 설정
          horse.setDepth(500 - index); // 왼쪽 말(인덱스 0)이 가장 높은 depth (500)
        } else {
          // 이미지가 없으면 사각형으로 대체
          console.warn('Horse image not found, using rectangle placeholder');
          horse = this.add.rectangle(x, startY + 30, 60, 40, parseInt(color.replace('#', ''), 16)) as unknown as HorseSprite;
          horse.setDepth(500 - index); // 사각형도 동일한 depth 적용
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
        nameText.setDepth(500 - index + 0.1); // 말보다 약간 위에

        // 애니메이션 생성 (색상이 적용된 텍스처 사용, 참가자 이름과 색상 기반)
        const animKey = `horse-run-${name}-${color}`;
        const coloredTextureKey = `horse-colored-${name}-${color}`;
        
        if (!this.anims.exists(animKey) && this.textures.exists('horse-tile-0')) {
          // 각 프레임에 대해 색상이 적용된 텍스처 생성
          const frameObjects: Phaser.Types.Animations.AnimationFrame[] = [];
          for (let i = 0; i < 12; i++) {
            const sourceKey = `horse-tile-${i}`;
            const coloredFrameKey = `horse-colored-${name}-${color}-frame-${i}`;
            
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
              frameRate: 60,
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
        horse.burning = false;

        return horse;
      });

      // 경주 시작 전에는 애니메이션을 재생하지 않음 (정지 상태)
      // startRace()에서 애니메이션을 시작함
      
      // 카메라를 출발선 위치로 초기화 (경주 시작 전에도 트랙이 보이도록)
      // 화면 상단에 출발선이 보이도록 설정 (0 이상으로 제한)
      const initialScrollY = Math.max(0, this.startY - 50);
      this.cameras.main.setScroll(0, initialScrollY);
    }

    update(time: number, delta: number) {
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

          const isBurning = Math.random() < 0.01 && this.burningPotentialIndex === horse.index && this.firstLastDistance > 800;
          if (isBurning) {
            horse.burning = true;
          } else {
            horse.burning = false;
          }

          if (horse.burning) {
            horse.targetSpeed = maxSpeed * 2;
          } else {
            horse.targetSpeed = minSpeed + Math.random() * (maxSpeed - minSpeed);
          }
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
          
            // 비선형 매핑으로 속도 차이를 더 강조 (제곱 함수 사용)
            // 빠른 속도일 때 더 큰 timeScale을 적용
            const speedFactor = Math.pow(normalizedSpeed, 0.6); // 0.6 제곱으로 빠른 속도 더 강조

            // timeScale 범위: 최소 0.25 (느릴 때) ~ 최대 0.5 (빠를 때)
            const timeScale = 0.2 + mapRange(speedFactor, 0, 1, 0.05, 0.3);
            
            // Phaser 3에서 애니메이션 속도 조절: sprite.anims.timeScale 사용
            // 이 방법은 스프라이트의 모든 애니메이션에 적용되며, 애니메이션이 재생 중일 때 작동함
            if (horse.anims.isPlaying) {
              if (horse.burning) {
                horse.anims.timeScale = 1.2;
              } else if(isBelowAverage) {
                horse.anims.timeScale = 0.15;
              } else {
                horse.anims.timeScale = timeScale;
              }
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

      const firstHorse = this.horses.reduce((prev, curr) => 
        curr.y > prev.y ? curr : prev
      );
      const lastHorse = this.horses.reduce((prev, curr) => 
        curr.y < prev.y ? curr : prev
      );
      this.firstLastDistance = firstHorse.y - lastHorse.y;
      this.burningPotentialIndex = lastHorse.index;

      // 모든 말이 도착했는지 확인
      const allFinished = this.horses.every(horse => horse.finished);
      if (allFinished && !this.gameFinished && this.horses.length > 0 && !this.finishTimer) {
        // 모든 말이 완주한 후 2초 후에 게임 종료 처리
        this.finishTimer = setTimeout(() => {
          this.gameFinished = true;
          
          // 우승자 및 순위 정보 콜백 호출
          if (this.onRaceComplete && this.winner) {
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
        
        // 경주 시작 시 달리는 애니메이션 시작 (참가자 이름과 색상 기반)
        const animKey = `horse-run-${horse.name}-${horse.color}`;
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

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: gameWidth,
      height: gameHeight,
      parent: container,
      scene: HorseRaceScene,
      pixelArt: true, // 픽셀 아트 모드 활성화 (이미지 선명도 유지)
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
      const scene = game.scene.getScene('HorseRaceScene') as HorseRaceScene;
      if (scene) {
        scene.onRaceComplete = (winner: RaceResult) => {
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
      const scene = gameInstanceRef.current.scene.getScene('HorseRaceScene') as HorseRaceScene;
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
      const scene = gameInstanceRef.current.scene.getScene('HorseRaceScene') as HorseRaceScene;
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

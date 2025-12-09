export interface MoodConfig {
  mood: string;
  color: string;
}

export type ParticleShape = 'sphere' | 'cat' | 'flower' | 'fish' | 'star';

export interface SongData {
  title: string;
  artist: string;
  description: string;
  tempo: number; // BPM
  key: string;
  scale: 'major' | 'minor' | 'diminished' | 'pentatonic';
  visualParams: {
    chaos: number; // 0-1, how erratic particles are
    speed: number; // 0-1, movement speed
    size: number; // 0.1-2, particle size multiplier
    colorPalette: string[]; // hex codes
    shape: ParticleShape; // The target 3D shape
  };
}

export interface HandPosition {
  x: number; // -1 to 1
  y: number; // -1 to 1
  isDetected: boolean;
}
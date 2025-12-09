import { SongData } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private isPlaying: boolean = false;
  private activeNodes: AudioNode[] = []; // Track gain nodes to cancel envelopes if needed

  constructor() {
    // Initialize audio context on user interaction usually, handled in start()
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.5;
    }
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  stop() {
    // Stop all oscillators
    this.oscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) { /* ignore */ }
    });
    
    // Disconnect active nodes (like gains in decay phase) to prevent memory leaks
    this.activeNodes.forEach(node => {
      try {
        node.disconnect();
      } catch(e) { /* ignore */ }
    });
    
    this.oscillators = [];
    this.activeNodes = [];
    this.isPlaying = false;
  }

  /**
   * Generates a soundscape based on the song data provided by Gemini
   */
  play(data: SongData) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    
    this.stop();
    this.isPlaying = true;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const baseFreq = this.noteToFreq(data.key || 'C');
    const chord = this.getChord(baseFreq, data.scale);
    
    // 1. Ambient Pad (Quieter, smoother)
    chord.forEach((freq, index) => {
      if (!this.ctx || !this.masterGain) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Use Sine/Triangle for smoother sound, avoid Sawtooth which is "noisy"
      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      // Very slight detune for richness
      osc.detune.value = (Math.random() - 0.5) * 10;

      // Slow amplitude modulation (breathing effect)
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.1 + (Math.random() * 0.1); 
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.05; // Subtle volume change
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();

      osc.connect(gain);
      gain.connect(this.masterGain);
      
      // Pad Envelope - Slow attack, sustained
      const baseVol = 0.08; // Much lower volume for background
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(baseVol, this.ctx.currentTime + 4);
      
      osc.start();
      this.oscillators.push(osc);
      this.oscillators.push(lfo); 
      this.activeNodes.push(gain, lfoGain);
    });

    // 2. Piano Arpeggiator (The main melody/rhythm)
    // Run consistently regardless of tempo, but speed varies
    this.startPianoArpeggiator(chord, data.tempo);
  }

  // Simulates a piano note using additive synthesis and envelopes
  private playPianoNote(freq: number, time: number, duration: number, volume: number) {
    if (!this.ctx || !this.masterGain) return;

    const harmonics = [1, 2, 3]; // Fundamental + Octave + Fifth
    const weights = [1, 0.4, 0.1]; // Amplitude weights

    harmonics.forEach((h, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine'; // Sine waves are cleaner
      osc.frequency.value = freq * h;
      
      // Slight detune for realism
      if (i > 0) osc.detune.value = Math.random() * 5;

      osc.connect(gain);
      gain.connect(this.masterGain);

      // Percussive Envelope
      const attack = 0.01;
      const decay = 1.0; 
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(volume * weights[i], time + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, time + attack + decay);

      osc.start(time);
      osc.stop(time + attack + decay + 0.1);

      // Cleanup isn't strictly necessary for fire-and-forget notes in this simple engine, 
      // but ideally we'd track them.
    });
  }

  private startPianoArpeggiator(chord: number[], tempo: number) {
    if (!this.ctx || !this.masterGain) return;
    
    const interval = 60 / tempo; // Seconds per beat
    // Faster notes (e.g., eighth notes) if slow tempo, to keep it interesting
    const noteTime = tempo < 80 ? interval / 2 : interval; 
    
    let nextNoteTime = this.ctx.currentTime + 0.5;
    let noteIndex = 0;

    const scheduler = () => {
      if (!this.isPlaying || !this.ctx) return;

      // Schedule notes slightly ahead
      while (nextNoteTime < this.ctx.currentTime + 0.1) {
        // Randomize octave for variety (Base or +1 Octave)
        const octaveMult = Math.random() > 0.7 ? 2 : 1;
        const freq = chord[noteIndex % chord.length] * octaveMult;
        
        // Emphasize the first beat
        const velocity = (noteIndex % 4 === 0) ? 0.4 : 0.2;

        this.playPianoNote(freq, nextNoteTime, noteTime, velocity);

        // Simple pattern logic: Up and random
        if (Math.random() > 0.3) {
            noteIndex++;
        } else {
            noteIndex = Math.floor(Math.random() * chord.length);
        }
        
        nextNoteTime += noteTime;
      }
      
      requestAnimationFrame(scheduler);
    };

    scheduler();
  }

  private noteToFreq(note: string): number {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const index = notes.indexOf(note.toUpperCase().replace('M', '').replace('B', '#')); // Normalize
    const cleanIndex = index === -1 ? 0 : index;
    // Base Octave 4 (Middle C area)
    return 261.63 * Math.pow(2, cleanIndex / 12);
  }

  private getChord(baseFreq: number, scale: string): number[] {
    const root = 1;
    let third = 1.2599; // Major 3rd
    let fifth = 1.4983; // Perfect 5th
    let seventh = 1.8877; // Major 7th
    let ninth = 2.2449; // Major 9th

    if (scale.includes('minor')) {
      third = 1.1892; // Minor 3rd
    } else if (scale.includes('diminished')) {
      third = 1.1892;
      fifth = 1.4142;
    } else if (scale.includes('pentatonic')) {
       // Pentatonic spread
       return [baseFreq, baseFreq * 1.122, baseFreq * 1.2599, baseFreq * 1.4983, baseFreq * 1.6818];
    }

    return [
      baseFreq * root,
      baseFreq * third,
      baseFreq * fifth,
      baseFreq * seventh,
      baseFreq * ninth
    ];
  }
}

export const audioSystem = new AudioEngine();
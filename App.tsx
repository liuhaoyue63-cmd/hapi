import React, { useState, useEffect } from 'react';
import { generateSongFromMood } from './services/geminiService';
import { audioSystem } from './services/audioEngine';
import ParticleScene from './components/ParticleScene';
import HandController from './components/HandController';
import FaceEmotionDetector from './components/FaceEmotionDetector';
import { MoodConfig, SongData, HandPosition } from './types';
import { Mic2, Music, Palette, Play, Square, Loader2, Hand, Camera, ScanFace } from 'lucide-react';

const COLORS = [
  { name: 'Passion Red', hex: '#FF0044' },
  { name: 'Neon Blue', hex: '#0088FF' },
  { name: 'Toxic Green', hex: '#00FF66' },
  { name: 'Royal Gold', hex: '#FFD700' },
  { name: 'Deep Purple', hex: '#9900FF' },
  { name: 'Pure White', hex: '#FFFFFF' },
];

export default function App() {
  const [mood, setMood] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[1].hex);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [showHandTracking, setShowHandTracking] = useState(false);
  const [showFaceTracking, setShowFaceTracking] = useState(false);
  
  const [handPos, setHandPos] = useState<HandPosition>({ x: 0, y: 0, isDetected: false });
  const [detectedEmotion, setDetectedEmotion] = useState<string>('');
  const [songData, setSongData] = useState<SongData | null>(null);

  // Auto-update mood field when emotion is detected
  useEffect(() => {
    if (detectedEmotion && showFaceTracking) {
        setMood(detectedEmotion);
    }
  }, [detectedEmotion, showFaceTracking]);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!mood.trim()) return;

    setLoading(true);
    setIsPlaying(false);
    audioSystem.stop();

    try {
      const data = await generateSongFromMood(mood, selectedColor);
      setSongData(data);
      // Auto play after generation
      setTimeout(() => {
        handlePlay(data);
      }, 500);
    } catch (err) {
      console.error(err);
      alert('Failed to generate song. Please check API Key configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (data: SongData) => {
    if (isPlaying) {
      audioSystem.stop();
      setIsPlaying(false);
    } else {
      audioSystem.play(data);
      setIsPlaying(true);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans text-white select-none">
      
      {/* 3D Background */}
      <ParticleScene songData={songData} handPosition={handPos} />

      {/* Controllers */}
      <HandController 
        enabled={showHandTracking} 
        onHandUpdate={setHandPos} 
      />
      <FaceEmotionDetector
        enabled={showFaceTracking}
        onEmotionDetected={setDetectedEmotion}
      />

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Header */}
        <header className="flex justify-between items-center pointer-events-auto">
          <div className="flex items-center gap-2 glass-panel p-3 rounded-xl">
            <Music className="w-5 h-5 text-cyan-400" />
            <h1 className="font-bold tracking-wider text-sm md:text-base">MOOD.PARTICLE.AI</h1>
          </div>
          
          <div className="flex gap-2">
            <button 
                onClick={() => setShowFaceTracking(!showFaceTracking)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                showFaceTracking ? 'bg-purple-500/80 text-white' : 'glass-panel hover:bg-white/10'
                }`}
            >
                <ScanFace className="w-4 h-4" />
                <span className="hidden md:inline text-sm">
                {showFaceTracking ? 'Face Emotion On' : 'Detect Emotion'}
                </span>
            </button>
            
            <button 
                onClick={() => setShowHandTracking(!showHandTracking)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                showHandTracking ? 'bg-cyan-500/80 text-black' : 'glass-panel hover:bg-white/10'
                }`}
            >
                <Hand className="w-4 h-4" />
                <span className="hidden md:inline text-sm">
                {showHandTracking ? 'Hand Control On' : 'Enable Hand Control'}
                </span>
            </button>
          </div>
        </header>

        {/* Center Song Info (Only when generated) */}
        {songData && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none w-full max-w-2xl px-4">
            <div className={`transition-all duration-1000 ${isPlaying ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}>
              <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2 drop-shadow-lg">
                {songData.title}
              </h2>
              <p className="text-xl text-cyan-300 font-light tracking-[0.2em] mb-4">{songData.artist}</p>
              <div className="inline-block bg-black/40 backdrop-blur-sm px-4 py-1 rounded-full text-xs text-gray-300 border border-white/10 mb-2">
                 Shape: <span className="uppercase text-cyan-400 font-bold">{songData.visualParams.shape}</span>
              </div>
              <p className="text-sm text-gray-400 max-w-lg mx-auto bg-black/40 backdrop-blur-sm p-2 rounded-lg">
                {songData.description}
              </p>
            </div>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="pointer-events-auto flex flex-col md:flex-row items-end gap-4 w-full max-w-4xl mx-auto">
          
          {/* Input Form */}
          <div className="w-full glass-panel p-6 rounded-2xl md:w-2/3 transition-all">
            <form onSubmit={handleGenerate} className="flex flex-col gap-4">
              
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                  <Mic2 className="w-3 h-3" /> Current Emotion
                </label>
                <div className="flex gap-2">
                    <input
                    type="text"
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    placeholder="Describe or Use Face Detection..."
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    {showFaceTracking && detectedEmotion && (
                        <div className="flex items-center justify-center bg-purple-500/20 border border-purple-500/50 rounded-lg px-3 animate-pulse">
                            <span className="text-xs font-bold text-purple-300">DETECTED</span>
                        </div>
                    )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                  <Palette className="w-3 h-3" /> Vibes
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setSelectedColor(c.hex)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex-shrink-0 ${
                        selectedColor === c.hex ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'border-transparent opacity-70'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !mood}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 rounded-lg transition-all flex justify-center items-center gap-2 shadow-lg shadow-cyan-900/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Generating AI Song...
                  </>
                ) : (
                  <>
                    Generate Soundscape
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Player Controls */}
          {songData && (
            <div className="w-full md:w-1/3 glass-panel p-6 rounded-2xl flex flex-col justify-between h-full">
              <div className="space-y-1 mb-4">
                <div className="text-xs text-gray-400">Current Track</div>
                <div className="font-bold truncate">{songData.title}</div>
                <div className="text-xs text-cyan-400">{songData.tempo} BPM • {songData.key} {songData.scale}</div>
              </div>
              
              <button
                onClick={() => handlePlay(songData)}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold text-lg transition-all ${
                  isPlaying 
                    ? 'bg-red-500/80 hover:bg-red-500 text-white' 
                    : 'bg-white text-black hover:bg-gray-200'
                }`}
              >
                {isPlaying ? (
                  <><Square className="w-5 h-5 fill-current" /> Stop</>
                ) : (
                  <><Play className="w-5 h-5 fill-current" /> Play</>
                )}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
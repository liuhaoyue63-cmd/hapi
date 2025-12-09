import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

interface FaceEmotionDetectorProps {
  onEmotionDetected: (emotion: string) => void;
  enabled: boolean;
}

const FaceEmotionDetector: React.FC<FaceEmotionDetectorProps> = ({ onEmotionDetected, enabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string>('Neutral');
  const [blendshapes, setBlendshapes] = useState<any[]>([]);

  useEffect(() => {
    if (!enabled) return;

    let faceLandmarker: FaceLandmarker | null = null;
    let animationFrameId: number;

    const setupLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
        setIsLoaded(true);
        startWebcam();
      } catch (e) {
        console.error("Failed to load FaceLandmarker", e);
      }
    };

    const startWebcam = async () => {
      if (!videoRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', predictWebcam);
      } catch (err) {
        console.error("Camera permission denied", err);
      }
    };

    const predictWebcam = () => {
      if (!faceLandmarker || !videoRef.current) return;
      
      const startTimeMs = performance.now();
      const results = faceLandmarker.detectForVideo(videoRef.current, startTimeMs);

      if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
        const shapes = results.faceBlendshapes[0].categories;
        setBlendshapes(shapes);
        const emotion = classifyEmotion(shapes);
        setCurrentEmotion(emotion);
        onEmotionDetected(emotion);
      }

      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setupLandmarker();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      faceLandmarker?.close();
    };
  }, [enabled]);

  // Simple heuristic classifier based on MediaPipe Blendshapes
  const classifyEmotion = (shapes: any[]) => {
    const getScore = (name: string) => shapes.find(s => s.categoryName === name)?.score || 0;

    const smile = (getScore('mouthSmileLeft') + getScore('mouthSmileRight')) / 2;
    const frown = (getScore('mouthFrownLeft') + getScore('mouthFrownRight')) / 2;
    const browDown = (getScore('browDownLeft') + getScore('browDownRight')) / 2;
    const browUp = (getScore('browInnerUp') + getScore('browOuterUpLeft') + getScore('browOuterUpRight')) / 3;
    const jawOpen = getScore('jawOpen');

    if (smile > 0.5) return 'Happy';
    if (browDown > 0.5) return 'Angry'; // Map to Flower
    if (frown > 0.4 || (browUp > 0.4 && frown > 0.2)) return 'Sad'; // Map to Cat
    if (jawOpen > 0.3 || (browUp > 0.3 && smile < 0.2)) return 'Anxious'; // Map Surprise/Neutral-Active to Anxious (Fish)
    
    return 'Neutral';
  };

  return (
    <div className="fixed top-4 right-4 z-40 pointer-events-none flex flex-col items-end gap-2">
      <div className={`transition-opacity duration-500 ${enabled ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-black/60 backdrop-blur border border-white/20 p-2 rounded-lg text-right">
             <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Detected Emotion</div>
             <div className="text-xl font-bold text-cyan-400">{currentEmotion}</div>
        </div>
      </div>
      
      <video 
        ref={videoRef} 
        className={`w-32 h-24 rounded-lg border border-white/20 object-cover ${enabled ? 'opacity-50' : 'hidden'}`}
        autoPlay 
        playsInline
        muted
      />
    </div>
  );
};

export default FaceEmotionDetector;
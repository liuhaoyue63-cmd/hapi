import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandPosition } from '../types';

interface HandControllerProps {
  onHandUpdate: (pos: HandPosition) => void;
  enabled: boolean;
}

const HandController: React.FC<HandControllerProps> = ({ onHandUpdate, enabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        setIsLoaded(true);
        startWebcam();
      } catch (e) {
        console.error("Failed to load MediaPipe", e);
        setError("AI Vision failed to load.");
      }
    };

    const startWebcam = async () => {
      if (!videoRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', predictWebcam);
      } catch (err) {
        setError("Camera permission denied.");
      }
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current) return;
      
      const nowInMs = Date.now();
      const results = handLandmarker.detectForVideo(videoRef.current, nowInMs);

      if (results.landmarks && results.landmarks.length > 0) {
        // Get index finger tip (landmark 8)
        const hand = results.landmarks[0];
        const indexTip = hand[8];
        
        // Map 0-1 video coordinates to -1 to 1 scene coordinates (inverted X for mirror effect)
        onHandUpdate({
          x: (1 - indexTip.x) * 2 - 1,
          y: -(indexTip.y * 2 - 1), // Invert Y because screen coords are top-down
          isDetected: true
        });
      } else {
        onHandUpdate({ x: 0, y: 0, isDetected: false });
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
      handLandmarker?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
       {/* Hidden video element for processing */}
      <video 
        ref={videoRef} 
        className={`w-32 h-24 rounded-lg border border-white/20 object-cover ${enabled ? 'opacity-50' : 'hidden'}`}
        autoPlay 
        playsInline
        muted
      />
      {enabled && !isLoaded && !error && <div className="text-xs text-white bg-black/50 p-1">Loading Hand AI...</div>}
      {error && <div className="text-xs text-red-400 bg-black/50 p-1">{error}</div>}
    </div>
  );
};

export default HandController;

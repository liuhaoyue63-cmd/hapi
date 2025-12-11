import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { SongData, HandPosition, ParticleShape } from '../types';
import { audioSystem } from '../services/audioEngine';

// Generic noise function replacement
const simpleNoise = (x: number, y: number, z: number) => {
  return Math.sin(x) * Math.cos(y) * Math.sin(z);
};

interface ParticlesProps {
  songData: SongData | null;
  handPosition: HandPosition;
}

// Helper to get target position based on shape type
const getTargetPosition = (i: number, count: number, shape: ParticleShape) => {
  const p = new THREE.Vector3();
  const ratio = i / count;
  const phi = Math.acos(-1 + (2 * i) / count);
  const theta = Math.sqrt(count * Math.PI) * phi;

  switch (shape) {
    case 'cat':
      if (ratio < 0.35) {
        // Head
        const r = 3;
        p.setFromSphericalCoords(r, phi * 2, theta);
        p.y += 3.5;
      } else if (ratio < 0.85) {
        // Body
        const r = 4.5;
        p.setFromSphericalCoords(r, phi, theta);
        p.y -= 2.5;
      } else if (ratio < 0.92) {
        // Left Ear
        p.set(-2 + Math.random(), 6 + Math.random() * 2, Math.random());
      } else {
        // Right Ear
        p.set(2 + Math.random(), 6 + Math.random() * 2, Math.random());
      }
      break;

    case 'flower':
      // Parametric Flower
      const petalCount = 6;
      const flowerR = 8 * Math.abs(Math.cos(petalCount * 0.5 * theta));
      // Spread out in a disk with some volume
      const r = Math.random() * flowerR + 2; 
      // Add depth variation
      const z = Math.sin(r) * 2;
      p.x = r * Math.cos(theta);
      p.y = r * Math.sin(theta);
      p.z = z + (Math.random() - 0.5) * 2;
      break;

    case 'fish':
      // Fish Shape (Ellipsoid with tail)
      const fishL = (ratio - 0.5) * 15; // Length along X
      // Simple fish profile curve
      const width = Math.cos(fishL * 0.2) * 4; 
      const height = Math.cos(fishL * 0.2) * 5; 
      
      if (Math.abs(fishL) < 7) {
        // Body
        const angle = Math.random() * Math.PI * 2;
        const rad = Math.random();
        p.x = fishL;
        p.y = Math.cos(angle) * height * rad;
        p.z = Math.sin(angle) * width * rad;
      } else {
        // Tail
        p.x = fishL - 2;
        p.y = (Math.random() - 0.5) * 8;
        p.z = (Math.random() - 0.5) * 2;
      }
      break;

    case 'star':
      // Burst / Star shape
      const starR = Math.pow(Math.random(), 0.3) * 12; // Cluster at center, shoot out
      p.setFromSphericalCoords(starR, phi, theta);
      // Spike effect
      if (i % 20 === 0) p.multiplyScalar(1.5);
      break;

    case 'sphere':
    default:
      const sphereR = 10;
      p.setFromSphericalCoords(sphereR, phi, theta);
      break;
  }
  return p;
};

const Particles: React.FC<ParticlesProps> = ({ songData, handPosition }) => {
  // REDUCED COUNT FOR PERFORMANCE
  const count = 1500;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const handLightRef = useRef<THREE.PointLight>(null);
  const prevHandPos = useRef<{x: number, y: number} | null>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Store particle state
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push({ 
          t: Math.random() * 100, 
          x: (Math.random() - 0.5) * 50, 
          y: (Math.random() - 0.5) * 50, 
          z: (Math.random() - 0.5) * 50, 
          // Base/Home positions (will morph)
          baseX: (Math.random() - 0.5) * 20, 
          baseY: (Math.random() - 0.5) * 20, 
          baseZ: (Math.random() - 0.5) * 20,
          vx: 0, vy: 0, vz: 0
      });
    }
    return temp;
  }, []);

  const colorArray = useMemo(() => new Float32Array(count * 3), [count]);

  // Update colors when palette changes
  useEffect(() => {
    if (!songData || !mesh.current) return;
    const colors = songData.visualParams.colorPalette.map(c => new THREE.Color(c));
    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      // BOOST COLOR BRIGHTNESS
      color.multiplyScalar(1.5); 
      color.toArray(colorArray, i * 3);
    }
    mesh.current.geometry.attributes.color.needsUpdate = true;
  }, [songData, colorArray, count]);

  useFrame((state) => {
    if (!mesh.current || !songData) return;

    const freqData = audioSystem.getFrequencyData();
    const bass = freqData.slice(0, 10).reduce((a, b) => a + b, 0) / 10 / 255;
    const treble = freqData.slice(100, 150).reduce((a, b) => a + b, 0) / 50 / 255;

    const { speed, chaos, size, shape } = songData.visualParams;
    const time = state.clock.getElapsedTime();

    const handX = handPosition.x * 30;
    const handY = handPosition.y * 20;
    const isHandActive = handPosition.isDetected;

    // Calculate Hand Velocity
    let handVx = 0;
    let handVy = 0;
    if (isHandActive && prevHandPos.current) {
        handVx = (handX - prevHandPos.current.x) * 5; // Multiplier for sensitivity
        handVy = (handY - prevHandPos.current.y) * 5;
    }
    prevHandPos.current = isHandActive ? { x: handX, y: handY } : null;

    if (handLightRef.current) {
        handLightRef.current.position.set(handX, handY, 5);
        handLightRef.current.intensity = isHandActive ? 2 : 0;
    }

    // Morph Logic: Update Base Positions slowly towards target shape
    particles.forEach((particle, i) => {
        // Calculate where this particle *should* be for the current shape
        const target = getTargetPosition(i, count, shape);
        
        // Lerp base position for smooth morphing
        particle.baseX += (target.x - particle.baseX) * 0.03;
        particle.baseY += (target.y - particle.baseY) * 0.03;
        particle.baseZ += (target.z - particle.baseZ) * 0.03;

        // --- Physics & Noise ---
        
        // 1. Ambient Noise (Breathing)
        particle.t += speed * (0.005 + bass * 0.05);
        
        // Vary noise intensity based on shape
        let noiseScale = chaos;
        if (shape === 'cat') noiseScale *= 0.5; 
        if (shape === 'fish') noiseScale *= 1.5;

        const noiseX = simpleNoise(particle.t, particle.baseZ * 0.1, particle.baseX * 0.1) * noiseScale * 5;
        const noiseY = simpleNoise(particle.baseY * 0.1, particle.t, particle.baseZ * 0.1) * noiseScale * 5;
        const noiseZ = simpleNoise(particle.baseZ * 0.1, particle.baseX * 0.1, particle.t) * noiseScale * 5;

        const currentTargetX = particle.baseX + noiseX;
        const currentTargetY = particle.baseY + noiseY;
        const currentTargetZ = particle.baseZ + noiseZ;

        // 2. Hand Interaction (COMPLEX FLUIDITY)
        if (isHandActive) {
            const dx = particle.x - handX;
            const dy = particle.y - handY;
            const dz = particle.z - 0;
            const distSq = dx*dx + dy*dy + dz*dz;
            const dist = Math.sqrt(distSq);
            
            // Interaction Radius
            const radius = 25;

            if (dist < radius) {
                const influence = (1 - dist / radius);
                const power = influence * influence;

                // A. DRAG / INERTIA (Particles follow hand movement)
                particle.vx += handVx * influence * 0.2;
                particle.vy += handVy * influence * 0.2;

                // B. SHAPE-SPECIFIC INTERACTION
                if (shape === 'cat' && dist < 8) {
                     // Sparkles on touch
                     particle.vx += (Math.random() - 0.5) * power;
                     particle.vy += (Math.random() - 0.5) * power;
                     // Gentle pull
                     particle.vx -= dx * 0.05 * power;
                     particle.vy -= dy * 0.05 * power;
                } else if (shape === 'flower') {
                    // Wind effect
                    particle.vx += dx * 0.1 * power;
                    particle.vy += dy * 0.1 * power;
                    particle.vz += Math.sin(time * 5 + dist) * 0.1 * power;
                } else {
                    // C. COMPLEX VORTEX (Default)
                    // Tangential Force (Spin)
                    particle.vx += (-dy * 0.05 * power); 
                    particle.vy += (dx * 0.05 * power);
                    
                    // Centripetal Force (Attract) - slightly weaker now to allow drag to work
                    particle.vx -= (dx * 0.02 * power);
                    particle.vy -= (dy * 0.02 * power);
                    particle.vz -= (dz * 0.02 * power);

                    // Random Jitter (Sparkle effect)
                    if (Math.random() > 0.9) {
                        particle.vx += (Math.random() - 0.5) * 0.5 * power;
                        particle.vy += (Math.random() - 0.5) * 0.5 * power;
                        particle.vz += (Math.random() - 0.5) * 0.5 * power;
                    }
                }
            }
        }

        // Physics Integration
        particle.vx *= 0.94; // Less friction for more fluid feel
        particle.vy *= 0.94;
        particle.vz *= 0.94;

        const springStrength = isHandActive ? 0.005 : 0.05; // Looser spring when hand is active
        particle.vx += (currentTargetX - particle.x) * springStrength;
        particle.vy += (currentTargetY - particle.y) * springStrength;
        particle.vz += (currentTargetZ - particle.z) * springStrength;

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.z += particle.vz;

        // Update Instance Matrix
        dummy.position.set(particle.x, particle.y, particle.z);
        
        // Audio Reactive Scale
        const sFactor = (Math.sin(particle.t * 10) + 1) * 0.5; 
        const audioScale = 1 + (bass * 3) + (treble * sFactor * 2);
        const finalScale = size * audioScale * 0.2;
        
        dummy.scale.set(finalScale, finalScale, finalScale);
        
        // Dynamic Rotation
        dummy.rotation.x += particle.vy * 0.2;
        dummy.rotation.y += particle.vx * 0.2;
        
        dummy.updateMatrix();
        mesh.current!.setMatrixAt(i, dummy.matrix);
    });

    mesh.current.instanceMatrix.needsUpdate = true;
    
    // Rotate light
    if (lightRef.current) {
        lightRef.current.position.x = Math.sin(time * 0.5) * 15;
        lightRef.current.position.y = Math.cos(time * 0.3) * 15;
    }
  });

  return (
    <>
      <pointLight ref={lightRef} distance={50} intensity={2} color="white" />
      <pointLight ref={handLightRef} distance={15} intensity={0} color="#00ffff" />
      
      {/* Visual Cursor for Hand */}
      {handPosition.isDetected && (
          <mesh position={[handPosition.x * 30, handPosition.y * 20, 0]}>
              <sphereGeometry args={[0.3, 16, 16]} />
              <meshBasicMaterial color="#00ffff" transparent opacity={0.4} />
          </mesh>
      )}

      <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
        <dodecahedronGeometry args={[0.2, 0]}>
          <instancedBufferAttribute attach="attributes-color" args={[colorArray, 3]} />
        </dodecahedronGeometry>
        {/* ENHANCED MATERIAL FOR VIBRANCY */}
        <meshStandardMaterial 
          vertexColors 
          transparent 
          opacity={1} 
          roughness={0} 
          metalness={1}
          emissive="#222222" // Add base glow
          emissiveIntensity={0.5}
          blending={THREE.AdditiveBlending}
          toneMapped={false} // CRITICAL FOR NEON COLORS
        />
      </instancedMesh>
    </>
  );
};

const ParticleScene: React.FC<ParticlesProps> = ({ songData, handPosition }) => {
  return (
    <div className="absolute inset-0 z-0 bg-black">
      <Canvas camera={{ position: [0, 0, 35], fov: 60 }} gl={{ antialias: false, powerPreference: "high-performance" }}>
        <color attach="background" args={['#020202']} />
        <ambientLight intensity={0.2} />
        <Environment preset="night" />
        <Particles songData={songData} handPosition={handPosition} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.2} />
      </Canvas>
    </div>
  );
};

export default ParticleScene;
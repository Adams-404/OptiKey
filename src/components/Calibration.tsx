import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { gazeTracker } from '../services/GazeTrackerService';

interface Props {
  onComplete: () => void;
}

export default function Calibration({ onComplete }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const [progress, setProgress] = useState(0);

  // 3x3 Grid
  const points = [
    { x: '10%', y: '10%' },
    { x: '50%', y: '10%' },
    { x: '90%', y: '10%' },
    { x: '10%', y: '50%' },
    { x: '50%', y: '50%' },
    { x: '90%', y: '50%' },
    { x: '10%', y: '90%' },
    { x: '50%', y: '90%' },
    { x: '90%', y: '90%' },
  ];

  useEffect(() => {
    // Reset calibration on start
    gazeTracker.calibrationData = [];
  }, []);

  const startCalibrationPoint = () => {
    if (calibrating) return;
    setCalibrating(true);
    setProgress(0);
    
    const pointFeatures: number[][] = [];
    const CALIBRATION_TIME = 1500; // 1.5s
    const START_TIME = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - START_TIME;
      setProgress((elapsed / CALIBRATION_TIME) * 100);

      const features = gazeTracker.getCurrentFeatures();
      if (features) {
        pointFeatures.push(features);
      }

      if (elapsed >= CALIBRATION_TIME) {
        clearInterval(interval);
        finishPoint(pointFeatures);
      }
    }, 50); // Sample every 50ms
  };

  const finishPoint = (features: number[][]) => {
    const pt = points[currentIdx];
    // Convert % to pixels roughly based on window size
    const screenX = (parseFloat(pt.x) / 100) * window.innerWidth;
    const screenY = (parseFloat(pt.y) / 100) * window.innerHeight;

    gazeTracker.calibrationData.push({
      screenPos: { x: screenX, y: screenY },
      features
    });

    setCalibrating(false);
    setProgress(0);

    if (currentIdx < points.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      onComplete();
    }
  };

  const currPt = points[currentIdx];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-white overflow-hidden">
      <div className="absolute top-10 text-center z-50">
        <h1 className="text-2xl font-bold mb-2">Calibration</h1>
        <p className="text-slate-400">
          Look at the glowing dot and click it, then keep staring until it moves.
        </p>
      </div>

      <div className="relative w-full h-full pointer-events-none z-50">
        <motion.button
          onClick={startCalibrationPoint}
          className="absolute w-12 h-12 rounded-full border-4 border-[#00d2ff] bg-[#00d2ff]/20 shadow-[0_0_20px_rgba(0,210,255,0.6)] pointer-events-auto cursor-pointer focus:outline-none flex items-center justify-center"
          style={{
            left: `calc(${currPt.x} - 24px)`,
            top: `calc(${currPt.y} - 24px)`,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring' }}
        >
          {calibrating && (
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="rgba(0,210,255,0.2)"
                strokeWidth="4"
              />
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="rgba(0,210,255,1)"
                strokeWidth="4"
                strokeDasharray={`${(progress / 100) * 113} 113`}
              />
            </svg>
          )}
        </motion.button>
      </div>
      
      <div className="absolute bottom-10 px-4 py-2 bg-slate-800 rounded-full text-sm z-50">
        Point {currentIdx + 1} of 9
      </div>
    </div>
  );
}

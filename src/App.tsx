import React, { useEffect, useRef, useState } from 'react';
import Calibration from './components/Calibration';
import Keyboard from './components/Keyboard';
import { gazeTracker, Point } from './services/GazeTrackerService';
import { Eye, Settings } from 'lucide-react';
import { cn } from './components/Keyboard';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'calibration' | 'keyboard'>('calibration');
  const [gazePoint, setGazePoint] = useState<Point>({ x: -1, y: -1 });
  const [trackerStatus, setTrackerStatus] = useState<string>('Initializing');
  const [showDot, setShowDot] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      // Start tracker
      gazeTracker.start(videoRef.current, (point) => {
        setGazePoint(point);
        if (point.x === -1 && gazeTracker.calibrationData.length > 0) {
          setTrackerStatus('Lost face');
        } else {
          setTrackerStatus('Tracking');
        }
      });
      setTrackerStatus('Waiting for camera...');
    }
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      gazeTracker.setCanvas(canvasRef.current);
    }
  }, [canvasRef]);

  return (
    <div className="flex flex-col w-full h-screen bg-[#050505] font-sans text-white overflow-hidden relative selection:bg-[#00d2ff]/30">
      
      {/* Hidden Video for processing */}
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />

      {/* Camera Feed */}
      <div className={cn(
        "transition-all duration-700 ease-in-out border border-[#00d2ff]/30 overflow-hidden bg-black flex items-center justify-center z-[40] shadow-[0_0_20px_rgba(0,210,255,0.2)]",
        mode === 'calibration' 
          ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[360px] rounded-2xl opacity-60 pointer-events-none" 
          : "absolute top-4 left-8 w-[120px] h-[90px] rounded-lg mt-1 z-50 pointer-events-auto"
      )}>
        <canvas ref={canvasRef} width={640} height={480} className="w-full h-full object-cover" />
      </div>

      <header className="h-20 border-b border-white/10 flex items-center px-8 bg-zinc-950/50 backdrop-blur-md shrink-0 z-50">
        <div className="w-[120px] shrink-0 mr-6" /> {/* Placeholder for Camera */}
        
        <div className="flex flex-col flex-grow">
          <h1 className="text-lg font-semibold tracking-tight">OptiKey <span className="text-[#00d2ff]">v2.0</span></h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${trackerStatus === 'Tracking' ? 'bg-green-500' : trackerStatus === 'Waiting for camera...' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500 animate-pulse'}`}></div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold shrink-0">{trackerStatus}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] px-2 py-1 rounded bg-[#00d2ff]/10 text-[#00d2ff] border border-[#00d2ff]/20 relative cursor-pointer hover:bg-[#00d2ff]/20 transition-colors" onClick={() => setShowDot(d => !d)}>
            {showDot ? 'Gaze On' : 'Gaze Off'}
          </div>
          <button 
            onClick={() => setMode('calibration')}
            className="px-4 py-2 border border-white/10 rounded text-xs hover:bg-white/5 transition-colors cursor-pointer text-white/80 uppercase font-semibold tracking-wider"
          >
            Recalibrate
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col relative overflow-hidden z-30">
        {mode === 'calibration' ? (
          <Calibration onComplete={() => setMode('keyboard')} />
        ) : (
          <Keyboard gazePoint={gazePoint} />
        )}
      </main>

      <footer className="h-10 shrink-0 px-8 border-t border-white/5 bg-black flex items-center justify-between text-[10px] text-zinc-600 font-bold uppercase tracking-widest z-50">
        <div>Dwell Time: 700ms</div>
        <div>Smoothing: Rolling Avg (5f)</div>
        <div>Hardware: Webcam Generic 1080p</div>
      </footer>

      {/* Gaze Visualizer Dot */}
      {showDot && gazePoint.x > 0 && gazePoint.y > 0 && mode === 'keyboard' && (
        <div 
          className="fixed w-[14px] h-[14px] rounded-full bg-[#ff4444] border-2 border-white pointer-events-none z-[100] transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(255,68,68,0.6)] transition-all duration-75 ease-out"
          style={{ left: gazePoint.x, top: gazePoint.y }}
        />
      )}

    </div>
  );
}

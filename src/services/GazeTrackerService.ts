export interface Point {
  x: number;
  y: number;
}

export interface CalibrationPoint {
  screenPos: Point;
  features: number[][]; // Multiple frames
}

export interface FeatureVector {
  features: number[];
}

export type GazeListener = (point: Point, isBlinking: boolean) => void;

class GazeTrackerService {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private faceMesh: any = null;
  private camera: any = null;
  private isRunning: boolean = false;
  private onGaze: GazeListener | null = null;
  
  public calibrationData: CalibrationPoint[] = [];

  public setCanvas(canvas: HTMLCanvasElement | null) {
    this.canvasElement = canvas;
  }
  
  // Smoothing
  private gazeHistory: Point[] = [];
  private readonly historySize = 5;

  private onResults(results: any) {
    if (this.canvasElement) {
      const ctx = this.canvasElement.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        // Draw video (flipped horizontally)
        ctx.translate(this.canvasElement.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const landmarks = results.multiFaceLandmarks[0];
          
          // Draw face mesh
          ctx.fillStyle = 'rgba(0, 210, 255, 0.4)';
          for (let i = 0; i < landmarks.length; i++) {
            const point = landmarks[i];
            ctx.beginPath();
            ctx.arc(point.x * this.canvasElement.width, point.y * this.canvasElement.height, 1, 0, 2 * Math.PI);
            ctx.fill();
          }

          // Draw Iris (left and right) brightly
          ctx.fillStyle = '#ff4444';
          const leftIris = landmarks[468];
          const rightIris = landmarks[473];
          if (leftIris) {
            ctx.beginPath();
            ctx.arc(leftIris.x * this.canvasElement.width, leftIris.y * this.canvasElement.height, 3, 0, 2 * Math.PI);
            ctx.fill();
          }
          if (rightIris) {
            ctx.beginPath();
            ctx.arc(rightIris.x * this.canvasElement.width, rightIris.y * this.canvasElement.height, 3, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      if (this.onGaze) {
        this.onGaze({ x: -1, y: -1 }, false);
      }
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];
    const leftIris = landmarks[468]; // left eye center
    const rightIris = landmarks[473]; // right eye center
    const nose = landmarks[1]; // nose tip

    if (!leftIris || !rightIris || !nose) {
      return;
    }

    // Distance between eyes to normalize
    const dx = rightIris.x - leftIris.x;
    const dy = rightIris.y - leftIris.y;
    const eyeDist = Math.sqrt(dx * dx + dy * dy);

    if (eyeDist === 0) return;

    const featureVector = [
      (leftIris.x - nose.x) / eyeDist,
      (leftIris.y - nose.y) / eyeDist,
      (rightIris.x - nose.x) / eyeDist,
      (rightIris.y - nose.y) / eyeDist
    ];

    if (this.calibrationData.length > 0) {
      const estimatedPoint = this.estimateScreenPosition(featureVector);
      
      // Smooth out
      this.gazeHistory.push(estimatedPoint);
      if (this.gazeHistory.length > this.historySize) {
        this.gazeHistory.shift();
      }

      let avgX = 0;
      let avgY = 0;
      for (const p of this.gazeHistory) {
        avgX += p.x;
        avgY += p.y;
      }
      avgX /= this.gazeHistory.length;
      avgY /= this.gazeHistory.length;

      if (this.onGaze) {
        this.onGaze({ x: avgX, y: avgY }, false);
      }
    } else {
      // If not calibrated, just return the raw feature vector roughly scaled or emit an event
      // We pass the raw feature vector in "x" to be collected by the calibration screen.
      // Kinda hacky but works for now.
      if (this.onGaze) {
        this.onGaze({ x: -1, y: -1 }, false); 
        // We will expose a method to get current features
      }
    }
  }

  public getCurrentFeatures(): number[] | null {
    if (!this.lastLandmarks) return null;
    const landmarks = this.lastLandmarks;
    const leftIris = landmarks[468]; 
    const rightIris = landmarks[473]; 
    const nose = landmarks[1]; 

    if (!leftIris || !rightIris || !nose) {
      return null;
    }

    const dx = rightIris.x - leftIris.x;
    const dy = rightIris.y - leftIris.y;
    const eyeDist = Math.sqrt(dx * dx + dy * dy);

    if (eyeDist === 0) return null;

    return [
      (leftIris.x - nose.x) / eyeDist,
      (leftIris.y - nose.y) / eyeDist,
      (rightIris.x - nose.x) / eyeDist,
      (rightIris.y - nose.y) / eyeDist
    ];
  }

  private lastLandmarks: any = null;

  public async start(videoEL: HTMLVideoElement, onGaze: GazeListener) {
    this.videoElement = videoEL;
    this.onGaze = onGaze;
    this.isRunning = true;

    if (!this.faceMesh) {
      const fm = new (window as any).FaceMesh({locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }});
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      fm.onResults((results: any) => {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
           this.lastLandmarks = results.multiFaceLandmarks[0];
        } else {
           this.lastLandmarks = null;
        }
        this.onResults(results);
      });
      this.faceMesh = fm;
    }

    if (!this.camera) {
      const cam = new (window as any).Camera(this.videoElement, {
        onFrame: async () => {
          if (this.isRunning && this.videoElement) {
            await this.faceMesh.send({image: this.videoElement});
          }
        },
        width: 640,
        height: 480
      });
      this.camera = cam;
      cam.start();
    } else {
      this.camera.start();
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.camera) {
      this.camera.stop();
    }
  }

  // IDW interpolation
  private estimateScreenPosition(f: number[]): Point {
    let sumWeight = 0;
    let sumX = 0;
    let sumY = 0;

    for (const cp of this.calibrationData) {
      // find average feature for this cp
      if (cp.features.length === 0) continue;
      
      const avgF = [0,0,0,0];
      for (const feat of cp.features) {
        for (let i = 0; i < 4; i++) avgF[i] += feat[i];
      }
      for (let i = 0; i < 4; i++) avgF[i] /= cp.features.length;

      // Distance
      let distSq = 0;
      for (let i = 0; i < 4; i++) {
        distSq += Math.pow(f[i] - avgF[i], 2);
      }
      
      const weight = 1.0 / (distSq + 0.000001);
      sumWeight += weight;
      sumX += cp.screenPos.x * weight;
      sumY += cp.screenPos.y * weight;
    }

    return {
      x: sumX / sumWeight,
      y: sumY / sumWeight
    };
  }
}

export const gazeTracker = new GazeTrackerService();

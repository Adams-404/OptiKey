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

class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private lastValue: number | null = null;
  private lastDerivative: number | null = null;
  private lastTime: number | null = null;

  constructor(minCutoff = 0.15, beta = 0.02, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  public updateParams(minCutoff: number, beta: number) {
    this.minCutoff = minCutoff;
    this.beta = beta;
  }

  public filter(value: number, timestamp: number): number {
    if (this.lastValue === null || this.lastTime === null) {
      this.lastValue = value;
      this.lastTime = timestamp;
      this.lastDerivative = 0;
      return value;
    }

    const dt = (timestamp - this.lastTime) / 1000.0;
    if (dt <= 0) return this.lastValue;

    // Calculate derivative (speed)
    const derivative = (value - this.lastValue) / dt;
    
    // Filter derivative
    const alphaD = 1.0 / (1.0 + this.dCutoff / (2 * Math.PI * dt));
    const filteredDerivative = alphaD * derivative + (1 - alphaD) * (this.lastDerivative || 0);

    // Calculate adaptive cutoff frequency based on speed
    const cutoff = this.minCutoff + this.beta * Math.abs(filteredDerivative);
    
    // Filter value
    const alpha = 1.0 / (1.0 + cutoff / (2 * Math.PI * dt));
    const filteredValue = alpha * value + (1 - alpha) * this.lastValue;

    this.lastValue = filteredValue;
    this.lastDerivative = filteredDerivative;
    this.lastTime = timestamp;

    return filteredValue;
  }

  public reset() {
    this.lastValue = null;
    this.lastDerivative = null;
    this.lastTime = null;
  }
}

class GazeTrackerService {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private faceMesh: any = null;
  private camera: any = null;
  private isRunning: boolean = false;
  private onGaze: GazeListener | null = null;
  
  public calibrationData: CalibrationPoint[] = [];
  public trackingMode: 'eye' | 'head' | 'hybrid' = 'head';
  public smoothing: number = 8;

  private xFilter = new OneEuroFilter();
  private yFilter = new OneEuroFilter();

  public setCanvas(canvas: HTMLCanvasElement | null) {
    this.canvasElement = canvas;
  }
  
  private updateFilterParams() {
    // Map smoothing (4 - 15) to minCutoff and beta
    // Raw (4): minCutoff = 0.45, beta = 0.04
    // Balanced (8): minCutoff = 0.15, beta = 0.015
    // Ultra Stable (15): minCutoff = 0.03, beta = 0.003
    let minCutoff = 0.15;
    let beta = 0.015;

    if (this.smoothing <= 4) {
      minCutoff = 0.45;
      beta = 0.04;
    } else if (this.smoothing >= 15) {
      minCutoff = 0.03;
      beta = 0.003;
    } else {
      // Linear interpolation between raw (4) and stable (15) for smooth transition
      const t = (this.smoothing - 4) / 11; // 0 to 1
      minCutoff = 0.45 - t * (0.45 - 0.03); 
      beta = 0.04 - t * (0.04 - 0.003); 
    }

    this.xFilter.updateParams(minCutoff, beta);
    this.yFilter.updateParams(minCutoff, beta);
  }

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

          // Highlight Nose for head tracking
          const nose = landmarks[1];
          if (nose) {
            ctx.fillStyle = '#00ffaa';
            ctx.beginPath();
            ctx.arc(nose.x * this.canvasElement.width, nose.y * this.canvasElement.height, 5, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      this.xFilter.reset();
      this.yFilter.reset();
      if (this.onGaze) {
        this.onGaze({ x: -1, y: -1 }, false);
      }
      return;
    }

    const featureVector = this.getCurrentFeatures();
    if (!featureVector) return;

    if (this.calibrationData.length > 0) {
      const estimatedPoint = this.estimateScreenPosition(featureVector);
      
      // Update filter parameters dynamically
      this.updateFilterParams();

      const now = performance.now();
      const filteredX = this.xFilter.filter(estimatedPoint.x, now);
      const filteredY = this.yFilter.filter(estimatedPoint.y, now);

      if (this.onGaze) {
        this.onGaze({ x: filteredX, y: filteredY }, false);
      }
    } else {
      if (this.onGaze) {
        this.onGaze({ x: -1, y: -1 }, false); 
      }
    }
  }

  public getCurrentFeatures(): number[] | null {
    if (!this.lastLandmarks) return null;
    const landmarks = this.lastLandmarks;
    const leftIris = landmarks[468]; 
    const rightIris = landmarks[473]; 
    const nose = landmarks[1]; 
    const leftOuter = landmarks[33];
    const leftInner = landmarks[133];
    const rightOuter = landmarks[263];
    const rightInner = landmarks[362];
    const chin = landmarks[152];

    if (!leftIris || !rightIris || !nose || !leftOuter || !leftInner || !rightOuter || !rightInner || !chin) {
      return null;
    }

    // Outer eye-to-eye distance for overall face scale scaling
    const dx = rightOuter.x - leftOuter.x;
    const dy = rightOuter.y - leftOuter.y;
    const faceScale = Math.sqrt(dx * dx + dy * dy);
    if (faceScale === 0) return null;

    // --- HIGH-PRECISION EYE FEATURES (Gaze relative to head) ---
    const leftEyeWidth = Math.sqrt(Math.pow(leftOuter.x - leftInner.x, 2) + Math.pow(leftOuter.y - leftInner.y, 2));
    const rightEyeWidth = Math.sqrt(Math.pow(rightOuter.x - rightInner.x, 2) + Math.pow(rightOuter.y - rightInner.y, 2));
    if (leftEyeWidth === 0 || rightEyeWidth === 0) return null;

    const leftEyeMidX = (leftOuter.x + leftInner.x) / 2;
    const leftEyeMidY = (leftOuter.y + leftInner.y) / 2;
    const rightEyeMidX = (rightOuter.x + rightInner.x) / 2;
    const rightEyeMidY = (rightOuter.y + rightInner.y) / 2;

    const eyeFx1 = (leftIris.x - leftEyeMidX) / leftEyeWidth;
    const eyeFy1 = (leftIris.y - leftEyeMidY) / leftEyeWidth;
    const eyeFx2 = (rightIris.x - rightEyeMidX) / rightEyeWidth;
    const eyeFy2 = (rightIris.y - rightEyeMidY) / rightEyeWidth;

    // --- HEAD FEATURES (Rotation invariant to camera distance) ---
    const eyesMidX = (leftOuter.x + rightOuter.x) / 2;
    const eyesMidY = (leftOuter.y + rightOuter.y) / 2;

    const headYaw = (nose.x - eyesMidX) / faceScale;
    const headPitch = (nose.y - eyesMidY) / faceScale;

    // Absolute head translation coordinates (useful fallback for spatial context)
    const headX = nose.x;
    const headY = nose.y;

    // Stable 8-dimensional feature vector
    return [eyeFx1, eyeFy1, eyeFx2, eyeFy2, headYaw, headPitch, headX, headY];
  }

  private lastLandmarks: any = null;

  public async start(videoEL: HTMLVideoElement, onGaze: GazeListener) {
    this.videoElement = videoEL;
    this.onGaze = onGaze;
    this.isRunning = true;
    this.xFilter.reset();
    this.yFilter.reset();

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
    this.xFilter.reset();
    this.yFilter.reset();
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
      if (cp.features.length === 0) continue;
      
      const avgF = new Array(8).fill(0);
      for (const feat of cp.features) {
        for (let i = 0; i < feat.length; i++) {
          avgF[i] += feat[i] || 0;
        }
      }
      for (let i = 0; i < 8; i++) avgF[i] /= cp.features.length;

      let distSq = 0;
      if (this.trackingMode === 'eye') {
        for (let i = 0; i < 4; i++) {
          distSq += Math.pow(f[i] - avgF[i], 2);
        }
      } else if (this.trackingMode === 'head') {
        // High gain for relative head yaw & pitch, standard weight for translation x & y
        distSq += Math.pow(f[4] - avgF[4], 2) * 4.0;
        distSq += Math.pow(f[5] - avgF[5], 2) * 4.0;
        distSq += Math.pow(f[6] - avgF[6], 2) * 0.5;
        distSq += Math.pow(f[7] - avgF[7], 2) * 0.5;
      } else { // hybrid
        for (let i = 0; i < 4; i++) {
          distSq += Math.pow(f[i] - avgF[i], 2) * 0.3;
        }
        distSq += Math.pow(f[4] - avgF[4], 2) * 1.5;
        distSq += Math.pow(f[5] - avgF[5], 2) * 1.5;
        distSq += Math.pow(f[6] - avgF[6], 2) * 0.5;
        distSq += Math.pow(f[7] - avgF[7], 2) * 0.5;
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

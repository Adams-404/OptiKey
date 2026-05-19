<div align="center">
<img width="1200" height="475" alt="OptiKey Pro Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🎯 OptiKey Pro

### *AI-Powered Eye & Head Tracking Assistive Keyboard*

OptiKey Pro is a high-precision, low-latency web application designed to restore communication and digital independence to individuals with severe motor and speech disabilities (e.g., ALS, MS, Cerebral Palsy, paralysis). 

By leveraging standard webcam feeds and real-time AI models, OptiKey Pro eliminates the need for expensive dedicated hardware, providing smooth eye-gaze and head-pose cursor tracking directly in the browser.

---

## 🌟 Key Features

*   🎥 **Webcam-Only Tracking (No Hardware Required):** Uses high-precision [MediaPipe Face Mesh](https://github.com/google/mediapipe) tracking at 60 FPS to calculate 468 3D landmarks, including live iris refinement.
*   📐 **Custom 3x3 Calibration:** A fast 9-point calibration sequence with integrated outlier rejection to map facial features to screen coordinates.
*   ⏳ **Intelligent Dwell-Clicking:** Click keys simply by looking at them (dwelling). Incorporates an adaptive **OneEuroFilter** to dynamically filter high-frequency eye tremor and saccades.
*   🤖 **Hybrid Autocomplete Engine:**
    *   *Offline Local Memory:* An adaptive bigram vocabulary model that learns your typing habits on the fly.
    *   *Groq dynamic completions:* Sub-100ms next-word suggestions powered by `llama-3.1-8b-instant`.
*   🗺️ **Flexible Layouts:** 
    *   *QWERTY Mode:* Standard typing layout.
    *   *Quadrant Mode:* Huge 4-key split grid designed for high-stability inputs.
*   🧙‍♂️ **Wizard of Oz Remote (SSE):** Built-in Server-Sent Events (SSE) stream allowing an assistant to remotely control the cursor, trigger clicks, calibrate, or inject text over the local network.

---

## ♿ How It Helps People with Disabilities

For individuals who cannot use a physical keyboard or mouse:
1.  **Hands-Free Navigation:** Users can type sentences, control actions, and interact fully using only small movements of their eyes or head.
2.  **Fatigue Reduction:** The **Hybrid Tracking Mode** combines eye position (30%) with head angle (70%) to minimize neck strain and visual fatigue.
3.  **Error Prevention:** The **Quadrant Layout** transforms the typing board into huge, easily targetable buttons with a simple layout-switching mechanic, making typing reliable even with coarse gaze tracking.

---

## 🛠️ Technology Stack

*   **Core:** React 19, TypeScript, Vite
*   **Aesthetics:** Tailwind CSS v4, Framer Motion (`motion/react`), Lucide React
*   **Computer Vision:** MediaPipe Face Mesh & Camera Utils
*   **API & Networking:** Server-Sent Events (SSE) via Vite's Node middleware, Groq Cloud API Gateway proxying

---

## 🚀 Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   A functional webcam

### Installation & Run

1.  **Clone & Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Setup (Optional for LLM completions):**
    Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
    Set your `VITE_GROQ_API_KEY` (or paste it directly into the secure UI input during runtime).

3.  **Start the Local Server:**
    ```bash
    npm run dev
    ```
    Open your browser and navigate to `http://localhost:3000`.

---

## 🎮 How to Use

### 1. Calibration
Upon loading, you will be prompted with the **Calibration Target**. 
*   Sit comfortably centered in front of your webcam.
*   Focus your eyes on the center of the pulsing target and click it (or press **Spacebar/Enter**).
*   Follow the target across all 9 screen coordinates.

### 2. Typing
*   **Hover to Select:** Move your gaze or head pointer over any key. A dynamic blue dwell indicator will fill up at the bottom of the key.
*   **Auto-Trigger:** Once the dwell circle fills (defaults to 700ms), the key press registers automatically.
*   **Word Predictions:** Tap the lowercase suggestions bank floating above the keyboard to autotarget full words instantly.

### 3. Wizard of Oz / Remote Control Mode
*   Open `http://localhost:3000/remote` on a tablet or mobile phone on the same network.
*   Drag your finger on the trackpad to guide the presenter's screen cursor remotely, type words directly, or force clicks instantly to assist the user.

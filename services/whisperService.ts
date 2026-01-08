import { TranscriptionSegment } from "../types";

// --- WEB WORKER CODE ---
// We define the worker code as a string to avoid complex build configurations.
// This runs in a separate thread, preventing the UI from freezing.
const WORKER_CODE = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';

// Configure environment
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

self.addEventListener('message', async (event) => {
    const { type, audio } = event.data;

    if (type === 'load') {
        try {
            if (!transcriber) {
                self.postMessage({ status: 'progress', message: 'Loading AI Model (Base English)...' });
                
                transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', {
                    progress_callback: (data) => {
                        if (data.status === 'progress') {
                            self.postMessage({ 
                                status: 'progress', 
                                message: \`Loading Model: \${Math.round(data.progress || 0)}%\` 
                            });
                        } else if (data.status === 'initiate') {
                             self.postMessage({ status: 'progress', message: 'Initializing AI Engine...' });
                        }
                    }
                });
            }
            self.postMessage({ status: 'ready' });
        } catch (err) {
            self.postMessage({ status: 'error', error: err.message });
        }
        return;
    }

    if (type === 'transcribe') {
        if (!transcriber) {
             self.postMessage({ status: 'error', error: 'Model not loaded yet.' });
             return;
        }

        try {
            self.postMessage({ status: 'progress', message: 'Transcribing...' });
            
            // Run inference
            const output = await transcriber(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
                language: 'english',
                no_repeat_ngram_size: 2,
                repetition_penalty: 1.2,
            });

            self.postMessage({ status: 'complete', output });
        } catch (err) {
            self.postMessage({ status: 'error', error: err.message });
        }
    }
});
`;

// --- MAIN THREAD SERVICE ---

let worker: Worker | null = null;
let workerReadyPromise: Promise<void> | null = null;

const getWorker = () => {
  if (!worker) {
    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob), { type: 'module' });
  }
  return worker;
};

// Helper: robustly decode and resample audio to 16000Hz using OfflineAudioContext
const getAudioData = async (file: File): Promise<Float32Array> => {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  
  const offlineCtx = new OfflineAudioContext(1, decoded.duration * 16000, 16000);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();
  
  const resampled = await offlineCtx.startRendering();
  return resampled.getChannelData(0);
};

export const transcribeWithWhisper = async (
  file: File,
  onProgress: (status: string) => void
): Promise<TranscriptionSegment[]> => {
  
  const currentWorker = getWorker();

  // 1. Initialize Worker if needed
  if (!workerReadyPromise) {
    workerReadyPromise = new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        const { status, message, error } = e.data;
        if (status === 'ready') {
            currentWorker.removeEventListener('message', handler);
            resolve();
        } else if (status === 'progress') {
            onProgress(message);
        } else if (status === 'error') {
            currentWorker.removeEventListener('message', handler);
            reject(error);
        }
      };
      currentWorker.addEventListener('message', handler);
      currentWorker.postMessage({ type: 'load' });
    });
  }

  await workerReadyPromise;

  // 2. Process Audio (Main Thread)
  onProgress("Processing Audio (Resampling)...");
  const audioData = await getAudioData(file);

  // 3. Send to Worker (Background Thread)
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      const { status, message, output, error } = e.data;
      
      if (status === 'progress') {
        onProgress(message);
      } else if (status === 'complete') {
        currentWorker.removeEventListener('message', handler);
        
        // Format Output
        const segments: TranscriptionSegment[] = output.chunks.map((chunk: any) => ({
          timestamp: chunk.timestamp[0], 
          text: chunk.text.trim(),
          speaker: "Speaker 1" 
        }));
        resolve(segments);

      } else if (status === 'error') {
        currentWorker.removeEventListener('message', handler);
        reject(error);
      }
    };

    currentWorker.addEventListener('message', handler);
    // Transfer audio data to worker to save memory on main thread
    currentWorker.postMessage({ type: 'transcribe', audio: audioData }, [audioData.buffer]);
  });
};
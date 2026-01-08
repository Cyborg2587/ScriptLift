import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptionSegment } from "../types";

/**
 * Uses Gemini to identify speakers in an existing transcript.
 * This combines Whisper's timing accuracy with Gemini's audio understanding.
 */
export const identifySpeakers = async (
  base64Audio: string,
  mimeType: string,
  currentSegments: TranscriptionSegment[]
): Promise<TranscriptionSegment[]> => {
  try {
    // Initialize client inside the function to ensure process.env is ready and prevent module-level crashes
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-flash-preview';

    // Create a simpler format for Gemini to understand
    const segmentSummary = currentSegments.map((s, i) => ({
      index: i,
      timestamp: s.timestamp,
      text: s.text.substring(0, 100) // Truncate long text to save tokens
    }));

    const prompt = `
You are an expert at speaker diarization for podcasts and interviews.

TASK:
1. Listen to the audio and analyze the transcript.
2. Assign a speaker label (e.g., "Speaker 1", "Speaker 2") to each segment.

CRITICAL RULES FOR ACCURACY:
1. **REUSE LABELS**: The most common error is creating new labels for the same person.
   - If Speaker 1 talks, then Speaker 2 talks, then Speaker 1 talks again, LABEL THE THIRD SEGMENT AS "Speaker 1".
   - Do NOT just increment numbers (Speaker 1, Speaker 2, Speaker 3, Speaker 4...).
2. **LIMIT SPEAKERS**: Most files only have 2 or 3 distinct speakers. 
   - Be extremely skeptical of finding more than 4 speakers.
   - If you are unsure, assign it to the most likely existing speaker (1 or 2).
3. **CONTEXT**: Look at the text. If it looks like a back-and-forth conversation, it is likely just 2 people alternating.

TRANSCRIPT SEGMENTS:
${JSON.stringify(segmentSummary, null, 2)}

OUTPUT:
Return a JSON object with a "segments" array containing the "index" and the "speaker".
`;

    console.log(`[Gemini Diarization] Processing ${currentSegments.length} segments...`);

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/mp3', 
              data: base64Audio,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.INTEGER },
                  speaker: { type: Type.STRING },
                },
                required: ["index", "speaker"],
              },
            },
          },
          required: ["segments"],
        },
      },
    });

    if (!response.text) {
      console.warn("[Gemini Diarization] No response text received");
      return currentSegments;
    }

    // Parse response
    const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanText);

    if (!result.segments || !Array.isArray(result.segments)) {
      console.warn("[Gemini Diarization] Invalid response format:", result);
      return currentSegments;
    }

    // Create speaker map
    const speakerMap = new Map<number, string>();
    result.segments.forEach((s: any) => {
      if (typeof s.index === 'number' && s.speaker) {
        speakerMap.set(s.index, s.speaker);
      }
    });

    // Apply speaker labels
    const updatedSegments = currentSegments.map((seg, i) => ({
      ...seg,
      speaker: speakerMap.get(i) || seg.speaker // Keep original if Gemini didn't provide one
    }));

    // Log results
    const uniqueSpeakers = new Set(updatedSegments.map(s => s.speaker));
    console.log(`[Gemini Diarization] Success! Identified ${uniqueSpeakers.size} speaker(s):`, Array.from(uniqueSpeakers));

    return updatedSegments;

  } catch (error) {
    console.error("[Gemini Diarization] Error:", error);
    // Return original segments on error
    return currentSegments;
  }
};

/**
 * Fallback: Simple pause-based speaker detection
 * Use this if Gemini fails or for testing
 */
export const detectSpeakersFromPauses = (
  segments: TranscriptionSegment[]
): TranscriptionSegment[] => {
  console.log("[Fallback] Using pause-based speaker detection");
  
  let currentSpeaker = 1;
  let lastEndTime = 0;
  const pauseThreshold = 2.0; // seconds

  return segments.map((seg, idx) => {
    // Estimate end time
    const nextSeg = segments[idx + 1];
    const estimatedDuration = seg.text.split(' ').length * 0.4; // ~0.4 sec per word
    const endTime = seg.timestamp + estimatedDuration;

    // Check for long pause before this segment
    if (idx > 0 && seg.timestamp - lastEndTime > pauseThreshold) {
      currentSpeaker = currentSpeaker === 1 ? 2 : 1; // Toggle between 1 and 2 for fallback
    }

    lastEndTime = endTime;

    return {
      ...seg,
      speaker: `Speaker ${currentSpeaker}`
    };
  });
};
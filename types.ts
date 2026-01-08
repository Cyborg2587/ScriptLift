export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface TranscriptionSegment {
  timestamp: number; // seconds
  text: string;
  speaker: string;
}

export interface TranscriptionResult {
  id: string; // Unique ID for sharing
  fileName: string;
  segments: TranscriptionSegment[];
  rawText: string;
  date: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export enum ProjectStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface Project {
  id: string;
  fileName: string;
  fileType: string;
  storagePath?: string; // Added for cloud storage
  createdAt: number;
  expiresAt: number;
  status: ProjectStatus;
  transcription: TranscriptionResult | null;
  speakerMap: Record<string, string>;
}
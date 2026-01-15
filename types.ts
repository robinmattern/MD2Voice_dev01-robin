
export interface DialogueLine {
  speaker: 'User' | 'Assistant';
  text: string;
}

export interface SpeakerConfig {
  name: string;
  voice: string;
}

export interface AudioSession {
  buffer: AudioBuffer;
  blob: Blob;
  url: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

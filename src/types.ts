export interface Song {
  title: string;
  artist: string;
  url: string;
}

export interface TranscriptionWord {
  text: string;
  type: string;
  speaker_id: string;
  start: number;
  end: number;
}
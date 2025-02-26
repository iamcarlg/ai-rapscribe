import { ElevenLabsClient } from 'elevenlabs';

const test = async () => {
  try {
    // Initialize with API key
    const client = new ElevenLabsClient({
      apiKey: 'sk_d0a607b380768df6b9d4e4acf4c6658177ab25271e51c81e'
    });

    console.log('Fetching audio file...');
    const response = await fetch(
      'https://storage.googleapis.com/eleven-public-cdn/audio/marketing/nicole.mp3'
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }

    console.log('Converting audio to blob...');
    const audioBlob = new Blob([await response.arrayBuffer()], { type: 'audio/mp3' });

    console.log('Starting transcription...');
    const transcription = await client.speechToText.convert({
      file: audioBlob,
      model_id: 'scribe_v1'
    });

    console.log('Transcription result:', transcription);
  } catch (error) {
    console.error('Error in test:', error);
  }
};

test();
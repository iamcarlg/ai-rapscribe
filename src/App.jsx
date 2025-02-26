import React, { useState, useRef, useEffect } from 'react';
import { Mic, Music2, AlertCircle } from 'lucide-react';
import { songs } from './songs';
import { ElevenLabsClient } from 'elevenlabs';
import AudioVisualizer from './AudioVisualizer';

const client = new ElevenLabsClient({
  apiKey: import.meta.env.VITE_ELEVENLABS_API_KEY
});

function App() {
  const [selectedSong, setSelectedSong] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [words, setWords] = useState([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(null);
  const audioRef = useRef(null);

  // Update current word based on audio time
  useEffect(() => {
    if (!isPlaying || !audioRef.current || !words.length) {
      setCurrentWordIndex(null);
      return;
    }

    const updateCurrentWord = () => {
      const currentTime = audioRef.current.currentTime;
      const index = words.findIndex(
        word => currentTime >= word.start && currentTime <= word.end
      );
      setCurrentWordIndex(index !== -1 ? index : null);
    };

    // Update more frequently for smoother highlighting
    const interval = setInterval(updateCurrentWord, 50);
    updateCurrentWord(); // Initial update

    return () => clearInterval(interval);
  }, [isPlaying, words]);

  const handleSongChange = (event) => {
    setSelectedSong(event.target.value);
    setTranscription('');
    setWords([]);
    setIsPlaying(false);
    setError('');
    setCurrentWordIndex(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleTranscribe = async () => {
    if (!selectedSong || !audioRef.current) return;

    try {
      setIsTranscribing(true);
      setError('');
      setTranscription('');
      setWords([]);
      setCurrentWordIndex(null);

      // Show warming up state
      setTranscription('Warming up...');

      // Get the audio data through our proxy
      const audioResponse = await fetch(selectedSong, {
        headers: {
          'Accept': 'audio/mp3,audio/*;q=0.9,*/*;q=0.8',
        }
      });
      
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio file: ${audioResponse.status} ${audioResponse.statusText}`);
      }
      
      const audioBlob = await audioResponse.blob();

      setTranscription('Starting transcription...');

      // Start playing audio immediately
      if (audioRef.current) {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (error) {
          console.error('Failed to play audio:', error);
        }
      }

      const result = await client.speechToText.convert({
        file: audioBlob,
        model_id: 'scribe_v1',
        tag_audio_events: true
      });

      // Update text
      if (result.text) {
        setTranscription(result.text);
      }

      // Update words if available
      if (result.words?.length) {
        const formattedWords = result.words.map(word => ({
          text: word.text,
          type: word.type || 'word',
          speaker_id: word.speaker_id || '0',
          start: word.start || 0,
          end: word.end || 0
        }));
        setWords(formattedWords);
      }

    } catch (error) {
      console.error('Error transcribing:', error);
      let errorMessage = 'Failed to transcribe audio. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch audio file')) {
          errorMessage = 'Unable to load the audio file. Please check your internet connection and try again.';
        } else if (error.message.includes('Failed to start transcription')) {
          errorMessage = 'Unable to start transcription. The service might be temporarily unavailable.';
        } else if (error.message.includes('Failed to initialize')) {
          errorMessage = 'Unable to initialize transcription. Please try again in a moment.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      setTranscription('');
      setWords([]);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center mb-8">
          <Music2 className="w-12 h-12 mr-4" />
          <h1 className="text-4xl font-bold">RapScribe</h1>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 mb-8">
          <div className="flex gap-4 items-center">
            <select
              value={selectedSong}
              onChange={handleSongChange}
              className="flex-1 bg-white/20 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select a song</option>
              {songs.map(song => (
                <option key={song.url} value={song.url}>
                  {song.artist} - {song.title}
                </option>
              ))}
            </select>

            <button
              onClick={handleTranscribe}
              disabled={!selectedSong || isTranscribing}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Mic className="w-5 h-5" />
              {isTranscribing ? 'Transcribing...' : 'Transcribe'}
            </button>
          </div>

          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-200">{error}</p>
            </div>
          )}

          <div className="mt-4 space-y-4">
            {audioRef.current && (
              <AudioVisualizer audioElement={audioRef.current} isPlaying={isPlaying} />
            )}
            <audio
              ref={audioRef}
              src={selectedSong}
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full hidden"
              controls
            />
          </div>
        </div>

        {transcription && (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-3xl font-bold">Transcription:</h2>
              {currentWordIndex !== null && words[currentWordIndex]?.type === 'word' && (
                <h2 className="bg-pink-500 text-white px-1 rounded text-3xl">
                  {words[currentWordIndex].text}
                </h2>
              )}
            </div>
            <div className="space-y-2 leading-relaxed whitespace-pre-wrap">
              {words.map((word, index) => (
                <React.Fragment key={index}>
                  {word.type === 'word' ? (
                    <span
                      className={`transition-colors duration-100 ${
                        currentWordIndex === index
                          ? 'bg-pink-500 text-white px-1 rounded'
                          : ''
                      }`}
                    >
                      {word.text}
                    </span>
                  ) : (
                    word.text // Render spacing as-is
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

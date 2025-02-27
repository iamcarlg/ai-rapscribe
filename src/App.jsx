import React, { useState, useRef, useEffect } from 'react';
import { Mic, Play, Pause, Music2, ChevronDown, AlertCircle, Volume2 } from 'lucide-react';
import { songs } from './songs';
import { ElevenLabsClient } from 'elevenlabs';
import AudioVisualizer from './AudioVisualizer';

const client = new ElevenLabsClient({
  apiKey: "sk_ec55c4cdf690933d6a9cecd8ab2b4ad14b19c4cb182da819"
});

function App() {
  const [selectedSong, setSelectedSong] = useState('');
  const [showSongSelector, setShowSongSelector] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [words, setWords] = useState([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const selectedSongObj = songs.find(song => song.url === selectedSong);

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

  // Update progress bar and time display
  useEffect(() => {
    if (!audioRef.current) return;

    const updateTime = () => {
      if (audioRef.current) {
        const current = audioRef.current.currentTime;
        const total = audioRef.current.duration || 0;
        setCurrentTime(current);
        setDuration(total);
        setProgress((current / total) * 100 || 0);
      }
    };

    const interval = setInterval(updateTime, 100);
    updateTime(); // Initial update

    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleSongChange = (songUrl) => {
    setSelectedSong(songUrl);
    setShowSongSelector(false);
    setTranscription('');
    setWords([]);
    setIsPlaying(false);
    setError('');
    setCurrentWordIndex(null);
    setProgress(0);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const togglePlayPause = () => {
    if (!selectedSong || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('Error playing audio:', err);
        setError('Unable to play audio. Please try again.');
      });
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleProgressClick = (e) => {
    if (!audioRef.current || !duration) return;
    const progressBar = e.currentTarget;
    const bounds = progressBar.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const width = bounds.width;
    const percentage = x / width;
    const newTime = percentage * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(percentage * 100);
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
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <div className="py-4 px-8 flex justify-between items-center bg-black/40 backdrop-blur-lg sticky top-0 z-10">
        <div className="flex items-center">
          <Music2 className="w-8 h-8 text-purple-500 mr-2" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">RapScribe</h1>
        </div>
        <button
          onClick={() => setShowSongSelector(!showSongSelector)}
          className="bg-white/10 hover:bg-white/20 rounded-full px-4 py-2 flex items-center gap-2"
        >
          {selectedSongObj ? (
            <span>{selectedSongObj.artist} - {selectedSongObj.title}</span>
          ) : (
            <span>Select a song</span>
          )}
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Song selector dropdown */}
      {showSongSelector && (
        <div className="absolute z-20 right-8 mt-2 w-64 bg-zinc-900 rounded-lg shadow-lg p-2 border border-zinc-800">
          {songs.map(song => (
            <button
              key={song.url}
              onClick={() => handleSongChange(song.url)}
              className={`w-full text-left px-4 py-2 rounded-lg hover:bg-zinc-800 flex items-center gap-2 ${
                selectedSong === song.url ? 'bg-zinc-800 text-purple-400' : ''
              }`}
            >
              <Music2 className="w-4 h-4" />
              <div className="truncate">
                <div className="font-medium">{song.title}</div>
                <div className="text-sm text-zinc-400">{song.artist}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="max-w-5xl mx-auto p-8">
        {/* Album art and player */}
        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          <div className="flex-shrink-0">
            <div className="w-64 h-64 bg-gradient-to-br from-purple-900 to-pink-900 rounded-lg shadow-lg overflow-hidden flex items-center justify-center">
              {selectedSongObj ? (
                selectedSongObj.coverImage ? (
                  <img 
                    src={selectedSongObj.coverImage} 
                    alt={`${selectedSongObj.artist} - ${selectedSongObj.title}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music2 className="w-24 h-24 text-white/50" />
                )
              ) : (
                <Music2 className="w-24 h-24 text-white/50" />
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between">
            {/* Song details */}
            <div>
              <h2 className="text-3xl font-bold mb-1">
                {selectedSongObj ? selectedSongObj.title : 'No song selected'}
              </h2>
              <p className="text-xl text-zinc-400 mb-6">
                {selectedSongObj ? selectedSongObj.artist : 'Select a song to begin'}
              </p>
              
              {error && (
                <div className="mb-4 bg-red-900/30 border border-red-800 rounded-lg p-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-200">{error}</p>
                </div>
              )}
            </div>

            {/* Audio controls */}
            <div className="mt-auto">
              {audioRef.current && isPlaying && (
                <div className="h-10 mb-4">
                  <AudioVisualizer audioElement={audioRef.current} isPlaying={isPlaying} />
                </div>
              )}
              
              <div className="flex gap-2 items-center mb-2">
                <span className="text-xs text-zinc-500 w-10 text-right">{formatTime(currentTime)}</span>
                <div 
                  className="flex-1 h-2 bg-zinc-800 rounded cursor-pointer relative"
                  onClick={handleProgressClick}
                >
                  <div
                    className="absolute h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="text-xs text-zinc-500 w-10">{formatTime(duration)}</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <button
                    onClick={togglePlayPause}
                    disabled={!selectedSong}
                    className="bg-white rounded-full w-12 h-12 flex items-center justify-center text-black hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </button>
                  
                  <button
                    onClick={handleTranscribe}
                    disabled={!selectedSong || isTranscribing}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed rounded-full px-6 flex items-center gap-2 transition-colors"
                  >
                    <Mic className="w-5 h-5" />
                    <span>{isTranscribing ? 'Transcribing...' : 'Transcribe'}</span>
                  </button>
                </div>
                
                <Volume2 className="w-5 h-5 text-zinc-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Transcription section */}
        {transcription && (
          <div className="mt-8">
            <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-900/70 backdrop-blur-lg rounded-xl p-6 border border-zinc-800/50 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Lyrics</h2>
                {currentWordIndex !== null && words[currentWordIndex]?.type === 'word' && (
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1.5 rounded-full text-xl font-medium animate-pulse shadow-lg">
                    {words[currentWordIndex].text}
                  </div>
                )}
              </div>
              
              {/* Lyrics container with styling for modern look */}
              <div className="mx-auto max-w-3xl">
                {words.length ? (
                  <div className="text-center text-xl leading-loose tracking-wide whitespace-pre-wrap">
                    {words.map((word, index) => (
                      <React.Fragment key={index}>
                        {word.type === 'word' ? (
                          <span
                            className={`transition-all duration-200 inline-block transform ${
                              currentWordIndex === index
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-lg scale-110 font-medium shadow-lg'
                                : index < currentWordIndex
                                  ? 'text-zinc-300'
                                  : 'text-zinc-500'
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
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="relative">
                      <div className="w-12 h-12 border-t-2 border-r-2 border-purple-500 border-solid rounded-full animate-spin"></div>
                      <div className="w-12 h-12 border-b-2 border-l-2 border-pink-500 border-solid rounded-full animate-spin absolute top-0 left-0" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
                    </div>
                    <p className="text-zinc-400 italic mt-4 text-center">{transcription}</p>
                  </div>
                )}
              </div>
              
              {/* Progress indicators at the bottom */}
              {words.length > 0 && (
                <div className="mt-8 px-4">
                  <div className="w-full bg-zinc-800/50 h-1 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 ease-out"
                      style={{ 
                        width: `${currentWordIndex !== null ? ((currentWordIndex + 1) / words.length) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={selectedSong}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
}

export default App;
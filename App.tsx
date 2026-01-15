
import React, { useState, useRef, useCallback } from 'react';
import { AppStatus, DialogueLine, SpeakerConfig, AudioSession } from './types';
import { VOICES } from './constants';
import { generateTTS } from './services/geminiService';
import { decodeBase64, decodeAudioData, audioBufferToWav } from './services/audioUtils';

export default function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [dialogue, setDialogue] = useState<DialogueLine[]>([]);
  const [userConfig, setUserConfig] = useState<SpeakerConfig>({ name: 'User', voice: 'Kore' });
  const [assistantConfig, setAssistantConfig] = useState<SpeakerConfig>({ name: 'Assistant', voice: 'Puck' });
  const [audioSession, setAudioSession] = useState<AudioSession | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus(AppStatus.PARSING);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseMarkdown(content);
    };
    reader.onerror = () => {
      setError("Failed to read file.");
      setStatus(AppStatus.ERROR);
    };
    reader.readAsText(file);
  };

  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    const parsed: DialogueLine[] = [];
    
    // Simple parsing for "Speaker: text"
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const userMatch = trimmed.match(/^User:\s*(.*)/i);
      const assistantMatch = trimmed.match(/^Assistant:\s*(.*)/i);

      if (userMatch) {
        parsed.push({ speaker: 'User', text: userMatch[1].trim() });
      } else if (assistantMatch) {
        parsed.push({ speaker: 'Assistant', text: assistantMatch[1].trim() });
      } else if (parsed.length > 0) {
        // Append to last line if it's a continuation
        parsed[parsed.length - 1].text += ' ' + trimmed;
      }
    });

    if (parsed.length === 0) {
      setError("No valid 'User:' or 'Assistant:' lines found in the file.");
      setStatus(AppStatus.ERROR);
    } else {
      setDialogue(parsed);
      setStatus(AppStatus.IDLE);
      setAudioSession(null);
    }
  };

  const handleGenerate = async () => {
    if (dialogue.length === 0) return;
    setStatus(AppStatus.GENERATING);
    setError(null);

    try {
      const base64 = await generateTTS(dialogue, userConfig, assistantConfig);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const decodedData = decodeBase64(base64);
      const audioBuffer = await decodeAudioData(decodedData, audioCtx);
      const wavBlob = audioBufferToWav(audioBuffer);
      const url = URL.createObjectURL(wavBlob);

      setAudioSession({
        buffer: audioBuffer,
        blob: wavBlob,
        url: url
      });
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during audio generation.");
      setStatus(AppStatus.ERROR);
    }
  };

  const downloadAudio = () => {
    if (!audioSession) return;
    const a = document.createElement('a');
    a.href = audioSession.url;
    a.download = `conversation_${Date.now()}.wav`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-indigo-900 tracking-tight sm:text-5xl">
            Dialogue to Speech Studio
          </h1>
          <p className="mt-3 text-lg text-indigo-700">
            Turn your markdown dialogues into lifelike multi-speaker audio.
          </p>
        </div>

        {/* Upload & Setup Section */}
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-indigo-100">
          <div className="p-6 sm:p-8 space-y-6">
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                Upload Markdown
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".md,.txt"
                className="hidden"
              />
              {dialogue.length > 0 && (
                <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  {dialogue.length} lines parsed
                </span>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Config Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
              {/* User Speaker Config */}
              <div className="space-y-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-2 text-indigo-900 font-bold uppercase tracking-wider text-xs">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  User Mapping
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={userConfig.name}
                    onChange={(e) => setUserConfig({ ...userConfig, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Voice</label>
                  <select
                    value={userConfig.voice}
                    onChange={(e) => setUserConfig({ ...userConfig, voice: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Assistant Speaker Config */}
              <div className="space-y-4 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                <div className="flex items-center gap-2 text-purple-900 font-bold uppercase tracking-wider text-xs">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  Assistant Mapping
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={assistantConfig.name}
                    onChange={(e) => setAssistantConfig({ ...assistantConfig, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="e.g. Sarah"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Voice</label>
                  <select
                    value={assistantConfig.voice}
                    onChange={(e) => setAssistantConfig({ ...assistantConfig, voice: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6">
              <button
                disabled={status === AppStatus.GENERATING || dialogue.length === 0}
                onClick={handleGenerate}
                className={`w-full py-4 rounded-xl font-bold text-lg transition shadow-lg ${
                  status === AppStatus.GENERATING || dialogue.length === 0
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white transform hover:-translate-y-0.5'
                }`}
              >
                {status === AppStatus.GENERATING ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Generating Professional Audio...
                  </span>
                ) : 'Generate Multi-Speaker Audio'}
              </button>
            </div>
          </div>
        </div>

        {/* Audio Output Section */}
        {audioSession && (
          <div className="bg-white shadow-xl rounded-2xl p-6 sm:p-8 border border-green-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
              Success! Audio Session Ready
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-full flex-grow">
                <audio controls src={audioSession.url} className="w-full h-12" />
              </div>
              <button
                onClick={downloadAudio}
                className="w-full sm:w-auto px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition shadow hover:shadow-lg flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Download WAV
              </button>
            </div>
            <p className="mt-4 text-xs text-gray-500 text-center italic">
              * The audio is high-quality 24kHz PCM exported as a WAV file.
            </p>
          </div>
        )}

        {/* Conversation Preview Section */}
        {dialogue.length > 0 && (
          <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-700">Conversation Preview</h3>
            </div>
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {dialogue.map((line, idx) => (
                <div key={idx} className={`flex flex-col ${line.speaker === 'User' ? 'items-start' : 'items-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 ${
                    line.speaker === 'User' 
                      ? 'bg-blue-50 text-blue-900 border border-blue-100' 
                      : 'bg-purple-50 text-purple-900 border border-purple-100'
                  }`}>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60">
                      {line.speaker === 'User' ? userConfig.name : assistantConfig.name}
                    </div>
                    <p className="text-sm leading-relaxed">{line.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

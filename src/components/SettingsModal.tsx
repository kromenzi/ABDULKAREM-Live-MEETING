import React, { useEffect, useState } from 'react';
import {
  X,
  Settings,
  Camera,
  Mic,
  Volume2,
  Sparkles,
  Zap,
  Activity,
  Sliders,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import {
  Language,
  VideoQualityPreset,
  AudioQualityPreset,
  VideoFilter,
  NetworkStats,
} from '../types';
import { getTranslation } from '../translations';
import { playStudioSoundTest } from '../utils/webrtc';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  videoPreset: VideoQualityPreset;
  setVideoPreset: (p: VideoQualityPreset) => void;
  audioPreset: AudioQualityPreset;
  setAudioPreset: (p: AudioQualityPreset) => void;
  videoFilter: VideoFilter;
  setVideoFilter: (f: VideoFilter) => void;
  networkStats: NetworkStats | null;
  onSwitchDevice?: (kind: 'videoinput' | 'audioinput', deviceId: string) => void;
  isNoiseSuppressionEnabled: boolean;
  onToggleNoiseSuppression: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  lang,
  videoPreset,
  setVideoPreset,
  audioPreset,
  setAudioPreset,
  videoFilter,
  setVideoFilter,
  networkStats,
  onSwitchDevice,
  isNoiseSuppressionEnabled,
  onToggleNoiseSuppression,
}) => {
  const t = getTranslation(lang);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const enumerate = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const v = devices.filter((d) => d.kind === 'videoinput');
        const a = devices.filter((d) => d.kind === 'audioinput');
        setVideoDevices(v);
        setAudioDevices(a);
        if (v[0] && !selectedVideo) setSelectedVideo(v[0].deviceId);
        if (a[0] && !selectedAudio) setSelectedAudio(a[0].deviceId);
      } catch (err) {
        console.warn('Could not enumerate devices:', err);
      }
    };

    enumerate();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestSound = () => {
    setIsPlayingTestSound(true);
    playStudioSoundTest();
    setTimeout(() => setIsPlayingTestSound(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t.deviceSettings}</h3>
              <p className="text-xs text-slate-400">{t.studioSettingsDesc}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {/* Video Quality Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{t.videoQuality}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { id: '1080p', label: t.preset1080p, badge: t.recommended },
                { id: '4k', label: t.preset4k, badge: t.maxUltraHd },
                { id: '720p', label: t.preset720p, badge: t.fastLowBandwidth },
                { id: 'auto', label: t.presetAuto, badge: t.smartAdaptive },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setVideoPreset(item.id as VideoQualityPreset)}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    videoPreset === item.id
                      ? 'border-sky-500 bg-sky-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-sky-400">{item.badge}</span>
                    {videoPreset === item.id && (
                      <CheckCircle2 className="w-4 h-4 text-sky-400" />
                    )}
                  </div>
                  <span className="text-xs font-medium leading-snug">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Audio Quality Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>{t.audioQuality}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'studio', label: t.audioStudio, sub: t.stereo48k },
                { id: 'speech', label: t.audioSpeech, sub: t.aiNoiseFilter },
                { id: 'music', label: t.audioMusic, sub: t.losslessRaw },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAudioPreset(item.id as AudioQualityPreset)}
                  className={`p-3 rounded-2xl border text-left transition ${
                    audioPreset === item.id
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{item.sub}</span>
                    {audioPreset === item.id && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">{item.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Web Audio API DynamicsCompressorNode Noise Suppression Toggle */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl transition ${
                    isNoiseSuppressionEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">{t.noiseSuppressionToggle}</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm sm:max-w-md">
                    {t.noiseSuppressionDesc}
                  </p>
                </div>
              </div>

              {/* Interactive Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={isNoiseSuppressionEnabled}
                onClick={onToggleNoiseSuppression}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isNoiseSuppressionEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isNoiseSuppressionEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Dynamics Compressor Metrics & Status */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isNoiseSuppressionEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                  }`}
                />
                <span
                  className={`font-mono font-medium ${
                    isNoiseSuppressionEnabled ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {isNoiseSuppressionEnabled ? t.compressorActive : t.compressorBypass}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                DynamicsCompressorNode &middot; Attack 3ms &middot; Release 250ms &middot; Knee 30
              </span>
            </div>
          </div>

          {/* Video Visual Filters & Studio Lighting */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>{t.videoFilter}</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'none', label: t.filterNone },
                { id: 'studio-warm', label: t.filterStudioWarm },
                { id: 'cool-clean', label: t.filterCoolClean },
                { id: 'low-light-boost', label: t.filterLowLight },
                { id: 'vibrant', label: t.filterVibrant },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setVideoFilter(item.id as VideoFilter)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium text-center transition ${
                    videoFilter === item.id
                      ? 'border-purple-500 bg-purple-500/15 text-purple-200'
                      : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hardware Device Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-sky-400" />
                <span>{t.selectCamera}</span>
              </label>
              <select
                value={selectedVideo}
                onChange={(e) => {
                  setSelectedVideo(e.target.value);
                  onSwitchDevice?.('videoinput', e.target.value);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {videoDevices.length > 0 ? (
                  videoDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `${t.selectCamera} ${i + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="">{t.defaultCamera}</option>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>{t.selectMicrophone}</span>
              </label>
              <select
                value={selectedAudio}
                onChange={(e) => {
                  setSelectedAudio(e.target.value);
                  onSwitchDevice?.('audioinput', e.target.value);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {audioDevices.length > 0 ? (
                  audioDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `${t.selectMicrophone} ${i + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="">{t.defaultMic}</option>
                )}
              </select>
            </div>
          </div>

          {/* Sound Test Button */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <Volume2 className="w-4 h-4 text-sky-400" />
              <span>{isPlayingTestSound ? t.playingSound : t.testSound}</span>
            </div>
            <button
              type="button"
              onClick={handleTestSound}
              disabled={isPlayingTestSound}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition"
            >
              {t.testSound}
            </button>
          </div>

          {/* Real-time WebRTC Live Diagnostics & Telemetry */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Activity className="w-4 h-4 text-sky-400" />
                <span>{t.connectionStats}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {t.p2pOptimized}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">{t.resolution}</span>
                <span className="font-bold text-white font-mono">
                  {networkStats ? networkStats.resolution : videoPreset === '4k' ? '3840×2160' : '1920×1080'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">{t.framerate}</span>
                <span className="font-bold text-white font-mono">
                  {networkStats ? `${networkStats.frameRate} FPS` : '60 FPS'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">{t.bitrate}</span>
                <span className="font-bold text-sky-400 font-mono">
                  {videoPreset === '4k' ? '8.0 Mbps' : videoPreset === '1080p' ? '4.0 Mbps' : '2.0 Mbps'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block">{t.latency}</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {networkStats ? `${networkStats.rttMs} ms` : '< 20 ms'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition cursor-pointer shadow-lg shadow-sky-500/20"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

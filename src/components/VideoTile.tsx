import React, { useEffect, useRef, useState } from 'react';
import {
  MicOff,
  Hand,
  Monitor,
  Pin,
  PinOff,
  PictureInPicture2,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { Participant, Language, VideoFilter } from '../types';
import { createAudioLevelDetector, createAudioSpectrumDetector } from '../utils/webrtc';
import { getTranslation } from '../translations';

interface VideoTileProps {
  participant: Participant;
  isLocal: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  lang: Language;
  videoFilter?: VideoFilter;
  onSpeakingChange?: (isSpeaking: boolean) => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isLocal,
  isPinned,
  onTogglePin,
  lang,
  videoFilter = 'none',
  onSpeakingChange,
}) => {
  const t = getTranslation(lang);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [eqBands, setEqBands] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream, participant.isCameraOff]);

  // Web Audio API volume detection to detect active speaker
  useEffect(() => {
    if (!participant.stream || participant.isMuted) {
      setIsSpeaking(false);
      onSpeakingChange?.(false);
      return;
    }

    const cleanupLevel = createAudioLevelDetector(participant.stream, (volume) => {
      // Threshold for human speech volume
      if (volume > 12 && !participant.isMuted) {
        setIsSpeaking(true);
        onSpeakingChange?.(true);

        // Reset debounce timer to prevent flickering between syllables
        if (speakingTimeoutRef.current) {
          clearTimeout(speakingTimeoutRef.current);
        }
        speakingTimeoutRef.current = setTimeout(() => {
          setIsSpeaking(false);
          onSpeakingChange?.(false);
        }, 450);
      }
    });

    const cleanupSpectrum = createAudioSpectrumDetector(participant.stream, (bands) => {
      setEqBands(bands);
    });

    return () => {
      cleanupLevel();
      cleanupSpectrum();
      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
      }
    };
  }, [participant.stream, participant.isMuted, onSpeakingChange]);

  // Derive initials
  const initials =
    (participant.displayName || t.guestLabel)
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join('') || 'U';

  const togglePiP = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('PiP failed:', err);
      }
    }
  };

  // Video filter CSS styles
  const getFilterStyle = (): React.CSSProperties => {
    if (!isLocal || videoFilter === 'none') return {};
    switch (videoFilter) {
      case 'studio-warm':
        return { filter: 'sepia(0.12) saturate(1.15) contrast(1.05) brightness(1.04)' };
      case 'cool-clean':
        return { filter: 'hue-rotate(5deg) contrast(1.08) brightness(1.02)' };
      case 'low-light-boost':
        return { filter: 'brightness(1.22) contrast(1.1) saturate(1.1)' };
      case 'vibrant':
        return { filter: 'saturate(1.35) contrast(1.06)' };
      default:
        return {};
    }
  };

  return (
    <div
      className={`relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden shadow-xl flex items-center justify-center select-none group transition-all duration-200 border-2 ${
        isSpeaking
          ? 'active-speaker-frame border-emerald-400 ring-4 ring-emerald-500/40 shadow-xl shadow-emerald-500/25'
          : 'border-slate-800'
      }`}
    >
      {/* Video element with hardware acceleration */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={getFilterStyle()}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          participant.isCameraOff ? 'opacity-0 absolute pointer-events-none' : 'opacity-100'
        } ${isLocal && !participant.isScreenSharing ? 'scale-x-[-1]' : ''}`}
      />

      {/* Camera Off Avatar Placeholder with pulsing glow when speaking */}
      {participant.isCameraOff && (
        <div className="flex flex-col items-center justify-center space-y-3 z-10">
          <div
            className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-white font-bold text-2xl sm:text-4xl shadow-2xl transition-transform duration-300 ${
              isSpeaking
                ? 'scale-110 ring-4 ring-emerald-400/80 bg-gradient-to-tr from-emerald-600 to-sky-500'
                : 'bg-gradient-to-tr from-indigo-700 via-sky-600 to-emerald-600'
            }`}
          >
            {initials}
          </div>
          <span className="text-sm font-semibold text-slate-200 tracking-wide">
            {participant.displayName}
          </span>
        </div>
      )}

      {/* Top badges bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Active Speaking Badge */}
          {isSpeaking && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-slate-950 backdrop-blur-md shadow-md animate-pulse">
              <Volume2 className="w-3.5 h-3.5" />
              <span>{t.speaking}</span>
            </span>
          )}

          {participant.isHandRaised && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400 text-slate-950 backdrop-blur-md shadow-lg animate-bounce">
              <Hand className="w-3.5 h-3.5" />
              <span>{t.handRaisedBadge}</span>
            </span>
          )}

          {participant.isScreenSharing && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500 text-white backdrop-blur-md shadow-lg">
              <Monitor className="w-3.5 h-3.5" />
              <span>{t.sharingScreenBadge}</span>
            </span>
          )}

          {isLocal && videoFilter !== 'none' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/80 text-white backdrop-blur-md">
              <Sparkles className="w-3 h-3" />
              <span className="capitalize">{videoFilter}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* PiP Button */}
          <button
            onClick={togglePiP}
            className="p-1.5 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white transition backdrop-blur-sm shadow"
            title={t.pictureInPicture}
          >
            <PictureInPicture2 className="w-3.5 h-3.5" />
          </button>

          {/* Pin Button */}
          {onTogglePin && (
            <button
              onClick={onTogglePin}
              className="p-1.5 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white transition backdrop-blur-sm shadow"
              title={isPinned ? t.unpin : t.pin}
            >
              {isPinned ? <PinOff className="w-3.5 h-3.5 text-sky-400" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Bottom info & EQ spectrum */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950/85 text-white backdrop-blur-md text-xs font-medium max-w-[80%] border border-slate-800/80">
          <span className="truncate">
            {participant.displayName} {isLocal && `(${t.you})`}
          </span>

          {/* 8-Band Live Spectrum Analyzer */}
          {!participant.isMuted && (
            <div className="flex items-end gap-0.5 h-3.5 px-1">
              {eqBands.map((band, i) => (
                <div
                  key={i}
                  className={`w-0.5 rounded-full transition-all duration-75 ${
                    isSpeaking ? 'bg-emerald-400' : 'bg-slate-500'
                  }`}
                  style={{ height: `${Math.max(2, (band / 100) * 14)}px` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {participant.isMuted && (
            <div
              className="p-1.5 rounded-xl bg-rose-600/90 text-white shadow-md backdrop-blur-sm"
              title={t.micMuted}
            >
              <MicOff className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

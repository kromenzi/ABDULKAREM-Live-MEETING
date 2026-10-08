import React from 'react';
import { X, Users, Mic, MicOff, Video, VideoOff, Hand, Monitor, UserPlus, UserMinus } from 'lucide-react';
import { Participant, Language } from '../types';
import { getTranslation } from '../translations';

interface ParticipantsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  currentPeerId: string;
  hasSimulatedPeer: boolean;
  onToggleSimulatedPeer: () => void;
  lang: Language;
}

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
  isOpen,
  onClose,
  participants,
  currentPeerId,
  hasSimulatedPeer,
  onToggleSimulatedPeer,
  lang,
}) => {
  const t = getTranslation(lang);

  if (!isOpen) return null;

  return (
    <div className="w-80 sm:w-96 h-full flex flex-col bg-slate-900 border-l border-slate-800 shadow-xl z-30 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800">
        <div className="flex items-center gap-2 text-slate-200">
          <Users className="w-4 h-4 text-sky-400" />
          <h3 className="font-semibold text-sm">{t.participants}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {participants.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {participants.map((p) => {
          const isMe = p.peerId === currentPeerId;
          const initials = (p.displayName || t.guestLabel)
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase())
            .join('') || 'U';

          return (
            <div
              key={p.peerId}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-sky-300 shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {p.displayName} {isMe && `(${t.you})`}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    {p.isHandRaised && (
                      <span className="text-amber-400 flex items-center gap-0.5">
                        <Hand className="w-3 h-3" />
                        <span>{t.handRaisedBadge}</span>
                      </span>
                    )}
                    {p.isScreenSharing && (
                      <span className="text-sky-400 flex items-center gap-0.5">
                        <Monitor className="w-3 h-3" />
                        <span>{t.sharingScreenBadge}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Icons */}
              <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                {p.isMuted ? (
                  <MicOff className="w-4 h-4 text-rose-500" />
                ) : (
                  <Mic className="w-4 h-4 text-emerald-400" />
                )}
                {p.isCameraOff ? (
                  <VideoOff className="w-4 h-4 text-slate-500" />
                ) : (
                  <Video className="w-4 h-4 text-sky-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Simulator Test Action */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60">
        <button
          onClick={onToggleSimulatedPeer}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
            hasSimulatedPeer
              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30'
          }`}
        >
          {hasSimulatedPeer ? (
            <>
              <UserMinus className="w-3.5 h-3.5" />
              <span>{t.removeSimulatedPeer}</span>
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t.simulatedPeer}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

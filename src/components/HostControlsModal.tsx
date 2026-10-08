import React from 'react';
import {
  X,
  ShieldAlert,
  MicOff,
  Lock,
  Unlock,
  Clock,
  UserCheck,
  UserX,
  UserMinus,
  FileText,
  Users,
} from 'lucide-react';
import { Participant, WaitingGuest, Language } from '../types';
import { getTranslation } from '../translations';

interface HostControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  waitingGuests: WaitingGuest[];
  participants: Participant[];
  currentPeerId: string;
  isLocked: boolean;
  waitingRoomEnabled: boolean;
  onAdmitGuest: (peerId: string) => void;
  onDenyGuest: (peerId: string) => void;
  onMuteAll: () => void;
  onKickParticipant: (peerId: string) => void;
  onToggleLockRoom: (locked: boolean) => void;
  onToggleWaitingRoom: (enabled: boolean) => void;
  onExportMinutes: () => void;
  lang: Language;
}

export const HostControlsModal: React.FC<HostControlsModalProps> = ({
  isOpen,
  onClose,
  waitingGuests,
  participants,
  currentPeerId,
  isLocked,
  waitingRoomEnabled,
  onAdmitGuest,
  onDenyGuest,
  onMuteAll,
  onKickParticipant,
  onToggleLockRoom,
  onToggleWaitingRoom,
  onExportMinutes,
  lang,
}) => {
  const t = getTranslation(lang);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t.hostControls}</h3>
              <p className="text-xs text-slate-400">{t.executiveModeration}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* Waiting Room Queue */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{t.waitingRoom} ({waitingGuests.length})</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {waitingRoomEnabled ? t.waitingRoomNotice : t.lobbyOff}
              </span>
            </div>

            {waitingGuests.length === 0 ? (
              <p className="text-xs text-slate-500 italic">{t.noGuestsWaiting}</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {waitingGuests.map((guest) => (
                  <div
                    key={guest.peerId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                  >
                    <span className="font-semibold text-white">{guest.displayName}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAdmitGuest(guest.peerId)}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{t.admit}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDenyGuest(guest.peerId)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 transition cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>{t.deny}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Executive Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Mute All */}
            <button
              type="button"
              onClick={onMuteAll}
              className="p-3.5 rounded-2xl border border-slate-800 bg-slate-950/80 hover:bg-rose-500/10 hover:border-rose-500/30 text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white group-hover:text-rose-300">
                  {t.muteAll}
                </span>
                <p className="text-[11px] text-slate-400">{t.muteAllDesc}</p>
              </div>
              <MicOff className="w-5 h-5 text-slate-400 group-hover:text-rose-400" />
            </button>

            {/* Lock / Unlock Meeting */}
            <button
              type="button"
              onClick={() => onToggleLockRoom(!isLocked)}
              className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                isLocked
                  ? 'border-amber-500 bg-amber-500/10 text-amber-200'
                  : 'border-slate-800 bg-slate-950/80 hover:bg-slate-900 text-slate-200'
              }`}
            >
              <div className="space-y-0.5">
                <span className="text-xs font-bold">
                  {isLocked ? t.unlockMeeting : t.lockMeeting}
                </span>
                <p className="text-[11px] text-slate-400">
                  {isLocked ? t.roomCurrentlyLocked : t.preventNewGuests}
                </p>
              </div>
              {isLocked ? (
                <Lock className="w-5 h-5 text-amber-400" />
              ) : (
                <Unlock className="w-5 h-5 text-slate-400" />
              )}
            </button>

            {/* Toggle Waiting Room */}
            <button
              type="button"
              onClick={() => onToggleWaitingRoom(!waitingRoomEnabled)}
              className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                waitingRoomEnabled
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200'
                  : 'border-slate-800 bg-slate-950/80 hover:bg-slate-900 text-slate-200'
              }`}
            >
              <div className="space-y-0.5">
                <span className="text-xs font-bold">{t.waitingRoomToggle}</span>
                <p className="text-[11px] text-slate-400">
                  {waitingRoomEnabled ? t.guestsKnock : t.directAdmission}
                </p>
              </div>
              <Clock className="w-5 h-5 text-indigo-400" />
            </button>

            {/* Export Meeting Minutes */}
            <button
              type="button"
              onClick={onExportMinutes}
              className="p-3.5 rounded-2xl border border-slate-800 bg-slate-950/80 hover:bg-sky-500/10 hover:border-sky-500/30 text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white group-hover:text-sky-300">
                  {t.exportMinutes}
                </span>
                <p className="text-[11px] text-slate-400">{t.generateMinutesDesc}</p>
              </div>
              <FileText className="w-5 h-5 text-sky-400" />
            </button>
          </div>

          {/* Participant Kick / Evict Management */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              <span>{t.participantManagement}</span>
            </span>

            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {participants
                .filter((p) => p.peerId !== currentPeerId)
                .map((p) => (
                  <div
                    key={p.peerId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <span className="font-medium text-slate-200">{p.displayName}</span>
                    <button
                      type="button"
                      onClick={() => onKickParticipant(p.peerId)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition cursor-pointer"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>{t.kickParticipant}</span>
                    </button>
                  </div>
                ))}
              {participants.length <= 1 && (
                <p className="text-xs text-slate-500 italic">{t.noRemoteParticipants}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-6 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Clock, Shield, ArrowLeft } from 'lucide-react';
import { Language } from '../types';
import { getTranslation } from '../translations';

interface WaitingRoomScreenProps {
  roomId: string;
  displayName: string;
  onCancel: () => void;
  lang: Language;
}

export const WaitingRoomScreen: React.FC<WaitingRoomScreenProps> = ({
  roomId,
  displayName,
  onCancel,
  lang,
}) => {
  const t = getTranslation(lang);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-widest">
            <Shield className="w-3.5 h-3.5" />
            <span>{t.waitingRoom}</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            ABDULKAREM BOARD MEETING
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            {t.roomLabel}: <span className="text-slate-200 font-semibold">{roomId}</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
          <p>{t.waitingRoomPrompt}</p>
          <p className="mt-2 text-[11px] text-slate-500">
            {t.guestLabel}: <strong className="text-slate-300">{displayName}</strong>
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.leave}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

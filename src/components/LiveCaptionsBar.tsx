import React from 'react';
import { Subtitles } from 'lucide-react';

interface LiveCaptionsBarProps {
  speakerName: string;
  text: string;
  isOpen: boolean;
}

export const LiveCaptionsBar: React.FC<LiveCaptionsBarProps> = ({
  speakerName,
  text,
  isOpen,
}) => {
  if (!isOpen || !text.trim()) return null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[90%] pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="bg-slate-950/85 border border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-md flex items-start gap-3">
        <div className="p-1 rounded-lg bg-sky-500/20 text-sky-400 shrink-0 mt-0.5">
          <Subtitles className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-[11px] font-bold text-sky-400 block uppercase tracking-wider mb-0.5">
            {speakerName}:
          </span>
          <p className="text-sm font-medium text-slate-100 leading-snug break-words">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
};

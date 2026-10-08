import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { Language } from '../types';
import { getTranslation } from '../translations';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const t = getTranslation(lang);

  if (!isOpen) return null;

  const shortcutsList = [
    { key: 'M', label: t.shortcutMute, desc: 'Mute / Unmute Mic' },
    { key: 'C', label: t.shortcutCamera, desc: 'Video On / Off' },
    { key: 'S', label: t.shortcutScreen, desc: 'Screen Share 60FPS' },
    { key: 'G', label: t.shortcutGrid, desc: 'Grid / Speaker Mode' },
    { key: 'H', label: t.shortcutHand, desc: 'Raise / Lower Hand' },
    { key: 'T', label: t.shortcutChat, desc: 'In-Meeting Chat' },
    { key: 'P', label: t.shortcutParticipants, desc: 'Participants List' },
    { key: 'F', label: t.shortcutFullscreen, desc: 'Toggle Fullscreen' },
    { key: '?', label: t.keyboardShortcuts, desc: 'Show this Help Dialog' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t.keyboardShortcuts}</h3>
              <p className="text-xs text-slate-400">{t.shortcutHelpDesc}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-2.5">
          {shortcutsList.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition"
            >
              <span className="text-xs font-medium text-slate-200">{item.label}</span>
              <kbd className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-sky-400 shadow-sm min-w-[32px] text-center">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition cursor-pointer shadow-lg shadow-sky-500/20"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

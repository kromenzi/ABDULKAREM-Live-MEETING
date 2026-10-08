import React, { useState } from 'react';
import { X, Copy, Check, Code, ExternalLink, ShieldCheck } from 'lucide-react';
import { Language } from '../types';
import { getTranslation } from '../translations';

interface EmbedModalProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const EmbedModal: React.FC<EmbedModalProps> = ({
  roomId,
  isOpen,
  onClose,
  lang,
}) => {
  const t = getTranslation(lang);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [embedWidth, setEmbedWidth] = useState('100%');
  const [embedHeight, setEmbedHeight] = useState('680px');

  if (!isOpen) return null;

  const currentOrigin = window.location.origin;
  const directRoomUrl = `${currentOrigin}/?room=${encodeURIComponent(roomId)}`;
  const embedUrl = `${currentOrigin}/?room=${encodeURIComponent(roomId)}&embed=1&lang=${lang}`;

  const iframeSnippet = `<iframe
  src="${embedUrl}"
  title="ABDULKAREM BOARD MEETING"
  width="${embedWidth}"
  height="${embedHeight}"
  style="border: none; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);"
  allow="camera; microphone; display-capture; autoplay"
  allowfullscreen
></iframe>`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(iframeSnippet);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2200);
    } catch {
      // fallback
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(directRoomUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{t.embedModalTitle}</h3>
              <p className="text-xs text-slate-400">{t.embedModalDesc}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* Direct link */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {t.roomUrl}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={directRoomUrl}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-300 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl transition whitespace-nowrap"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? t.linkCopied : t.copyLink}</span>
              </button>
            </div>
          </div>

          {/* Sizing options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">{t.width}</label>
              <select
                value={embedWidth}
                onChange={(e) => setEmbedWidth(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="100%">{t.responsiveFullWidth}</option>
                <option value="1200px">{t.largeBoard}</option>
                <option value="800px">{t.mediumWidget}</option>
                <option value="500px">{t.sideDrawer}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">{t.height}</label>
              <select
                value={embedHeight}
                onChange={(e) => setEmbedHeight(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="680px">{t.heightRecommended}</option>
                <option value="800px">{t.tallView}</option>
                <option value="550px">{t.compactHeight}</option>
                <option value="100vh">{t.fullHeight}</option>
              </select>
            </div>
          </div>

          {/* HTML Snippet */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {t.iframeCode}
              </label>
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t.iframePermissionsNote}</span>
              </span>
            </div>
            <pre className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-sky-300 font-mono overflow-x-auto whitespace-pre select-all">
              {iframeSnippet}
            </pre>
            <p className="text-[11px] text-slate-500">
              {t.iframeAttributeNote}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              {t.close}
            </button>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20 transition"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? t.iframeCopied : t.copyIframe}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { ShieldCheck, AlertCircle, FileText, X } from 'lucide-react';
import { Language } from '../types';
import { getTranslation } from '../translations';

interface ConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  lang: Language;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  onAccept,
  onDecline,
  lang,
}) => {
  const t = getTranslation(lang);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{t.consentTitle}</h3>
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
              {t.enterpriseBadge}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-4 text-xs text-slate-300 leading-relaxed">
          <p>{t.consentDesc}</p>

          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>سياسة حفظ وحذف البيانات (Data Retention Policy)</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 pl-1">
              <li>تُحفظ المحاضر الرسمية المشفرة لمدة 90 يوماً لأغراض تدقيق السلامة الميدانية.</li>
              <li>لا يتم نقل أو تدريب أي نماذج خارجية على الصوتيات أو المحادثات السرية.</li>
              <li>يحق لرئيس الجلسة أو مدير السلامة (HSE Admin) حذف التسجيلات في أي وقت.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onAccept}
            className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{t.consentAccept}</span>
          </button>
          <button
            onClick={onDecline}
            className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-medium text-xs transition cursor-pointer"
          >
            {t.consentDecline}
          </button>
        </div>
      </div>
    </div>
  );
};

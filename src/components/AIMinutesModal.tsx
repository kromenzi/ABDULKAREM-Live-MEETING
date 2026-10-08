import React, { useState } from 'react';
import {
  X,
  Sparkles,
  FileText,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Language, HSEMeetingContext } from '../types';
import { getTranslation } from '../translations';
import { downloadMeetingMinutes } from '../utils/transcription';

interface AIMinutesModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  transcriptText: string;
  meetingTitle: string;
  attendees: string[];
  hseContext?: HSEMeetingContext;
  lang: Language;
}

export const AIMinutesModal: React.FC<AIMinutesModalProps> = ({
  isOpen,
  onClose,
  roomId,
  transcriptText,
  meetingTitle,
  attendees,
  hseContext,
  lang,
}) => {
  const t = getTranslation(lang);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Array<{ title: string; decisionText: string; approvedBy: string }>>([]);
  const [actionItems, setActionItems] = useState<Array<{ task: string; assignee: string; dueDate: string; priority: string; hseRef?: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; snippet: string }>>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'actions' | 'search'>('summary');

  if (!isOpen) return null;

  const handleGenerateSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText || 'الجلسة تضمنت مراجعة خطط السلامة وإجراءات العزل الميداني.',
          meetingTitle,
          hseContext,
        }),
      });
      const data = await res.json();
      setSummary(data.summary || '');
      setKeyPoints(data.keyPoints || []);
    } catch (err) {
      console.error('Error generating summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractActions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/extract-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText || 'تم الاتفاق على إغلاق تقرير NCR وإسناد فحص الموقع للمهندس المشرف.',
          hseContext,
        }),
      });
      const data = await res.json();
      setDecisions(data.decisions || []);
      setActionItems(data.actionItems || []);
    } catch (err) {
      console.error('Error extracting actions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const docs = [
        { id: '1', title: 'تفريغ الجلسة المباشر', content: transcriptText },
        { id: '2', title: 'الملخص المولد', content: summary },
      ];
      const res = await fetch('/api/ai/search-minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, documents: docs }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Error searching:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFullReport = () => {
    const attendeesMd = attendees.map((a) => `- ${a}`).join('\n');
    const decisionsMd = decisions.map((d) => `### ${d.title}\n> ${d.decisionText}  \n*المعتمد:* ${d.approvedBy}`).join('\n\n');
    const actionsMd = actionItems
      .map((a) => `- **[${a.priority.toUpperCase()}] ${a.task}**  \n  المسؤول: ${a.assignee} | الموعد: ${a.dueDate} | المرجع: ${a.hseRef || 'N/A'}`)
      .join('\n');

    const markdown = `# ${meetingTitle} — محضر اجتماع مجلس الإدارة والسلامة الرسمي
**تاريخ الجلسة:** ${new Date().toLocaleDateString('ar-SA')} | **رمز الغرفة:** \`${roomId}\`  
**المنصة:** ABDULKAREM LIVE MEETING (Enterprise Edition)  

---

## بيانات الامتثال لـ ABDULKAREEM HSE ENTERPRISE
- **الشركة:** ${hseContext?.companyId || 'ABDULKAREEM-HOLDING'}
- **الموقع:** ${hseContext?.siteId || 'MAIN-HQ'}
- **المشروع:** ${hseContext?.projectId || 'PROJECT-01'}
- **رقم تقرير عدم المطابقة (NCR):** \`${hseContext?.ncrNumber || 'None'}\`
- **بلاغ الحادثة المرتبط (Incident):** \`${hseContext?.incidentId || 'None'}\`
- **إجراء تصحيحي وقائي (CAPA):** \`${hseContext?.capaId || 'None'}\`

---

## 1. قائمة الحضور المعتمدة
${attendeesMd || '- الحضور مسجل إلكترونياً'}

---

## 2. الملخص التنفيذي المستخلص بواسطة الذكاء الاصطناعي (Gemini AI)
${summary || 'لم يتم توليد الملخص بعد.'}

### أبرز النقاط الرئيسية:
${keyPoints.map((k) => `- ${k}`).join('\n') || '- لا توجد نقاط محددة.'}

---

## 3. القرارات المعتمدة (Decisions Approved)
${decisionsMd || '_لم تُسجل قرارات رسمية جديدة._'}

---

## 4. الإجراءات المكلفة ومصفوفة CAPA
${actionsMd || '_لا توجد مهام إضافية._'}

---

## 5. التفريغ النصي الكامل للنقاش
\`\`\`
${transcriptText || 'لا يوجد تسجيل صوتي محفوظ'}
\`\`\`

---
*تم توليد هذا التقرير وتوثيقه مشفراً بواسطة نظام ABDULKAREM LIVE MEETING المعتمد*  
*جميع الحقوق محفوظة © ABDULKAREM LIVE MEETING*
`;

    downloadMeetingMinutes(markdown, `hse-meeting-minutes-${roomId}.md`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t.aiExecutiveSummary}</h3>
              <p className="text-xs text-slate-400 font-mono">Gemini 3.8 Flash • Enterprise HSE Suite</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 mt-4 pb-2 border-b border-slate-800/60">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-2 px-4 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'summary' ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t.aiExecutiveSummary}</span>
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`py-2 px-4 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'actions' ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t.aiExtractActions}</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`py-2 px-4 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'search' ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{t.aiSearchMinutes}</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  تحليل التفريغ المباشر واستخلاص القرارات وملخص الجلسة:
                </span>
                <button
                  onClick={handleGenerateSummary}
                  disabled={loading}
                  className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{loading ? t.generatingAi : 'توليد الملخص الآن'}</span>
                </button>
              </div>

              {summary ? (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs leading-relaxed">
                  <div className="font-semibold text-indigo-300">الملخص المستخلص:</div>
                  <p className="text-slate-300">{summary}</p>
                  {keyPoints.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <div className="font-semibold text-slate-300 mb-2">أبرز المحاور:</div>
                      <ul className="list-disc list-inside space-y-1 text-slate-400">
                        {keyPoints.map((p, idx) => (
                          <li key={idx}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500">
                  انقر على زر "توليد الملخص الآن" لاستخدام Gemini في قراءة التفريغ وتلخيص الجلسة.
                </div>
              )}
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  استخراج القرارات المعتمدة ومصفوفة CAPA:
                </span>
                <button
                  onClick={handleExtractActions}
                  disabled={loading}
                  className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{loading ? t.generatingAi : 'استخراج القرارات وCAPA'}</span>
                </button>
              </div>

              {decisions.length > 0 || actionItems.length > 0 ? (
                <div className="space-y-4">
                  {decisions.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>القرارات المعتمدة ({decisions.length})</span>
                      </div>
                      <div className="space-y-2">
                        {decisions.map((d, i) => (
                          <div key={i} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                            <div className="font-semibold text-slate-200">{d.title}</div>
                            <div className="text-slate-400 text-[11px] mt-1">{d.decisionText}</div>
                            <div className="text-[10px] text-emerald-500 mt-1 font-mono">المعتمد: {d.approvedBy}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {actionItems.length > 0 && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>مصفوفة المهام وCAPA ({actionItems.length})</span>
                      </div>
                      <div className="space-y-2">
                        {actionItems.map((a, i) => (
                          <div key={i} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-slate-200">{a.task}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                المسؤول: <span className="text-slate-300">{a.assignee}</span> • الموعد: {a.dueDate}
                              </div>
                            </div>
                            <span className="py-1 px-2.5 rounded-lg bg-amber-500/10 text-amber-400 font-mono text-[10px] border border-amber-500/20">
                              {a.priority.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500">
                  انقر على الزر أعلاه لاستخراج القرارات المعتمدة ومهام CAPA المرتبطة بالسلامة.
                </div>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن كلمة أو موضوع نوقش في الجلسة (مثال: عزل كهربائي، تصريح)..."
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((r, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <div className="font-semibold text-indigo-400">{r.title}</div>
                      <div className="text-slate-300 text-[11px] mt-1 font-mono">{r.snippet}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500">
                  ابحث داخل محاضر وتفريغات الاجتماع لاسترجاع الملاحظات والقرارات السابقة.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            يتطلب مفتاح Gemini API للمعالجة السحابية الفورية.
          </span>
          <button
            onClick={handleDownloadFullReport}
            className="py-2.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>تحميل التقرير الرسمي الشامل (.md)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

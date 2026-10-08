import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Building2,
  MapPin,
  FileSpreadsheet,
  AlertTriangle,
  ClipboardList,
  Check,
} from 'lucide-react';
import { Language, HSEMeetingContext } from '../types';
import { getTranslation } from '../translations';

interface HSEIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  hseContext: HSEMeetingContext;
  onUpdateContext: (ctx: HSEMeetingContext) => void;
  lang: Language;
}

export const HSEIntegrationModal: React.FC<HSEIntegrationModalProps> = ({
  isOpen,
  onClose,
  roomId,
  hseContext,
  onUpdateContext,
  lang,
}) => {
  const t = getTranslation(lang);
  const [formData, setFormData] = useState<HSEMeetingContext>(hseContext);
  const [projects, setProjects] = useState<any[]>([]);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setFormData(hseContext);
  }, [hseContext]);

  useEffect(() => {
    fetch('/api/hse/projects')
      .then((res) => res.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/hse/context/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        onUpdateContext(formData);
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2000);
      }
    } catch (err) {
      console.error('Error saving HSE context:', err);
    }
  };

  const handleSelectProject = (proj: any) => {
    setFormData({
      ...formData,
      companyId: proj.companyId,
      siteId: proj.siteId,
      projectId: proj.id,
      ncrNumber: proj.activeNcrs?.[0]?.number || formData.ncrNumber,
      incidentId: proj.activeIncidents?.[0]?.code || formData.incidentId,
      toolboxTopic: proj.toolboxTopics?.[0] || formData.toolboxTopic,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t.hseSafetyBoard}</h3>
              <p className="text-xs text-slate-400">{t.hseContextTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Project Preset Selector */}
        {projects.length > 0 && (
          <div className="mt-5 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-300">
              اختر مشروعاً مسجلاً في ABDULKAREEM HSE ENTERPRISE للربط المباشر:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProject(p)}
                  className={`p-3 rounded-xl border text-left text-xs transition cursor-pointer ${
                    formData.projectId === p.id
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold">{p.name}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {p.companyId} • {p.siteId}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                الشركة التابعة (Company)
              </label>
              <input
                type="text"
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                الموقع الميداني (Site)
              </label>
              <input
                type="text"
                value={formData.siteId}
                onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                رمز المشروع (Project ID)
              </label>
              <input
                type="text"
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                تصنيف الجلسة
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="safety_committee">لجنة السلامة العليا (Safety Committee)</option>
                <option value="toolbox">لقاء ما قبل الوردية (Toolbox Talk)</option>
                <option value="incident_review">تحقيق ومراجعة الحوادث (Incident Review)</option>
                <option value="audit_ncr">تدقيق تقارير عدم المطابقة (Audit & NCR)</option>
                <option value="general">عام / إدارة العمليات</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                رقم تقرير عدم المطابقة (NCR #)
              </label>
              <input
                type="text"
                placeholder="NCR-2026-..."
                value={formData.ncrNumber || ''}
                onChange={(e) => setFormData({ ...formData, ncrNumber: e.target.value })}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                رمز بلاغ الحادثة (Incident #)
              </label>
              <input
                type="text"
                placeholder="INC-2026-..."
                value={formData.incidentId || ''}
                onChange={(e) => setFormData({ ...formData, incidentId: e.target.value })}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                رمز إجراء CAPA
              </label>
              <input
                type="text"
                placeholder="CAPA-2026-..."
                value={formData.capaId || ''}
                onChange={(e) => setFormData({ ...formData, capaId: e.target.value })}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              موضوع السلامة الميداني (Toolbox Talk Topic)
            </label>
            <input
              type="text"
              placeholder="مثال: سلامة السقالات وتصاريح العمل على المرتفعات..."
              value={formData.toolboxTopic || ''}
              onChange={(e) => setFormData({ ...formData, toolboxTopic: e.target.value })}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-emerald-400 font-mono">
            {savedToast && '✓ تم حفظ وربط بيانات HSE بنجاح!'}
          </span>
          <button
            onClick={handleSave}
            className="py-2.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>حفظ الربط المؤسسي</span>
          </button>
        </div>
      </div>
    </div>
  );
};

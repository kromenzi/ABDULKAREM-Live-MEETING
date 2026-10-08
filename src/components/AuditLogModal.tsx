import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
} from 'lucide-react';
import { AuditLogEntry, Language } from '../types';
import { getTranslation } from '../translations';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  authToken: string;
  lang: Language;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  roomId,
  authToken,
  lang,
}) => {
  const t = getTranslation(lang);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen, roomId, filterAction]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const url = filterAction
        ? `/api/audit-logs?action=${encodeURIComponent(filterAction)}`
        : `/api/audit-logs`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t.auditLogs}</h3>
              <p className="text-xs text-slate-400">توثيق العمليات الحساسة وسجل الوصول الأمني</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadLogs}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="تحديث"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-4 flex items-center gap-2">
          <input
            type="text"
            placeholder="فلترة بالعملية (مثال: USER_JOINED, ROOM_LOCKED, KICKED_PARTICIPANT)..."
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Log Stream */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1">
          {logs.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500">
              لا توجد سجلات تدقيق مسجلة تطابق البحث.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400">
                      {log.action}
                    </span>
                    <span className="py-0.5 px-2 rounded-md bg-slate-800 text-[10px] text-slate-400">
                      {log.actorRole}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 flex items-center gap-2">
                  <span className="text-slate-500">المستخدم:</span>
                  <span className="font-semibold text-slate-200">{log.actorName}</span>
                  <span className="text-slate-500">({log.actorId})</span>
                  {log.ip && <span className="text-slate-500">• IP: {log.ip}</span>}
                </div>

                {log.details && Object.keys(log.details).length > 0 && (
                  <pre className="p-2 rounded-lg bg-slate-900 text-[10px] font-mono text-slate-400 overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Activity, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { NetworkStats, Language } from '../types';
import { getConnectionQualityRating } from '../utils/webrtc';
import { getTranslation } from '../translations';

interface ConnectionQualityBadgeProps {
  stats: NetworkStats | null;
  connectionState: 'connected' | 'connecting' | 'reconnecting' | 'failed' | 'disconnected';
  onTriggerIceRestart: () => void;
  lang: Language;
}

export const ConnectionQualityBadge: React.FC<ConnectionQualityBadgeProps> = ({
  stats,
  connectionState,
  onTriggerIceRestart,
  lang,
}) => {
  const t = getTranslation(lang);
  const [showDetails, setShowDetails] = useState(false);
  const quality = getConnectionQualityRating(stats);

  const getStatusColor = () => {
    if (connectionState === 'reconnecting' || connectionState === 'connecting') return 'bg-amber-500';
    if (connectionState === 'failed' || connectionState === 'disconnected') return 'bg-rose-500';
    if (quality.grade === 'poor') return 'bg-rose-500';
    if (quality.grade === 'fair') return 'bg-amber-400';
    return 'bg-emerald-400';
  };

  return (
    <div className="relative inline-block text-xs">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 backdrop-blur-md transition cursor-pointer"
        title="انقر لعرض تشخيص جودة الشبكة"
      >
        <span className={`w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`} />
        <span className="font-mono text-[11px]">
          {connectionState === 'reconnecting' ? t.connReconnecting : lang === 'ar' ? quality.labelAr : quality.labelEn}
        </span>
        {stats && <span className="text-[10px] text-slate-400 font-mono">{stats.rttMs}ms</span>}
      </button>

      {showDetails && (
        <div className="absolute right-0 bottom-full mb-2 w-64 p-3.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl text-slate-200 backdrop-blur-lg z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-xs flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>تشخيص الاتصال المباشر</span>
            </span>
            <span className={`text-[10px] font-bold ${quality.color}`}>
              {lang === 'ar' ? quality.labelAr : quality.labelEn}
            </span>
          </div>

          <div className="mt-2.5 space-y-1.5 text-[11px] font-mono text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">{t.latency}:</span>
              <span>{stats?.rttMs ?? 0} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.packetLoss}:</span>
              <span>{((stats?.packetLossPercent ?? 0) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.bitrate}:</span>
              <span>{stats?.bitrateKbps ?? 0} kbps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t.resolution}:</span>
              <span>{stats?.resolution ?? '1080p'}</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800">
            <button
              onClick={() => {
                onTriggerIceRestart();
                setShowDetails(false);
              }}
              className="w-full py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t.triggerIceRestart}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

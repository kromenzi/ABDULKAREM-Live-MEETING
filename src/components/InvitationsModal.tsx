import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  KeyRound,
  Copy,
  Check,
  Trash2,
  Clock,
  Shield,
  Layers,
} from 'lucide-react';
import { Role, Invitation, Language } from '../types';
import { getTranslation } from '../translations';

interface InvitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  authToken: string;
  lang: Language;
}

export const InvitationsModal: React.FC<InvitationsModalProps> = ({
  isOpen,
  onClose,
  roomId,
  authToken,
  lang,
}) => {
  const t = getTranslation(lang);
  const [role, setRole] = useState<Role>('participant');
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [maxUses, setMaxUses] = useState(5);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadInvitations();
    }
  }, [isOpen, roomId]);

  const loadInvitations = async () => {
    try {
      const res = await fetch(`/api/invitations?roomCode=${roomId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const handleCreateInvitation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/invitations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          roomCode: roomId,
          role,
          expiresInHours,
          maxUses,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const inv = data.invitation;
        setInvitations([inv, ...invitations]);

        // Copy direct invite link to clipboard
        const inviteUrl = `${window.location.origin}/?room=${roomId}&invite=${inv.token}`;
        await navigator.clipboard.writeText(inviteUrl);
        setCopiedToken(inv.token);
        setTimeout(() => setCopiedToken(null), 3000);
      }
    } catch (err) {
      console.error('Error creating invitation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeInvitation = async (token: string) => {
    try {
      const res = await fetch('/api/invitations/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ inviteToken: token }),
      });
      if (res.ok) {
        setInvitations(
          invitations.map((i) => (i.token === token ? { ...i, isRevoked: true } : i))
        );
      }
    } catch (err) {
      console.error('Error revoking token:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t.createInvite}</h3>
              <p className="text-xs text-slate-400">رموز دخول مشفرة ومحددة الصلاحية والتاريخ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create Token Form */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t.inviteRole}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="participant">{t.roleParticipant}</option>
                <option value="co-host">{t.roleCoHost}</option>
                <option value="hse_officer">{t.roleHseOfficer}</option>
                <option value="hse_manager">{t.roleHseManager}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t.inviteExpiry}
              </label>
              <select
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(parseInt(e.target.value, 10))}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value={1}>1 ساعة</option>
                <option value={6}>6 ساعات</option>
                <option value={24}>24 ساعة (يوم)</option>
                <option value={168}>7 أيام</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t.inviteMaxUses}
              </label>
              <select
                value={maxUses}
                onChange={(e) => setMaxUses(parseInt(e.target.value, 10))}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value={1}>استخدام واحد (1)</option>
                <option value={5}>5 استخدامات</option>
                <option value={20}>20 استخدام</option>
                <option value={100}>100 استخدام</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleCreateInvitation}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>توليد ونسخ رابط الدعوة الآمن</span>
          </button>
        </div>

        {/* Existing Invitations List */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>{t.activeInvites} ({invitations.length})</span>
          </div>

          {invitations.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-slate-800 rounded-xl">
              لا توجد رموز دعوة مولدة حالياً.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    inv.isRevoked
                      ? 'bg-rose-950/20 border-rose-900/40 text-rose-400'
                      : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-300">
                        {inv.token.substring(0, 14)}...
                      </span>
                      <span className="py-0.5 px-2 rounded-md bg-slate-800 text-[10px] text-cyan-400 font-mono">
                        {inv.role.toUpperCase()}
                      </span>
                      {inv.isRevoked && (
                        <span className="py-0.5 px-2 rounded-md bg-rose-500/20 text-[10px] text-rose-400 font-bold">
                          ملغي
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      الاستخدام: {inv.usedCount}/{inv.maxUses} • ينتهي في:{' '}
                      {new Date(inv.expiresAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!inv.isRevoked && (
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/?room=${roomId}&invite=${inv.token}`;
                          navigator.clipboard.writeText(url);
                          setCopiedToken(inv.token);
                          setTimeout(() => setCopiedToken(null), 2000);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        title="نسخ الرابط"
                      >
                        {copiedToken === inv.token ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {!inv.isRevoked && (
                      <button
                        onClick={() => handleRevokeInvitation(inv.token)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                        title="إلغاء الصلاحية"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

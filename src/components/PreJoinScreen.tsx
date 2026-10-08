import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ArrowRight,
  Globe,
  Sparkles,
  Layers,
  Settings,
  Volume2,
  Lock,
  Shield,
  KeyRound,
  Sun,
  Moon,
  Building2,
  LogIn,
  LogOut,
  UserCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  Language,
  VideoQualityPreset,
  AudioQualityPreset,
  VideoFilter,
  AuthUser,
} from '../types';
import { getTranslation } from '../translations';
import {
  createAudioSpectrumDetector,
  getLocalUserMedia,
  playStudioSoundTest,
} from '../utils/webrtc';

interface PreJoinScreenProps {
  roomId: string;
  setRoomId: (id: string) => void;
  displayName: string;
  setDisplayName: (name: string) => void;
  authUser: AuthUser | null;
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onLogout: () => void;
  inviteToken: string;
  setInviteToken: (t: string) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  isCameraOff: boolean;
  setIsCameraOff: (off: boolean) => void;
  onJoin: () => void;
  lang: Language;
  setLang: (l: Language) => void;
  isEmbedded: boolean;
  videoPreset: VideoQualityPreset;
  setVideoPreset: (p: VideoQualityPreset) => void;
  audioPreset: AudioQualityPreset;
  setAudioPreset: (p: AudioQualityPreset) => void;
  videoFilter: VideoFilter;
  setVideoFilter: (f: VideoFilter) => void;
  roomLockedError?: boolean;
  onOpenHseModal?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const PreJoinScreen: React.FC<PreJoinScreenProps> = ({
  roomId,
  setRoomId,
  displayName,
  setDisplayName,
  authUser,
  onLogin,
  onLogout,
  inviteToken,
  setInviteToken,
  isMuted,
  setIsMuted,
  isCameraOff,
  setIsCameraOff,
  onJoin,
  lang,
  setLang,
  isEmbedded,
  videoPreset,
  setVideoPreset,
  audioPreset,
  setAudioPreset,
  videoFilter,
  setVideoFilter,
  roomLockedError,
  onOpenHseModal,
  theme,
  onToggleTheme,
}) => {
  const t = getTranslation(lang);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [eqBands, setEqBands] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [permError, setPermError] = useState(false);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  // Enterprise Login Modal State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Invite token verification status
  const [inviteStatus, setInviteStatus] = useState<{
    checking: boolean;
    valid?: boolean;
    message?: string;
    role?: string;
    companyId?: string;
  }>({ checking: false });

  // Missing credentials error banner
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startPreview = async () => {
      try {
        const s = await getLocalUserMedia(!isCameraOff, !isMuted, videoPreset, audioPreset);
        activeStream = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        console.warn('Failed preview media:', err);
        setPermError(true);
      }
    };

    startPreview();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [videoPreset, audioPreset]);

  // Update tracks when toggled
  useEffect(() => {
    if (!stream) return;
    stream.getVideoTracks().forEach((trk) => {
      trk.enabled = !isCameraOff;
    });
  }, [isCameraOff, stream]);

  useEffect(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((trk) => {
      trk.enabled = !isMuted;
    });
  }, [isMuted, stream]);

  // Audio spectrum detector
  useEffect(() => {
    if (!stream || isMuted) {
      setEqBands([0, 0, 0, 0, 0, 0, 0, 0]);
      return;
    }
    const cleanup = createAudioSpectrumDetector(stream, (bands) => {
      setEqBands(bands);
    });
    return () => cleanup();
  }, [stream, isMuted]);

  // Auto-verify invitation token if provided in URL or typed
  useEffect(() => {
    if (!inviteToken || inviteToken.trim().length < 8) {
      setInviteStatus({ checking: false });
      return;
    }

    let isMounted = true;
    setInviteStatus({ checking: true });

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/invitations/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inviteToken: inviteToken.trim(),
            roomCode: roomId.trim(),
          }),
        });
        const data = await res.json();
        if (!isMounted) return;

        if (res.ok && data.valid && data.invitation) {
          setInviteStatus({
            checking: false,
            valid: true,
            role: data.invitation.role,
            companyId: data.invitation.companyId,
            message: `دعوة صالحة: تم منح رتبة (${data.invitation.role}) للغرفة (${roomId})`,
          });
        } else {
          setInviteStatus({
            checking: false,
            valid: false,
            message: data.error || 'رمز الدعوة غير صالح أو غير مخصص لهذه الغرفة',
          });
        }
      } catch {
        if (isMounted) {
          setInviteStatus({ checking: false, valid: false, message: 'تعذر التحقق من رمز الدعوة' });
        }
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [inviteToken, roomId]);

  const handleToggleMic = () => {
    setIsMuted(!isMuted);
  };

  const handleToggleCam = () => {
    setIsCameraOff(!isCameraOff);
  };

  const generateRandomRoom = () => {
    const randomCode = `board-${Math.random().toString(36).substring(2, 6)}-${Math.floor(100 + Math.random() * 900)}`;
    setRoomId(randomCode);
  };

  const handleSoundTest = () => {
    if (isPlayingTestSound) return;
    setIsPlayingTestSound(true);
    playStudioSoundTest();
    setTimeout(() => setIsPlayingTestSound(false), 800);
  };

  const handlePerformLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmittingLogin(true);

    const result = await onLogin(loginEmail, loginPassword);
    setIsSubmittingLogin(false);

    if (result.success) {
      setIsLoginModalOpen(false);
      setLoginPassword('');
      setJoinError(null);
    } else {
      setLoginError(result.error || 'فشل تسجيل الدخول. تحقق من البريد وكلمة المرور.');
    }
  };

  const fillQuickAccount = (email: string, pass: string) => {
    setLoginEmail(email);
    setLoginPassword(pass);
  };

  const handleAttemptJoin = () => {
    setJoinError(null);
    if (!roomId.trim()) {
      setJoinError(lang === 'ar' ? 'يرجى إدخال اسم الغرفة' : 'Room ID is required');
      return;
    }
    if (!displayName.trim() && !authUser) {
      setJoinError(lang === 'ar' ? 'يرجى إدخال اسمك' : 'Display name is required');
      return;
    }
    // P0 Constraint: Must have either verified login session or a valid inviteToken
    if (!authUser && !inviteToken.trim()) {
      setJoinError(
        lang === 'ar'
          ? 'تنبيه أمني: يتطلب الانضمام تسجيل الدخول المؤسسي المعتمد أو إدخال رمز دعوة صالح خاص بهذه الغرفة.'
          : 'Security Requirement: Joining requires either Enterprise Authentication or a valid Room Invitation Token.'
      );
      return;
    }

    onJoin();
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen transition-colors duration-200 flex flex-col justify-between ${
        isDark
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100'
          : 'bg-gradient-to-br from-slate-100 via-sky-50/40 to-slate-200 text-slate-900'
      }`}
    >
      {/* Top Header Bar */}
      <header
        className={`w-full border-b backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30 transition-colors ${
          isDark ? 'border-slate-800/80 bg-slate-950/70' : 'border-slate-200 bg-white/75'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/25">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {t.appTitle}
            </h1>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>نظام الاجتماعات المؤسسي فائق الدقة والأمان</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-emerald-400 font-medium">Enterprise Hardened</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className={`p-2.5 rounded-xl border transition cursor-pointer ${
              isDark
                ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-amber-400'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm'
            }`}
            title="تبديل المظهر"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Language Switch */}
          <button
            type="button"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
              isDark
                ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          {/* Authentication Badge or Login Button */}
          {authUser ? (
            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 ${
                  isDark
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold">{authUser.displayName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 uppercase font-mono">
                  {authUser.role}
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="p-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs transition cursor-pointer"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-sky-600/30 transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>تسجيل الدخول المؤسسي</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Preview Box */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div
              className={`relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl border transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-800 shadow-sky-950/20'
                  : 'bg-slate-900 border-slate-300 shadow-slate-300/60'
              }`}
            >
              {isCameraOff ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3">
                  <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800">
                    <VideoOff className="w-10 h-10 text-slate-500" />
                  </div>
                  <span className="text-sm font-medium">
                    {lang === 'ar' ? 'الكاميرا مغلقة' : 'Camera is off'}
                  </span>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover mirror ${
                    videoFilter === 'studio-warm'
                      ? 'contrast-105 saturate-125'
                      : videoFilter === 'cool-clean'
                        ? 'hue-rotate-15'
                        : videoFilter === 'vibrant'
                          ? 'saturate-150'
                          : ''
                  }`}
                />
              )}

              {/* Status Badges */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-xl bg-slate-950/85 backdrop-blur-md text-[10px] font-bold text-emerald-400 border border-slate-800">
                  {videoPreset === '4k' ? '4K 60FPS' : videoPreset === '1080p' ? '1080p 60FPS' : '720p HD'}
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-slate-950/85 backdrop-blur-md text-[10px] font-bold text-sky-400 border border-slate-800">
                  48kHz STUDIO
                </span>
              </div>

              {/* Live Audio Spectrum Equalizer */}
              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2.5 bg-slate-950/85 px-3.5 py-2 rounded-2xl backdrop-blur-md border border-slate-800">
                {isMuted ? (
                  <MicOff className="w-4 h-4 text-rose-500" />
                ) : (
                  <Mic className="w-4 h-4 text-emerald-400" />
                )}
                {/* 8 frequency bars */}
                <div className="flex items-end gap-1 h-4">
                  {eqBands.map((band, i) => (
                    <div
                      key={i}
                      className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                      style={{ height: `${Math.max(2, (band / 100) * 16)}px` }}
                    />
                  ))}
                </div>
              </div>

              {/* Quick toggle controls over video */}
              <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={`p-3 rounded-2xl transition cursor-pointer ${
                    isMuted
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                      : 'bg-slate-950/80 hover:bg-slate-900 text-slate-200 border border-slate-800 backdrop-blur-md'
                  }`}
                  title={isMuted ? t.unmuteMic : t.muteMic}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                </button>
                <button
                  type="button"
                  onClick={handleToggleCam}
                  className={`p-3 rounded-2xl transition cursor-pointer ${
                    isCameraOff
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                      : 'bg-slate-950/80 hover:bg-slate-900 text-slate-200 border border-slate-800 backdrop-blur-md'
                  }`}
                  title={isCameraOff ? t.startVideo : t.stopVideo}
                >
                  {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-sky-400" />}
                </button>
              </div>
            </div>

            {permError && (
              <p className="mt-3 text-xs text-amber-500 text-center max-w-md">
                {t.cameraPermissionError}
              </p>
            )}
          </div>

          {/* Right Form & Room Controls Box */}
          <div
            className={`lg:col-span-5 rounded-3xl p-6 sm:p-7 shadow-xl backdrop-blur-sm space-y-4 border ${
              isDark
                ? 'bg-slate-900/60 border-slate-800/80'
                : 'bg-white border-slate-200 shadow-slate-200/50'
            }`}
          >
            <div>
              <h2 className={`text-xl font-bold mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {t.readyToJoin}
              </h2>
              <p className="text-xs text-slate-400">
                {authUser
                  ? `جلسة موثقة: ${authUser.companyId} (${authUser.role})`
                  : 'جلسة مقيدة — تتطلب المصادقة أو رمز دعوة'}
              </p>
            </div>

            {roomLockedError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-400 flex items-center gap-2.5 animate-in fade-in duration-200">
                <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{t.meetingLockedNotice}</span>
              </div>
            )}

            {joinError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-400 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{joinError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAttemptJoin();
              }}
              className="space-y-3.5"
            >
              {/* Room ID input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {t.roomIdLabel}
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomRoom}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{t.newMeeting}</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder={t.roomIdPlaceholder}
                  className={`w-full rounded-xl px-4 py-2.5 text-sm font-mono border focus:outline-none transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-sky-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500'
                  }`}
                />
              </div>

              {/* Display name input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {t.yourName}
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t.yourNamePlaceholder}
                  disabled={!!authUser}
                  className={`w-full rounded-xl px-4 py-2.5 text-sm border focus:outline-none transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-sky-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500'
                  } ${authUser ? 'opacity-70 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* Verified Identity Badge OR Invite Token Input */}
              {authUser ? (
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                    isDark
                      ? 'bg-slate-950/80 border-slate-800 text-slate-300'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold flex items-center gap-2">
                        <span>هوية معتمدة: {authUser.role}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                          Verified
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {authUser.companyId}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    تبديل الحساب
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                      <span>رمز الدعوة للغرفة (Invitation Token)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsLoginModalOpen(true)}
                      className="text-xs text-sky-400 hover:text-sky-300 underline font-medium cursor-pointer"
                    >
                      أو تسجيل الدخول
                    </button>
                  </div>
                  <input
                    type="text"
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    placeholder="inv_..."
                    className={`w-full rounded-xl px-3 py-2 text-xs font-mono border focus:outline-none transition ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-cyan-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-500'
                    }`}
                  />
                  {inviteStatus.checking && (
                    <p className="text-[11px] text-sky-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                      جاري فحص صلاحية الدعوة...
                    </p>
                  )}
                  {!inviteStatus.checking && inviteStatus.valid === true && (
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {inviteStatus.message}
                    </p>
                  )}
                  {!inviteStatus.checking && inviteStatus.valid === false && (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {inviteStatus.message}
                    </p>
                  )}
                </div>
              )}

              {/* Quality Preset Selectors */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-1 block">
                    {t.videoPresetLabel}
                  </label>
                  <select
                    value={videoPreset}
                    onChange={(e) => setVideoPreset(e.target.value as VideoQualityPreset)}
                    className={`w-full rounded-xl px-2.5 py-2 text-xs border focus:outline-none ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-sky-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500'
                    }`}
                  >
                    <option value="1080p">{t.preset1080p}</option>
                    <option value="4k">{t.preset4k}</option>
                    <option value="720p">{t.preset720p}</option>
                    <option value="auto">{t.presetAuto}</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-1 block">
                    {t.audioDspLabel}
                  </label>
                  <select
                    value={audioPreset}
                    onChange={(e) => setAudioPreset(e.target.value as AudioQualityPreset)}
                    className={`w-full rounded-xl px-2.5 py-2 text-xs border focus:outline-none ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-sky-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500'
                    }`}
                  >
                    <option value="studio">{lang === 'ar' ? 'صوت استوديو 48kHz' : '48kHz Studio'}</option>
                    <option value="speech">{lang === 'ar' ? 'فلترة نطق بالذكاء الاصطناعي' : 'AI Speech Isolation'}</option>
                    <option value="music">{lang === 'ar' ? 'صوت عالي الدقة بدون ضغط' : 'Lossless Audio'}</option>
                  </select>
                </div>
              </div>

              {/* Sound Test Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSoundTest}
                  disabled={isPlayingTestSound}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer ${
                    isDark
                      ? 'bg-slate-950/60 hover:bg-slate-900 border-slate-800 text-slate-300'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <Volume2 className={`w-3.5 h-3.5 ${isPlayingTestSound ? 'text-sky-400 animate-bounce' : ''}`} />
                  <span>
                    {isPlayingTestSound
                      ? lang === 'ar'
                        ? 'جاري تشغيل نغمة الاستوديو...'
                        : 'Playing Studio Tone...'
                      : lang === 'ar'
                        ? 'اختبار صوت الاستوديو 48kHz'
                        : 'Test 48kHz Studio Audio'}
                  </span>
                </button>
              </div>

              {/* Submit Join Button */}
              <button
                type="submit"
                className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-400 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-sky-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] cursor-pointer"
              >
                <span>{t.joinMeeting}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Enterprise Sign-In Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md rounded-3xl p-6 sm:p-7 border shadow-2xl space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">تسجيل الدخول المؤسسي المعتمد</h3>
                  <p className="text-xs text-slate-400">تحقق الهوية والصلاحيات على الخادم (P0 Auth)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handlePerformLogin} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  البريد الإلكتروني المؤسسي (Corporate Email)
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@abdulkarem.com"
                  className={`w-full rounded-xl px-3 py-2 text-sm border focus:outline-none ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-sky-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  كلمة المرور المشفرة (Encrypted Password)
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={`w-full rounded-xl px-3 py-2 text-sm border focus:outline-none ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-sky-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500'
                  }`}
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLogin}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/30 flex items-center gap-1.5 transition"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isSubmittingLogin ? 'جاري التحقق...' : 'تسجيل الدخول'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

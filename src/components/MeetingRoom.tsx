import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Hand,
  MessageSquare,
  Users,
  Settings,
  PhoneOff,
  Code,
  Globe,
  Maximize,
  Minimize,
  Copy,
  Check,
  Disc,
  StopCircle,
  LayoutGrid,
  Keyboard,
  Layers,
  RotateCcw,
  Subtitles,
  ShieldAlert,
  FileText,
  Building2,
  Sparkles,
  KeyRound,
  FileCode,
  Sun,
  Moon,
  Shield,
  Activity,
} from 'lucide-react';
import {
  Participant,
  ChatMessage,
  Language,
  VideoQualityPreset,
  AudioQualityPreset,
  VideoFilter,
  NetworkStats,
  WaitingGuest,
  Role,
  HSEMeetingContext,
} from '../types';
import { VideoTile } from './VideoTile';
import { ChatPanel } from './ChatPanel';
import { ParticipantsPanel } from './ParticipantsPanel';
import { EmbedModal } from './EmbedModal';
import { SettingsModal } from './SettingsModal';
import { ShortcutsModal } from './ShortcutsModal';
import { BreakoutModal } from './BreakoutModal';
import { LiveCaptionsBar } from './LiveCaptionsBar';
import { HostControlsModal } from './HostControlsModal';
import { AIMinutesModal } from './AIMinutesModal';
import { HSEIntegrationModal } from './HSEIntegrationModal';
import { InvitationsModal } from './InvitationsModal';
import { AuditLogModal } from './AuditLogModal';
import { ConnectionQualityBadge } from './ConnectionQualityBadge';
import { getTranslation } from '../translations';

interface MeetingRoomProps {
  roomId: string;
  localParticipant: Participant;
  remoteParticipants: Participant[];
  currentPeerId: string;
  currentUserRole: Role;
  authToken: string;
  isMuted: boolean;
  onToggleMute: () => void;
  isCameraOff: boolean;
  onToggleCamera: () => void;
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;
  isHandRaised: boolean;
  onToggleHandRaise: () => void;
  onLeave: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  hasSimulatedPeer: boolean;
  onToggleSimulatedPeer: () => void;
  lang: Language;
  setLang: (l: Language) => void;
  isEmbedded: boolean;
  onSwitchDevice?: (kind: 'videoinput' | 'audioinput', deviceId: string) => void;
  videoPreset: VideoQualityPreset;
  setVideoPreset: (p: VideoQualityPreset) => void;
  audioPreset: AudioQualityPreset;
  setAudioPreset: (p: AudioQualityPreset) => void;
  videoFilter: VideoFilter;
  setVideoFilter: (f: VideoFilter) => void;
  networkStats: NetworkStats | null;
  connectionState: 'connected' | 'connecting' | 'reconnecting' | 'failed' | 'disconnected';
  onTriggerIceRestart: () => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  isNoiseSuppressionEnabled: boolean;
  onToggleNoiseSuppression: () => void;
  isInsideBreakout: boolean;
  currentBreakoutName: string | null;
  mainRoomId: string;
  onReturnToMain: () => void;
  onSendMoveToRoom: (targetPeerId: string, targetRoomId: string, breakoutName: string) => void;
  onRecallAllToMain: () => void;
  isHost: boolean;
  isLocked: boolean;
  waitingRoomEnabled: boolean;
  waitingGuests: WaitingGuest[];
  onAdmitGuest: (peerId: string) => void;
  onDenyGuest: (peerId: string) => void;
  onMuteAll: () => void;
  onKickParticipant: (peerId: string) => void;
  onToggleLockRoom: (locked: boolean) => void;
  onToggleWaitingRoom: (enabled: boolean) => void;
  isLiveCaptionsEnabled: boolean;
  onToggleLiveCaptions: () => void;
  liveCaptionSpeaker: string;
  liveCaptionText: string;
  transcriptLogText: string;
  onExportMinutes: () => void;
  hseContext: HSEMeetingContext;
  onUpdateHseContext: (ctx: HSEMeetingContext) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  roomId,
  localParticipant,
  remoteParticipants,
  currentPeerId,
  currentUserRole,
  authToken,
  isMuted,
  onToggleMute,
  isCameraOff,
  onToggleCamera,
  isScreenSharing,
  onToggleScreenShare,
  isHandRaised,
  onToggleHandRaise,
  onLeave,
  messages,
  onSendMessage,
  hasSimulatedPeer,
  onToggleSimulatedPeer,
  lang,
  setLang,
  isEmbedded,
  onSwitchDevice,
  videoPreset,
  setVideoPreset,
  audioPreset,
  setAudioPreset,
  videoFilter,
  setVideoFilter,
  networkStats,
  connectionState,
  onTriggerIceRestart,
  isRecording,
  onToggleRecording,
  isNoiseSuppressionEnabled,
  onToggleNoiseSuppression,
  isInsideBreakout,
  currentBreakoutName,
  mainRoomId,
  onReturnToMain,
  onSendMoveToRoom,
  onRecallAllToMain,
  isHost,
  isLocked,
  waitingRoomEnabled,
  waitingGuests,
  onAdmitGuest,
  onDenyGuest,
  onMuteAll,
  onKickParticipant,
  onToggleLockRoom,
  onToggleWaitingRoom,
  isLiveCaptionsEnabled,
  onToggleLiveCaptions,
  liveCaptionSpeaker,
  liveCaptionText,
  transcriptLogText,
  onExportMinutes,
  hseContext,
  onUpdateHseContext,
  theme,
  onToggleTheme,
}) => {
  const t = getTranslation(lang);

  // Layout & UI states
  const [layoutMode, setLayoutMode] = useState<'grid' | 'speaker'>('grid');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isBreakoutModalOpen, setIsBreakoutModalOpen] = useState(false);
  const [isHostControlsOpen, setIsHostControlsOpen] = useState(false);
  const [isAiMinutesOpen, setIsAiMinutesOpen] = useState(false);
  const [isHseModalOpen, setIsHseModalOpen] = useState(false);
  const [isInvitationsOpen, setIsInvitationsOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'm':
          e.preventDefault();
          onToggleMute();
          showToast(isMuted ? t.micActiveToast : t.micMutedToast);
          break;
        case 'c':
          e.preventDefault();
          onToggleCamera();
          showToast(isCameraOff ? t.camStartedToast : t.camStoppedToast);
          break;
        case 's':
          e.preventDefault();
          onToggleScreenShare();
          showToast(isScreenSharing ? t.screenShareStoppedToast : t.screenShareActiveToast);
          break;
        case 'h':
          e.preventDefault();
          onToggleHandRaise();
          showToast(isHandRaised ? t.handLoweredToast : t.handRaisedToast);
          break;
        case 'g':
          e.preventDefault();
          setLayoutMode((prev) => (prev === 'grid' ? 'speaker' : 'grid'));
          showToast(layoutMode === 'grid' ? t.speakerLayoutActiveToast : t.gridLayoutActiveToast);
          break;
        case 't':
          e.preventDefault();
          setIsChatOpen((prev) => !prev);
          break;
        case 'p':
          e.preventDefault();
          setIsParticipantsOpen((prev) => !prev);
          break;
        case '?':
          e.preventDefault();
          setIsShortcutsOpen(true);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isCameraOff,
    isHandRaised,
    isMuted,
    isScreenSharing,
    layoutMode,
    onToggleCamera,
    onToggleHandRaise,
    onToggleMute,
    onToggleScreenShare,
    showToast,
    t,
  ]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore
    }
  };

  const allParticipants = [localParticipant, ...remoteParticipants];

  const pinnedParticipant = pinnedPeerId
    ? allParticipants.find((p) => p.peerId === pinnedPeerId) || allParticipants[0]
    : allParticipants[0];

  const isDark = theme === 'dark';

  return (
    <div
      ref={containerRef}
      className={`relative w-screen h-screen flex flex-col overflow-hidden select-none transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Reconnecting Banner */}
      {connectionState === 'reconnecting' && (
        <div className="z-50 bg-amber-500 text-slate-950 py-1.5 px-4 text-xs font-bold flex items-center justify-center gap-2 animate-pulse shadow-md">
          <Activity className="w-4 h-4 animate-spin" />
          <span>{t.connReconnecting}</span>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-2 rounded-2xl bg-slate-900/90 border border-slate-700 text-slate-100 text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <header
        className={`flex items-center justify-between px-3 sm:px-6 z-20 backdrop-blur-md border-b transition-all ${
          isDark ? 'bg-slate-950/85 border-slate-800' : 'bg-white/85 border-slate-200 shadow-sm'
        } ${isEmbedded ? 'py-2' : 'py-3'}`}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-sm sm:text-base tracking-tight hidden sm:inline">
              ABDULKAREM BOARD
            </span>
            <span className="text-slate-400 hidden sm:inline">&middot;</span>
            <span className="font-medium text-xs sm:text-sm font-mono truncate max-w-[120px] sm:max-w-xs text-slate-400">
              {roomId}
            </span>
          </div>

          {/* Role badge */}
          <span className="py-0.5 px-2.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider bg-slate-800 text-cyan-400 border border-slate-700">
            {currentUserRole === 'host' ? '👑 HOST' : currentUserRole === 'co-host' ? '🛡️ CO-HOST' : currentUserRole === 'hse_officer' ? '🦺 HSE' : currentUserRole.toUpperCase()}
          </span>

          {/* HSE Project Context Link */}
          <button
            onClick={() => setIsHseModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/30 text-emerald-400 border border-emerald-800/40 text-xs font-semibold hover:bg-emerald-900/40 transition cursor-pointer"
            title={t.hseContextTitle}
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{hseContext.projectId || 'HSE Context'}</span>
          </button>

          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs border transition cursor-pointer ${
              isDark ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
            title={t.copyLink}
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? t.linkCopied : t.copyLink}</span>
          </button>

          {/* Connection Quality Diagnostic Badge */}
          <ConnectionQualityBadge
            stats={networkStats}
            connectionState={connectionState}
            onTriggerIceRestart={onTriggerIceRestart}
            lang={lang}
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Recording Badge */}
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>{t.recBadge}</span>
            </div>
          )}

          {/* Secure Invitations Button */}
          {(currentUserRole === 'host' || currentUserRole === 'co-host' || currentUserRole === 'admin') && (
            <button
              onClick={() => setIsInvitationsOpen(true)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
              title={t.createInvite}
            >
              <KeyRound className="w-4 h-4" />
              <span className="hidden lg:inline">{t.createInvite}</span>
            </button>
          )}

          {/* Audit Logs Button */}
          {(currentUserRole === 'host' || currentUserRole === 'admin') && (
            <button
              onClick={() => setIsAuditLogOpen(true)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
              title={t.auditLogs}
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden lg:inline">{t.auditLogs}</span>
            </button>
          )}

          {/* AI Minutes & HSE Report Generator */}
          <button
            onClick={() => setIsAiMinutesOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
            title={t.aiExecutiveSummary}
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="hidden md:inline">Gemini AI</span>
          </button>

          {/* Grid Layout Toggle Button */}
          <button
            onClick={() => {
              setLayoutMode(layoutMode === 'grid' ? 'speaker' : 'grid');
              showToast(layoutMode === 'grid' ? t.speakerLayoutActiveToast : t.gridLayoutActiveToast);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              layoutMode === 'grid'
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title={`${layoutMode === 'grid' ? t.speakerMode : t.gridMode} (G)`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{layoutMode === 'grid' ? t.gridMode : t.speakerMode}</span>
          </button>

          {/* Breakout Rooms */}
          <button
            onClick={() => setIsBreakoutModalOpen(true)}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              isInsideBreakout
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title={t.breakoutRooms}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
          </button>

          {/* Embed in board button */}
          <button
            onClick={() => setIsEmbedModalOpen(true)}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
            title={t.embedInBoard}
          >
            <Code className="w-4 h-4 text-sky-400" />
          </button>

          {/* Dark / Light Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
            title={t.themeToggle}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>

          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition flex items-center gap-1 cursor-pointer"
            title={t.toggleLanguage}
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] font-semibold">{lang === 'en' ? 'AR' : 'EN'}</span>
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer hidden sm:block"
            title={`${isFullscreen ? t.exitFullScreen : t.fullScreen} (F)`}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Breakout Room Indicator & Return to Main Action */}
      {isInsideBreakout && (
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-indigo-800/80 px-4 py-2 flex items-center justify-between text-xs text-indigo-200 z-20 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span className="font-semibold">
              {t.inBreakoutNotice}: <span className="text-white font-bold">{currentBreakoutName}</span>
            </span>
          </div>
          <button
            onClick={onReturnToMain}
            className="py-1 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 shadow-md shadow-indigo-950 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.returnToMain}</span>
          </button>
        </div>
      )}

      {/* Main Video Stage Area */}
      <div className="relative flex-1 flex overflow-hidden">
        <main className="flex-1 relative flex flex-col p-2 sm:p-4 overflow-hidden">
          {layoutMode === 'speaker' ? (
            <div className="flex-1 flex flex-col lg:flex-row gap-3 h-full overflow-hidden">
              <div className="flex-1 h-full min-h-0 rounded-3xl overflow-hidden shadow-2xl relative bg-slate-900">
                <VideoTile
                  participant={pinnedParticipant}
                  isLocal={pinnedParticipant.peerId === currentPeerId}
                  isPinned={true}
                  onTogglePin={() => setPinnedPeerId(null)}
                  lang={lang}
                  videoFilter={pinnedParticipant.peerId === currentPeerId ? videoFilter : 'none'}
                />
              </div>

              {allParticipants.length > 1 && (
                <div className="flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-y-auto lg:w-64 max-h-48 lg:max-h-full shrink-0 pr-1">
                  {allParticipants
                    .filter((p) => p.peerId !== pinnedParticipant.peerId)
                    .map((p) => (
                      <div
                        key={p.peerId}
                        className="w-44 lg:w-full aspect-video rounded-2xl overflow-hidden shrink-0 border border-slate-800 cursor-pointer shadow-md"
                        onClick={() => setPinnedPeerId(p.peerId)}
                      >
                        <VideoTile
                          participant={p}
                          isLocal={p.peerId === currentPeerId}
                          isPinned={false}
                          onTogglePin={() => setPinnedPeerId(p.peerId)}
                          lang={lang}
                          videoFilter={p.peerId === currentPeerId ? videoFilter : 'none'}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div
              className={`flex-1 grid gap-2.5 sm:gap-4 h-full min-h-0 ${
                allParticipants.length === 1
                  ? 'grid-cols-1'
                  : allParticipants.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : allParticipants.length <= 4
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : allParticipants.length <= 6
                  ? 'grid-cols-2 md:grid-cols-3'
                  : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
              }`}
            >
              {allParticipants.map((p) => (
                <VideoTile
                  key={p.peerId}
                  participant={p}
                  isLocal={p.peerId === currentPeerId}
                  isPinned={false}
                  onTogglePin={() => {
                    setPinnedPeerId(p.peerId);
                    setLayoutMode('speaker');
                  }}
                  lang={lang}
                  videoFilter={p.peerId === currentPeerId ? videoFilter : 'none'}
                />
              ))}
            </div>
          )}
        </main>

        {/* Chat Drawer */}
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={messages}
          onSendMessage={onSendMessage}
          currentPeerId={currentPeerId}
          lang={lang}
        />

        {/* Participants Drawer */}
        <ParticipantsPanel
          isOpen={isParticipantsOpen}
          onClose={() => setIsParticipantsOpen(false)}
          participants={allParticipants}
          currentPeerId={currentPeerId}
          hasSimulatedPeer={hasSimulatedPeer}
          onToggleSimulatedPeer={onToggleSimulatedPeer}
          lang={lang}
        />
      </div>

      {/* Bottom Controls Bar */}
      <footer className="z-20 py-2.5 sm:py-3 px-3 sm:px-4 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-center">
        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-center">
          {/* Mute/Unmute */}
          <button
            onClick={onToggleMute}
            className={`p-2.5 sm:p-3 rounded-2xl transition flex items-center justify-center cursor-pointer ${
              isMuted
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
            title={`${isMuted ? t.unmuteMic : t.muteMic} (M)`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-400" />}
          </button>

          {/* Camera Start/Stop */}
          <button
            onClick={onToggleCamera}
            className={`p-2.5 sm:p-3 rounded-2xl transition flex items-center justify-center cursor-pointer ${
              isCameraOff
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
            title={`${isCameraOff ? t.startVideo : t.stopVideo} (C)`}
          >
            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5 text-sky-400" />}
          </button>

          {/* Ultra HD Screen Share */}
          <button
            onClick={onToggleScreenShare}
            className={`p-2.5 sm:p-3 rounded-2xl transition flex items-center justify-center cursor-pointer ${
              isScreenSharing
                ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
            title={`${isScreenSharing ? t.stopScreen : t.shareScreen} (S)`}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Local Meeting Recorder */}
          <button
            onClick={onToggleRecording}
            className={`p-2.5 sm:p-3 rounded-2xl transition flex items-center justify-center cursor-pointer ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
            title={isRecording ? t.stopRecord : t.recordMeeting}
          >
            {isRecording ? <StopCircle className="w-5 h-5" /> : <Disc className="w-5 h-5 text-rose-400" />}
          </button>

          {/* Raise Hand */}
          <button
            onClick={onToggleHandRaise}
            className={`p-2.5 sm:p-3 rounded-2xl transition flex items-center justify-center cursor-pointer ${
              isHandRaised
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold shadow-lg shadow-amber-400/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
            title={`${isHandRaised ? t.lowerHand : t.raiseHand} (H)`}
          >
            <Hand className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-slate-800 mx-1 hidden sm:block" />

          {/* Chat Drawer Toggle */}
          <button
            onClick={() => {
              setIsChatOpen(!isChatOpen);
              if (isParticipantsOpen) setIsParticipantsOpen(false);
            }}
            className={`relative p-2.5 sm:p-3 rounded-2xl transition flex items-center justify-center cursor-pointer ${
              isChatOpen ? 'bg-sky-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
            title={`${t.chat} (T)`}
          >
            <MessageSquare className="w-5 h-5" />
            {messages.length > 0 && !isChatOpen && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-sky-500 text-slate-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                {messages.length}
              </span>
            )}
          </button>

          {/* Participants Toggle */}
          <button
            onClick={() => {
              setIsParticipantsOpen(!isParticipantsOpen);
              if (isChatOpen) setIsChatOpen(false);
            }}
            className={`relative p-2.5 sm:p-3 rounded-2xl transition flex items-center justify-center cursor-pointer ${
              isParticipantsOpen ? 'bg-sky-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
            title={`${t.participants} (P)`}
          >
            <Users className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 bg-slate-700 text-slate-200 text-[10px] font-bold rounded-full flex items-center justify-center">
              {allParticipants.length}
            </span>
          </button>

          {/* Live AI Captions */}
          <button
            onClick={onToggleLiveCaptions}
            className={`p-2.5 sm:p-3 rounded-2xl transition flex items-center justify-center cursor-pointer ${
              isLiveCaptionsEnabled
                ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
            title={t.liveCaptions}
          >
            <Subtitles className={`w-5 h-5 ${isLiveCaptionsEnabled ? 'text-white' : 'text-sky-400'}`} />
          </button>

          {/* Host Controls */}
          <button
            onClick={() => setIsHostControlsOpen(true)}
            className={`relative p-2.5 sm:p-3 rounded-2xl transition flex items-center justify-center cursor-pointer ${
              isHost
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
            }`}
            title={t.hostControls}
          >
            <ShieldAlert className="w-5 h-5" />
            {waitingGuests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {waitingGuests.length}
              </span>
            )}
          </button>

          {/* Studio Settings */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2.5 sm:p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition flex items-center justify-center cursor-pointer"
            title={t.settings}
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Leave Call */}
          <button
            onClick={onLeave}
            className="px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition flex items-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer ml-1"
            title={t.leave}
          >
            <PhoneOff className="w-5 h-5" />
            <span className="text-xs sm:text-sm">{t.leave}</span>
          </button>
        </div>
      </footer>

      {/* Floating Components & Modals */}
      <LiveCaptionsBar
        speakerName={liveCaptionSpeaker}
        text={liveCaptionText}
        isOpen={isLiveCaptionsEnabled}
      />

      <EmbedModal
        roomId={roomId}
        isOpen={isEmbedModalOpen}
        onClose={() => setIsEmbedModalOpen(false)}
        lang={lang}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        lang={lang}
        videoPreset={videoPreset}
        setVideoPreset={setVideoPreset}
        audioPreset={audioPreset}
        setAudioPreset={setAudioPreset}
        videoFilter={videoFilter}
        setVideoFilter={setVideoFilter}
        networkStats={networkStats}
        onSwitchDevice={onSwitchDevice}
        isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
        onToggleNoiseSuppression={onToggleNoiseSuppression}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        lang={lang}
      />

      <BreakoutModal
        isOpen={isBreakoutModalOpen}
        onClose={() => setIsBreakoutModalOpen(false)}
        participants={remoteParticipants}
        currentPeerId={currentPeerId}
        isInsideBreakout={isInsideBreakout}
        onSendMoveToRoom={onSendMoveToRoom}
        onRecallAllToMain={onRecallAllToMain}
        mainRoomId={mainRoomId}
        lang={lang}
      />

      <HostControlsModal
        isOpen={isHostControlsOpen}
        onClose={() => setIsHostControlsOpen(false)}
        waitingGuests={waitingGuests}
        participants={allParticipants}
        currentPeerId={currentPeerId}
        isLocked={isLocked}
        waitingRoomEnabled={waitingRoomEnabled}
        onAdmitGuest={onAdmitGuest}
        onDenyGuest={onDenyGuest}
        onMuteAll={onMuteAll}
        onKickParticipant={onKickParticipant}
        onToggleLockRoom={onToggleLockRoom}
        onToggleWaitingRoom={onToggleWaitingRoom}
        onExportMinutes={onExportMinutes}
        lang={lang}
      />

      {/* AI Minutes Modal */}
      <AIMinutesModal
        isOpen={isAiMinutesOpen}
        onClose={() => setIsAiMinutesOpen(false)}
        roomId={roomId}
        transcriptText={transcriptLogText}
        meetingTitle={`Board Meeting - ${roomId}`}
        attendees={allParticipants.map((p) => p.displayName)}
        hseContext={hseContext}
        lang={lang}
      />

      {/* HSE Integration Modal */}
      <HSEIntegrationModal
        isOpen={isHseModalOpen}
        onClose={() => setIsHseModalOpen(false)}
        roomId={roomId}
        hseContext={hseContext}
        onUpdateContext={onUpdateHseContext}
        lang={lang}
      />

      {/* Invitations Modal */}
      <InvitationsModal
        isOpen={isInvitationsOpen}
        onClose={() => setIsInvitationsOpen(false)}
        roomId={roomId}
        authToken={authToken}
        lang={lang}
      />

      {/* Audit Log Modal */}
      <AuditLogModal
        isOpen={isAuditLogOpen}
        onClose={() => setIsAuditLogOpen(false)}
        roomId={roomId}
        authToken={authToken}
        lang={lang}
      />
    </div>
  );
};

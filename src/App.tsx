/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ABDULKAREM LIVE MEETING — ENTERPRISE UPGRADE
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Participant,
  ChatMessage,
  SignalingMessage,
  Language,
  VideoQualityPreset,
  AudioQualityPreset,
  VideoFilter,
  NetworkStats,
  WaitingGuest,
  Role,
  AuthUser,
  HSEMeetingContext,
} from './types';
import { PreJoinScreen } from './components/PreJoinScreen';
import { MeetingRoom } from './components/MeetingRoom';
import { WaitingRoomScreen } from './components/WaitingRoomScreen';
import { ConsentModal } from './components/ConsentModal';
import { HSEIntegrationModal } from './components/HSEIntegrationModal';
import {
  RTC_CONFIGURATION,
  getLocalUserMedia,
  createSyntheticStream,
  optimizeSenderBitrates,
  enhanceOpusSdp,
  MeetingRecorder,
  getPeerStats,
  createNoiseSuppressedTrack,
  NoiseSuppressionController,
  applyAdaptiveBitrate,
  fetchEnterpriseTurnConfig,
  performIceRestart,
  setupDeviceChangeWatcher,
} from './utils/webrtc';
import {
  LiveTranscriber,
  TranscriptItem,
  generateMeetingMinutesMarkdown,
  downloadMeetingMinutes,
} from './utils/transcription';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialRoom =
    urlParams.get('room') ||
    window.location.pathname.replace(/^\/room\//, '').replace(/^\//, '') ||
    'board-meeting';
  const initialEmbed = urlParams.get('embed') === '1' || urlParams.get('embed') === 'true';
  const initialName = urlParams.get('name') || '';
  const initialInvite = urlParams.get('invite') || '';
  const initialLang: Language = urlParams.get('lang') === 'ar' ? 'ar' : 'en';

  const [roomId, setRoomId] = useState(initialRoom);
  const [displayName, setDisplayName] = useState(
    initialName || `Eng-Abdulkarem-${Math.floor(100 + Math.random() * 900)}`
  );
  const [inviteToken, setInviteToken] = useState<string>(initialInvite);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [isEmbedded] = useState(initialEmbed);
  const [lang, setLang] = useState<Language>(initialLang);

  // Authentication State (JWT P0)
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('abdulkarem_enterprise_session');
      if (saved) {
        const u = JSON.parse(saved);
        if (u.token && u.exp > Date.now() / 1000) return u;
      }
    } catch {}
    return null;
  });
  const [authToken, setAuthToken] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('abdulkarem_enterprise_session');
      if (saved) {
        const u = JSON.parse(saved);
        if (u.token && u.exp > Date.now() / 1000) return u.token;
      }
    } catch {}
    return '';
  });

  // Effective Role strictly derived from verified AuthUser or invite token assignment
  const userRole: Role = authUser ? authUser.role : 'participant';

  // HSE Enterprise Context (Safety Board Phase 6)
  const [hseContext, setHseContext] = useState<HSEMeetingContext>({
    companyId: authUser?.companyId || 'ABDULKAREEM-HOLDING',
    category: 'general',
  });
  const [isHseModalOpen, setIsHseModalOpen] = useState(false);

  // Connection State & Stability (P1)
  const [connectionState, setConnectionState] = useState<
    'connected' | 'connecting' | 'reconnecting' | 'failed' | 'disconnected'
  >('disconnected');
  const [iceConfig, setIceConfig] = useState<RTCConfiguration>(RTC_CONFIGURATION);

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('abdulkarem_theme') as 'dark' | 'light') || 'dark';
  });

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('abdulkarem_theme', next);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Quality & Studio Enhancements
  const [videoPreset, setVideoPreset] = useState<VideoQualityPreset>('1080p');
  const [audioPreset, setAudioPreset] = useState<AudioQualityPreset>('studio');
  const [videoFilter, setVideoFilter] = useState<VideoFilter>('none');
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);

  // Breakout Rooms state
  const [mainRoomId, setMainRoomId] = useState<string>(initialRoom);
  const [currentBreakoutName, setCurrentBreakoutName] = useState<string | null>(null);
  const [isInsideBreakout, setIsInsideBreakout] = useState(false);

  // Host & Security State (P0)
  const [isHost, setIsHost] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(false);
  const [isInWaitingRoom, setIsInWaitingRoom] = useState(false);
  const [waitingGuests, setWaitingGuests] = useState<WaitingGuest[]>([]);
  const [roomLockedError, setRoomLockedError] = useState(false);

  // Consent Modal state (Phase 4 & 5)
  const [hasConsent, setHasConsent] = useState(false);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [pendingConsentAction, setPendingConsentAction] = useState<(() => void) | null>(null);

  // Live Captions & Minutes State
  const [isLiveCaptionsEnabled, setIsLiveCaptionsEnabled] = useState(false);
  const [liveCaptionSpeaker, setLiveCaptionSpeaker] = useState('');
  const [liveCaptionText, setLiveCaptionText] = useState('');
  const [transcriptLog, setTranscriptLog] = useState<TranscriptItem[]>([]);
  const transcriberRef = useRef<LiveTranscriber | null>(null);
  const captionClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const meetingStartTimeRef = useRef<number>(Date.now());

  // Noise Suppression state
  const [isNoiseSuppressionEnabled, setIsNoiseSuppressionEnabled] = useState(true);
  const rawAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const noiseSuppressionControllerRef = useRef<NoiseSuppressionController | null>(null);

  // Local media state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MeetingRecorder>(new MeetingRecorder());

  // Peer & Stream references
  const [currentPeerId] = useState(
    () => `peer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  );
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  // Remote participants & Connections
  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>([]);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Chat messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Simulation peer
  const [hasSimulatedPeer, setHasSimulatedPeer] = useState(false);
  const simulatedStreamRef = useRef<MediaStream | null>(null);

  // Load Ephemeral TURN Configuration at boot
  useEffect(() => {
    fetchEnterpriseTurnConfig(authToken || undefined).then((cfg) => {
      setIceConfig(cfg);
    });
  }, [authToken]);

  // Listen for device changes (P1)
  useEffect(() => {
    const cleanup = setupDeviceChangeWatcher((devices) => {
      console.log('Audio/Video hardware device configuration updated:', devices.length);
    });
    return cleanup;
  }, []);

  // Verified Enterprise Authentication (P0 #1, #2, #3)
  const handleLogin = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, error: res.status === 401 ? 'يتطلب النشر تسجيل دخول Vercel أو أن خادم المصادقة غير متصل.' : `استجابة غير صالحة من الخادم (${res.status})` };
      }
      const data = await res.json() as { user?: any; error?: string };
      if (res.ok && data.user) {
        setAuthUser(data.user);
        setAuthToken(data.user.token);
        setDisplayName(data.user.displayName);
        localStorage.setItem('abdulkarem_enterprise_session', JSON.stringify(data.user));
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid email or password' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Authentication service error' };
    }
  }, []);

  const handleLogout = useCallback(() => {
    setAuthUser(null);
    setAuthToken('');
    localStorage.removeItem('abdulkarem_enterprise_session');
  }, []);

  // Periodic network stats diagnostic polling & Adaptive Bitrate adjustment
  useEffect(() => {
    if (!isInMeeting) return;

    const interval = setInterval(async () => {
      const firstPc = peerConnectionsRef.current.values().next().value;
      if (firstPc) {
        const stats = await getPeerStats(firstPc);
        if (stats) {
          setNetworkStats(stats);
          applyAdaptiveBitrate(firstPc, stats.rttMs, stats.packetLossPercent);
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isInMeeting]);

  // Apply bitrate optimization whenever presets change
  useEffect(() => {
    peerConnectionsRef.current.forEach((pc) => {
      optimizeSenderBitrates(pc, videoPreset, audioPreset);
    });
  }, [videoPreset, audioPreset]);

  // Send signaling message
  const sendSignal = useCallback((message: SignalingMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Update status changes
  const broadcastStatus = useCallback(
    (updates: Partial<Participant>) => {
      sendSignal({
        type: 'status-update',
        ...updates,
      });
    },
    [sendSignal]
  );

  // Trigger ICE restart for all active peer connections
  const handleTriggerIceRestart = useCallback(() => {
    peerConnectionsRef.current.forEach((pc, targetPeerId) => {
      performIceRestart(pc, sendSignal, targetPeerId);
    });
  }, [sendSignal]);

  // Create or retrieve PeerConnection for a specific remote peer
  const getOrCreatePeerConnection = useCallback(
    (peerId: string) => {
      let pc = peerConnectionsRef.current.get(peerId);
      if (pc) return pc;

      pc = new RTCPeerConnection(iceConfig);
      peerConnectionsRef.current.set(peerId, pc);

      // Handle ICE Connection state changes
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          console.warn(`ICE connection state for ${peerId} changed to ${pc.iceConnectionState}. Triggering ICE restart.`);
          performIceRestart(pc, sendSignal, peerId);
        }
      };

      // Add local media tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc!.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle remote tracks
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) return;

        setRemoteParticipants((prev) =>
          prev.map((p) => {
            if (p.peerId === peerId) {
              return { ...p, stream: remoteStream, connectionState: 'connected' };
            }
            return p;
          })
        );
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            type: 'signal-candidate',
            to: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // Apply initial studio bitrates
      optimizeSenderBitrates(pc, videoPreset, audioPreset);

      return pc;
    },
    [audioPreset, iceConfig, sendSignal, videoPreset]
  );

  // Switch peer RTC connections and state to a different room (Breakout feature)
  const switchPeerToRoom = useCallback(
    (targetRoom: string, breakoutName: string | null = null) => {
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      setRemoteParticipants([]);
      setMessages([]);

      setRoomId(targetRoom);
      if (targetRoom === mainRoomId) {
        setIsInsideBreakout(false);
        setCurrentBreakoutName(null);
      } else {
        setIsInsideBreakout(true);
        setCurrentBreakoutName(breakoutName || targetRoom);
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'join-room',
            roomId: targetRoom,
            peerId: currentPeerId,
            displayName,
            isMuted,
            isCameraOff,
          })
        );
      }
    },
    [authToken, currentPeerId, displayName, isCameraOff, isMuted, mainRoomId]
  );

  // Connect WebSocket & join room with JWT Authentication (P0)
  const connectAndJoin = useCallback(async () => {
    try {
      setRoomLockedError(false);
      setConnectionState('connecting');

      // 1. Require verified token or invitation token (P0 #1, #2, #3)
      const token = authToken;
      if (!token && !inviteToken) {
        setRoomLockedError(true);
        setConnectionState('disconnected');
        return;
      }

      // 2. Get local user media stream
      const stream = await getLocalUserMedia(
        !isCameraOff,
        !isMuted,
        videoPreset,
        audioPreset
      );
      localStreamRef.current = stream;

      const rawAudio = stream.getAudioTracks()[0];
      if (rawAudio) {
        rawAudioTrackRef.current = rawAudio;
        if (isNoiseSuppressionEnabled) {
          const controller = createNoiseSuppressedTrack(rawAudio);
          if (controller) {
            noiseSuppressionControllerRef.current = controller;
            stream.removeTrack(rawAudio);
            stream.addTrack(controller.processedTrack);
          }
        }
      }

      // 3. Connect WebSocket without putting credentials in URLs or join payloads.
      const configuredApiBase = import.meta.env.VITE_API_BASE_URL || 'https://abdulkarem-live-meeting.onrender.com';
      const wsUrl = configuredApiBase
        ? `${configuredApiBase.replace(/^http/, 'ws')}/ws`
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected');
        if (token) ws.send(JSON.stringify({ type: 'auth-token', token }));
        else ws.send(JSON.stringify({ type: 'join-room', roomId, peerId: currentPeerId, displayName, inviteToken: inviteToken || undefined, isMuted, isCameraOff }));
      };

      ws.onmessage = async (event) => {
        try {
          const data: SignalingMessage = JSON.parse(event.data);

          switch (data.type) {
            case 'auth-error': {
              console.error('Authentication Error from server:', data.error);
              setRoomLockedError(true);
              handleLeave();
              break;
            }

            case 'auth-success': {
              ws.send(JSON.stringify({ type: 'join-room', roomId, peerId: currentPeerId, displayName: authUser?.displayName || displayName, inviteToken: inviteToken || undefined, isMuted, isCameraOff }));
              break;
            }

            case 'room-joined': {
              setIsHost(!!data.isHost);
              setIsLocked(!!data.isLocked);
              setWaitingRoomEnabled(!!data.waitingRoomEnabled);
              setIsInWaitingRoom(false);
              setIsInMeeting(true);
              setConnectionState('connected');
              meetingStartTimeRef.current = Date.now();

              if (data.participants) {
                const initialRemote: Participant[] = data.participants.map((p) => ({
                  ...p,
                  connectionState: 'connected',
                }));
                setRemoteParticipants(initialRemote);

                for (const participant of data.participants) {
                  const pc = getOrCreatePeerConnection(participant.peerId);
                  const offer = await pc.createOffer();
                  if (offer.sdp) {
                    offer.sdp = enhanceOpusSdp(offer.sdp);
                  }
                  await pc.setLocalDescription(offer);
                  sendSignal({
                    type: 'signal-offer',
                    to: participant.peerId,
                    offer,
                  });
                }
              }
              break;
            }

            case 'waiting-in-lobby': {
              setIsInWaitingRoom(true);
              setIsInMeeting(false);
              break;
            }

            case 'lobby-knock': {
              if (data.peerId) {
                setWaitingGuests((prev) => [
                  ...prev.filter((g) => g.peerId !== data.peerId),
                  { peerId: data.peerId!, displayName: data.displayName || 'Guest', role: data.role },
                ]);
              }
              break;
            }

            case 'lobby-admitted': {
              setIsInWaitingRoom(false);
              setIsInMeeting(true);
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                  JSON.stringify({
                    type: 'join-room',
                    roomId,
                    peerId: currentPeerId,
                    displayName,
                    isMuted,
                    isCameraOff,
                  })
                );
              }
              break;
            }

            case 'lobby-denied': {
              setIsInWaitingRoom(false);
              handleLeave();
              break;
            }

            case 'room-locked': {
              setRoomLockedError(true);
              setIsInWaitingRoom(false);
              handleLeave();
              break;
            }

            case 'room-lock-status': {
              setIsLocked(!!data.isLocked);
              break;
            }

            case 'waiting-room-status': {
              setWaitingRoomEnabled(!!data.enabled);
              break;
            }

            case 'muted-by-host': {
              setIsMuted(true);
              if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach((t) => {
                  t.enabled = false;
                });
              }
              broadcastStatus({ isMuted: true });
              break;
            }

            case 'kicked-by-host': {
              handleLeave();
              break;
            }

            case 'live-caption': {
              if (data.text) {
                setLiveCaptionSpeaker(data.speakerName || 'Participant');
                setLiveCaptionText(data.text);
                setTranscriptLog((prev) => [
                  ...prev,
                  {
                    id: `tc-${Date.now()}-${Math.random()}`,
                    speakerName: data.senderName || 'Participant',
                    text: data.text!,
                    timestamp: Date.now(),
                  },
                ]);
                if (captionClearTimeoutRef.current) clearTimeout(captionClearTimeoutRef.current);
                captionClearTimeoutRef.current = setTimeout(() => setLiveCaptionText(''), 4500);
              }
              break;
            }

            case 'user-joined': {
              if (data.peerId) {
                const newPeer: Participant = {
                  peerId: data.peerId,
                  displayName: data.displayName || 'Guest',
                  role: data.role || 'participant',
                  isMuted: !!data.isMuted,
                  isCameraOff: !!data.isCameraOff,
                  isScreenSharing: !!data.isScreenSharing,
                  isHandRaised: !!data.isHandRaised,
                  isHost: !!data.isHost,
                  connectionState: 'connected',
                };
                setRemoteParticipants((prev) => {
                  if (prev.some((p) => p.peerId === data.peerId)) return prev;
                  return [...prev, newPeer];
                });
              }
              break;
            }

            case 'user-left': {
              if (data.peerId) {
                const pc = peerConnectionsRef.current.get(data.peerId);
                if (pc) {
                  pc.close();
                  peerConnectionsRef.current.delete(data.peerId);
                }
                setRemoteParticipants((prev) => prev.filter((p) => p.peerId !== data.peerId));
              }
              break;
            }

            case 'signal-offer': {
              if (data.from && data.offer) {
                const pc = getOrCreatePeerConnection(data.from);
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await pc.createAnswer();
                if (answer.sdp) {
                  answer.sdp = enhanceOpusSdp(answer.sdp);
                }
                await pc.setLocalDescription(answer);
                sendSignal({
                  type: 'signal-answer',
                  to: data.from,
                  answer,
                });
              }
              break;
            }

            case 'signal-answer': {
              if (data.from && data.answer) {
                const pc = peerConnectionsRef.current.get(data.from);
                if (pc) {
                  await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
              }
              break;
            }

            case 'signal-candidate': {
              if (data.from && data.candidate) {
                const pc = peerConnectionsRef.current.get(data.from);
                if (pc) {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
              }
              break;
            }

            case 'peer-status-updated': {
              if (data.peerId) {
                setRemoteParticipants((prev) =>
                  prev.map((p) => {
                    if (p.peerId === data.peerId) {
                      return {
                        ...p,
                        isMuted: data.isMuted !== undefined ? data.isMuted : p.isMuted,
                        isCameraOff: data.isCameraOff !== undefined ? data.isCameraOff : p.isCameraOff,
                        isScreenSharing: data.isScreenSharing !== undefined ? data.isScreenSharing : p.isScreenSharing,
                        isHandRaised: data.isHandRaised !== undefined ? data.isHandRaised : p.isHandRaised,
                        displayName: data.displayName || p.displayName,
                      };
                    }
                    return p;
                  })
                );
              }
              break;
            }

            case 'chat-message': {
              if (data.id && data.text) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: data.id!,
                    from: data.from || 'anonymous',
                    senderName: data.senderName || 'Anonymous',
                    senderRole: data.senderRole,
                    text: data.text!,
                    timestamp: data.timestamp || Date.now(),
                  },
                ]);
              }
              break;
            }

            case 'move-to-room': {
              if (data.targetRoomId) {
                switchPeerToRoom(data.targetRoomId, data.breakoutName || null);
              }
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.error('Error handling signaling message:', err);
        }
      };

      ws.onerror = () => {
        setConnectionState('reconnecting');
      };

      ws.onclose = () => {
        if (isInMeeting) {
          setConnectionState('reconnecting');
          // Auto-reconnect after 2 seconds
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting automatic meeting reconnection...');
            connectAndJoin();
          }, 2000);
        } else {
          setConnectionState('disconnected');
        }
      };
    } catch (err) {
      console.error('Connection initiation failed:', err);
      setConnectionState('failed');
    }
  }, [
    audioPreset,
    authToken,
    authUser,
    broadcastStatus,
    currentPeerId,
    displayName,
    getOrCreatePeerConnection,
    inviteToken,
    isCameraOff,
    isInMeeting,
    isMuted,
    isNoiseSuppressionEnabled,
    roomId,
    sendSignal,
    switchPeerToRoom,
    userRole,
    videoPreset,
  ]);

  // Clean leave
  const handleLeave = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (captionClearTimeoutRef.current) clearTimeout(captionClearTimeoutRef.current);

    if (transcriberRef.current) {
      transcriberRef.current.stop();
      transcriberRef.current = null;
    }

    if (recorderRef.current.isRecording) {
      recorderRef.current.stop();
    }
    setIsRecording(false);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (noiseSuppressionControllerRef.current) {
      noiseSuppressionControllerRef.current.cleanup();
      noiseSuppressionControllerRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsInMeeting(false);
    setIsInWaitingRoom(false);
    setConnectionState('disconnected');
    setRemoteParticipants([]);
    setMessages([]);
    setIsScreenSharing(false);
    setLiveCaptionText('');
  };

  // Safe wrapper for features requiring explicit consent
  const executeWithConsent = (action: () => void) => {
    if (hasConsent) {
      action();
    } else {
      setPendingConsentAction(() => action);
      setIsConsentModalOpen(true);
    }
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }
    broadcastStatus({ isMuted: nextMuted });
  };

  // Toggle Camera
  const handleToggleCamera = () => {
    const nextCameraOff = !isCameraOff;
    setIsCameraOff(nextCameraOff);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !nextCameraOff;
      });
    }
    broadcastStatus({ isCameraOff: nextCameraOff });
  };

  // Toggle Screen Sharing
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }

      if (originalVideoTrackRef.current && localStreamRef.current) {
        const currentTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentTrack) {
          localStreamRef.current.removeTrack(currentTrack);
        }
        localStreamRef.current.addTrack(originalVideoTrackRef.current);

        peerConnectionsRef.current.forEach((pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(originalVideoTrackRef.current);
          }
        });
      }

      setIsScreenSharing(false);
      broadcastStatus({ isScreenSharing: false });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920, max: 3840 },
            height: { ideal: 1080, max: 2160 },
            frameRate: { ideal: 60, max: 60 },
          },
          audio: true,
        });

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        if (localStreamRef.current) {
          const cameraTrack = localStreamRef.current.getVideoTracks()[0];
          if (cameraTrack) {
            originalVideoTrackRef.current = cameraTrack;
            localStreamRef.current.removeTrack(cameraTrack);
          }
          localStreamRef.current.addTrack(screenTrack);
        }

        peerConnectionsRef.current.forEach((pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          }
        });

        screenTrack.onended = () => {
          handleToggleScreenShare();
        };

        setIsScreenSharing(true);
        broadcastStatus({ isScreenSharing: true });
      } catch (err) {
        console.warn('Screen sharing cancelled or failed:', err);
      }
    }
  };

  // Toggle Hand Raise
  const handleToggleHandRaise = () => {
    const nextHand = !isHandRaised;
    setIsHandRaised(nextHand);
    broadcastStatus({ isHandRaised: nextHand });
  };

  // Send Chat message
  const handleSendMessage = (text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat-message',
          text,
        })
      );
    }
  };

  // Toggle Recording with consent check
  const handleToggleRecording = () => {
    executeWithConsent(() => {
      if (isRecording) {
        recorderRef.current.stop();
        setIsRecording(false);
      } else {
        if (localStreamRef.current) {
          recorderRef.current.start(localStreamRef.current);
          setIsRecording(true);
        }
      }
    });
  };

  // Toggle Live Captions with consent check
  const handleToggleLiveCaptions = () => {
    executeWithConsent(() => {
      if (isLiveCaptionsEnabled) {
        if (transcriberRef.current) {
          transcriberRef.current.stop();
          transcriberRef.current = null;
        }
        setIsLiveCaptionsEnabled(false);
        setLiveCaptionText('');
      } else {
        const transcriber = new LiveTranscriber(lang, (text) => {
          setLiveCaptionSpeaker(displayName);
          setLiveCaptionText(text);
          setTranscriptLog((prev) => [
            ...prev,
            {
              id: `tc-${Date.now()}-${Math.random()}`,
              speakerName: displayName,
              text,
              timestamp: Date.now(),
            },
          ]);
          sendSignal({
            type: 'live-caption',
            speakerName: displayName,
            text,
          });
        });

        const started = transcriber.start();
        if (started) {
          transcriberRef.current = transcriber;
          setIsLiveCaptionsEnabled(true);
        }
      }
    });
  };

  // Host Controls Handlers
  const handleAdmitGuest = (targetPeerId: string) => {
    sendSignal({
      type: 'admit-user',
      targetPeerId,
      roomId,
    });
    setWaitingGuests((prev) => prev.filter((g) => g.peerId !== targetPeerId));
  };

  const handleDenyGuest = (targetPeerId: string) => {
    sendSignal({
      type: 'deny-user',
      targetPeerId,
      roomId,
    });
    setWaitingGuests((prev) => prev.filter((g) => g.peerId !== targetPeerId));
  };

  const handleMuteAll = () => {
    sendSignal({ type: 'mute-all' });
  };

  const handleKickParticipant = (targetPeerId: string) => {
    sendSignal({
      type: 'kick-user',
      targetPeerId,
    });
  };

  const handleToggleLockRoom = (locked: boolean) => {
    sendSignal({
      type: 'lock-room',
      isLocked: locked,
    });
  };

  const handleToggleWaitingRoom = (enabled: boolean) => {
    sendSignal({
      type: 'toggle-waiting-room',
      enabled,
    });
  };

  // Breakout Rooms handlers
  const handleSendMoveToRoom = (targetPeerId: string, targetRoomId: string, breakoutName: string) => {
    sendSignal({
      type: 'move-to-room',
      targetPeerId,
      targetRoomId,
      breakoutName,
      mainRoomId,
    });
  };

  const handleRecallAllToMain = () => {
    sendSignal({
      type: 'move-to-room',
      targetRoomId: mainRoomId,
      breakoutName: mainRoomId,
      mainRoomId,
    });
  };

  // Simulated peer toggle
  const handleToggleSimulatedPeer = () => {
    if (hasSimulatedPeer) {
      setRemoteParticipants((prev) => prev.filter((p) => p.peerId !== 'simulated-colleague-1'));
      if (simulatedStreamRef.current) {
        simulatedStreamRef.current.getTracks().forEach((t) => t.stop());
        simulatedStreamRef.current = null;
      }
      setHasSimulatedPeer(false);
    } else {
      const simStream = createSyntheticStream('Eng. Tariq (HSE Auditor)');
      simulatedStreamRef.current = simStream;
      const simParticipant: Participant = {
        peerId: 'simulated-colleague-1',
        displayName: 'Eng. Tariq (HSE Auditor)',
        role: 'hse_officer',
        isMuted: false,
        isCameraOff: false,
        isScreenSharing: false,
        isHandRaised: false,
        stream: simStream,
        connectionState: 'connected',
      };
      setRemoteParticipants((prev) => [...prev, simParticipant]);
      setHasSimulatedPeer(true);
    }
  };

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${secs}s`;
  };

  const handleExportMinutes = () => {
    const attendeesNames = [
      displayName,
      ...remoteParticipants.map((p) => p.displayName),
    ];
    const markdown = generateMeetingMinutesMarkdown({
      meetingTitle: `Board Meeting - ${roomId}`,
      roomId,
      date: new Date().toLocaleDateString('ar-SA'),
      durationFormatted: formatDuration(Date.now() - meetingStartTimeRef.current),
      attendees: attendeesNames,
      transcript: transcriptLog,
    });
    downloadMeetingMinutes(markdown, `board-minutes-${roomId}.md`);
  };

  const transcriptLogText = transcriptLog.map((t) => `[${t.speakerName}]: ${t.text}`).join('\n');

  return (
    <>
      {isInWaitingRoom ? (
        <WaitingRoomScreen roomId={roomId} displayName={displayName} onCancel={handleLeave} lang={lang} />
      ) : isInMeeting ? (
        <MeetingRoom
          roomId={roomId}
          localParticipant={{
            peerId: currentPeerId,
            displayName,
            role: userRole,
            isMuted,
            isCameraOff,
            isScreenSharing,
            isHandRaised,
            stream: localStreamRef.current || undefined,
            connectionState: 'connected',
          }}
          remoteParticipants={remoteParticipants}
          currentPeerId={currentPeerId}
          currentUserRole={userRole}
          authToken={authToken}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          isCameraOff={isCameraOff}
          onToggleCamera={handleToggleCamera}
          isScreenSharing={isScreenSharing}
          onToggleScreenShare={handleToggleScreenShare}
          isHandRaised={isHandRaised}
          onToggleHandRaise={handleToggleHandRaise}
          onLeave={handleLeave}
          messages={messages}
          onSendMessage={handleSendMessage}
          hasSimulatedPeer={hasSimulatedPeer}
          onToggleSimulatedPeer={handleToggleSimulatedPeer}
          lang={lang}
          setLang={setLang}
          isEmbedded={isEmbedded}
          videoPreset={videoPreset}
          setVideoPreset={setVideoPreset}
          audioPreset={audioPreset}
          setAudioPreset={setAudioPreset}
          videoFilter={videoFilter}
          setVideoFilter={setVideoFilter}
          networkStats={networkStats}
          connectionState={connectionState}
          onTriggerIceRestart={handleTriggerIceRestart}
          isRecording={isRecording}
          onToggleRecording={handleToggleRecording}
          isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
          onToggleNoiseSuppression={() => setIsNoiseSuppressionEnabled(!isNoiseSuppressionEnabled)}
          isInsideBreakout={isInsideBreakout}
          currentBreakoutName={currentBreakoutName}
          mainRoomId={mainRoomId}
          onReturnToMain={() => switchPeerToRoom(mainRoomId)}
          onSendMoveToRoom={handleSendMoveToRoom}
          onRecallAllToMain={handleRecallAllToMain}
          isHost={isHost}
          isLocked={isLocked}
          waitingRoomEnabled={waitingRoomEnabled}
          waitingGuests={waitingGuests}
          onAdmitGuest={handleAdmitGuest}
          onDenyGuest={handleDenyGuest}
          onMuteAll={handleMuteAll}
          onKickParticipant={handleKickParticipant}
          onToggleLockRoom={handleToggleLockRoom}
          onToggleWaitingRoom={handleToggleWaitingRoom}
          isLiveCaptionsEnabled={isLiveCaptionsEnabled}
          onToggleLiveCaptions={handleToggleLiveCaptions}
          liveCaptionSpeaker={liveCaptionSpeaker}
          liveCaptionText={liveCaptionText}
          transcriptLogText={transcriptLogText}
          onExportMinutes={handleExportMinutes}
          hseContext={hseContext}
          onUpdateHseContext={setHseContext}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
      ) : (
        <PreJoinScreen
          roomId={roomId}
          setRoomId={setRoomId}
          displayName={displayName}
          setDisplayName={setDisplayName}
          authUser={authUser}
          onLogin={handleLogin}
          onLogout={handleLogout}
          inviteToken={inviteToken}
          setInviteToken={setInviteToken}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          isCameraOff={isCameraOff}
          setIsCameraOff={setIsCameraOff}
          onJoin={connectAndJoin}
          lang={lang}
          setLang={setLang}
          isEmbedded={isEmbedded}
          videoPreset={videoPreset}
          setVideoPreset={setVideoPreset}
          audioPreset={audioPreset}
          setAudioPreset={setAudioPreset}
          videoFilter={videoFilter}
          setVideoFilter={setVideoFilter}
          roomLockedError={roomLockedError}
          onOpenHseModal={() => setIsHseModalOpen(true)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
      )}

      {/* Explicit Consent Modal for Recording / AI Transcription */}
      <ConsentModal
        isOpen={isConsentModalOpen}
        onAccept={() => {
          setHasConsent(true);
          setIsConsentModalOpen(false);
          if (pendingConsentAction) {
            pendingConsentAction();
            setPendingConsentAction(null);
          }
        }}
        onDecline={() => {
          setIsConsentModalOpen(false);
          setPendingConsentAction(null);
        }}
        lang={lang}
      />

      {/* Standalone HSE Safety Board Integration Modal on PreJoin */}
      <HSEIntegrationModal
        isOpen={isHseModalOpen}
        onClose={() => setIsHseModalOpen(false)}
        roomId={roomId}
        hseContext={hseContext}
        onUpdateContext={setHseContext}
        lang={lang}
      />
    </>
  );
}

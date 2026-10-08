/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role =
  | 'host'
  | 'co-host'
  | 'participant'
  | 'hse_officer'
  | 'hse_manager'
  | 'admin';

export interface AuthUser {
  id: string;
  username?: string;
  email?: string;
  displayName: string;
  role: Role;
  companyId?: string;
  siteId?: string;
  projectId?: string;
  token: string;
  exp: number;
}

export interface Participant {
  peerId: string;
  userId?: string;
  displayName: string;
  role: Role;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isHost?: boolean;
  stream?: MediaStream;
  connectionState?: 'connected' | 'connecting' | 'reconnecting' | 'failed' | 'disconnected';
  networkStats?: NetworkStats | null;
}

export interface ChatMessage {
  id: string;
  from: string;
  senderName: string;
  senderRole?: Role;
  text: string;
  timestamp: number;
}

export interface Invitation {
  id: string;
  roomCode: string;
  token: string;
  role: Role;
  expiresAt: number;
  isRevoked: boolean;
  maxUses: number;
  usedCount: number;
  createdBy: string;
  createdAt: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetId?: string;
  details?: Record<string, any>;
  ip?: string;
}

export interface HSEMeetingContext {
  companyId: string;
  siteId?: string;
  projectId?: string;
  ncrNumber?: string;
  incidentId?: string;
  capaId?: string;
  toolboxTopic?: string;
  category: 'toolbox' | 'incident_review' | 'audit_ncr' | 'safety_committee' | 'general';
}

export interface DecisionItem {
  id: string;
  title: string;
  decisionText: string;
  approvedBy: string;
  status: 'approved' | 'pending' | 'rejected';
  timestamp: number;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed';
  hseRef?: string;
}

export interface MeetingRecord {
  id: string;
  roomCode: string;
  title: string;
  hostId: string;
  companyId: string;
  status: 'scheduled' | 'active' | 'ended';
  isLocked: boolean;
  waitingRoomEnabled: boolean;
  hseContext?: HSEMeetingContext;
  createdAt: number;
  decisions: DecisionItem[];
  actionItems: ActionItem[];
  minutesMarkdown?: string;
  aiSummary?: string;
}

export interface SignalingMessage {
  type:
    | 'auth-token'
    | 'auth-success'
    | 'auth-error'
    | 'join-room'
    | 'room-joined'
    | 'user-joined'
    | 'user-left'
    | 'signal-offer'
    | 'signal-answer'
    | 'signal-candidate'
    | 'ice-restart-offer'
    | 'status-update'
    | 'peer-status-updated'
    | 'chat-message'
    | 'move-to-room'
    | 'lobby-knock'
    | 'waiting-in-lobby'
    | 'lobby-admitted'
    | 'lobby-denied'
    | 'admit-user'
    | 'deny-user'
    | 'mute-all'
    | 'muted-by-host'
    | 'kick-user'
    | 'kicked-by-host'
    | 'lock-room'
    | 'room-locked'
    | 'room-lock-status'
    | 'toggle-waiting-room'
    | 'waiting-room-status'
    | 'live-caption'
    | 'ping'
    | 'pong'
    | 'role-update';
  token?: string;
  roomId?: string;
  peerId?: string;
  userId?: string;
  role?: Role;
  targetPeerId?: string;
  targetRoomId?: string;
  breakoutName?: string;
  mainRoomId?: string;
  initiatorName?: string;
  displayName?: string;
  isHost?: boolean;
  isLocked?: boolean;
  waitingRoomEnabled?: boolean;
  enabled?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isScreenSharing?: boolean;
  isHandRaised?: boolean;
  participants?: Array<{
    peerId: string;
    userId?: string;
    displayName: string;
    role: Role;
    isMuted: boolean;
    isCameraOff: boolean;
    isScreenSharing: boolean;
    isHandRaised: boolean;
    isHost?: boolean;
  }>;
  to?: string;
  from?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  senderName?: string;
  speakerName?: string;
  senderRole?: Role;
  text?: string;
  id?: string;
  timestamp?: number;
  error?: string;
  inviteToken?: string;
}

export type Language = 'en' | 'ar';

export type VideoQualityPreset = '4k' | '1080p' | '720p' | 'auto';

export type AudioQualityPreset = 'studio' | 'speech' | 'music';

export type VideoFilter = 'none' | 'studio-warm' | 'cool-clean' | 'low-light-boost' | 'vibrant';

export interface NetworkStats {
  resolution: string;
  frameRate: number;
  bitrateKbps: number;
  packetLossPercent: number;
  rttMs: number;
  jitterMs?: number;
}

export interface BreakoutRoomGroup {
  id: string;
  name: string;
  peerIds: string[];
}

export interface WaitingGuest {
  peerId: string;
  displayName: string;
  role?: Role;
  joinedAt?: number;
}

export interface TurnServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceServersResponse {
  iceServers: TurnServerConfig[];
  ttlSeconds: number;
  expiresAt: number;
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ABDULKAREM LIVE MEETING — PERSISTENT SQL DATABASE LAYER (SQLite / Supabase Ready)
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  MeetingRecord,
  Invitation,
  ChatMessage,
  DecisionItem,
  ActionItem,
  AuditLogEntry,
  HSEMeetingContext,
  Role,
} from '../types';
import { hashPassword } from './auth';

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  displayName: string;
  role: Role;
  companyId: string;
  siteId?: string;
  createdAt: number;
}

export interface CompanyRecord {
  id: string;
  name: string;
  createdAt: number;
}

export interface ProjectRecord {
  id: string;
  name: string;
  companyId: string;
  siteId: string;
  createdAt: number;
}

class PersistentDatabase {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const resolvedPath = dbPath || path.join(dataDir, 'enterprise_meetings.sqlite');
    this.db = new DatabaseSync(resolvedPath);
    this.initSchema();
    // Demo identities and organizations are never provisioned in production.
    if (process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_SEED === 'true') {
      this.seedDefaultData();
    }
  }

  private initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        company_id TEXT NOT NULL,
        site_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        company_id TEXT NOT NULL,
        site_id TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS meeting_cohosts (
        meeting_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        assigned_at INTEGER NOT NULL,
        PRIMARY KEY (meeting_id, user_id),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        room_code TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        host_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        is_locked INTEGER NOT NULL DEFAULT 0,
        waiting_room_enabled INTEGER NOT NULL DEFAULT 0,
        hse_context_json TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS invitations (
        id TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        company_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        max_uses INTEGER NOT NULL DEFAULT 1,
        used_count INTEGER NOT NULL DEFAULT 0,
        expires_at INTEGER NOT NULL,
        is_revoked INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        sender_peer_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_role TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meeting_decisions (
        id TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        title TEXT NOT NULL,
        decision_text TEXT NOT NULL,
        approved_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'approved',
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS action_items (
        id TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        task TEXT NOT NULL,
        assignee TEXT NOT NULL,
        due_date TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'pending',
        hse_ref TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        target_id TEXT,
        details_json TEXT,
        ip TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_meetings_room ON meetings(room_code);
      CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
      CREATE INDEX IF NOT EXISTS idx_invitations_room ON invitations(room_code);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
    `);
  }

  private seedDefaultData() {
    // Test fixtures must be created by isolated test code; production never seeds identities.
  }

  // --- COMPANIES & PROJECTS ---
  public createCompany(id: string, name: string): CompanyRecord {
    this.db.prepare('INSERT OR IGNORE INTO companies (id, name, created_at) VALUES (?, ?, ?)')
      .run(id, name, Date.now());
    return { id, name, createdAt: Date.now() };
  }

  public getCompany(id: string): CompanyRecord | null {
    const row = this.db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as any;
    if (!row) return null;
    return { id: row.id, name: row.name, createdAt: row.created_at };
  }

  public createProject(id: string, name: string, companyId: string, siteId: string): ProjectRecord {
    this.db.prepare('INSERT OR IGNORE INTO projects (id, name, company_id, site_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, companyId, siteId, Date.now());
    return { id, name, companyId, siteId, createdAt: Date.now() };
  }

  public listProjects(companyId?: string): ProjectRecord[] {
    const stmt = companyId
      ? this.db.prepare('SELECT * FROM projects WHERE company_id = ?')
      : this.db.prepare('SELECT * FROM projects');
    const rows = companyId ? (stmt.all(companyId) as any[]) : (stmt.all() as any[]);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      companyId: r.company_id,
      siteId: r.site_id,
      createdAt: r.created_at,
    }));
  }

  // --- USERS & AUTHENTICATION ---
  public createUser(user: Omit<UserRecord, 'createdAt'>): UserRecord {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, display_name, role, company_id, site_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.email.toLowerCase().trim(),
      user.password_hash,
      user.salt,
      user.displayName,
      user.role,
      user.companyId,
      user.siteId || null,
      now
    );
    return { ...user, createdAt: now };
  }

  public getUserByEmail(email: string): UserRecord | null {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as any;
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      password_hash: row.password_hash,
      salt: row.salt,
      displayName: row.display_name,
      role: row.role as Role,
      companyId: row.company_id,
      siteId: row.site_id || undefined,
      createdAt: row.created_at,
    };
  }

  public getUserById(id: string): UserRecord | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      password_hash: row.password_hash,
      salt: row.salt,
      displayName: row.display_name,
      role: row.role as Role,
      companyId: row.company_id,
      siteId: row.site_id || undefined,
      createdAt: row.created_at,
    };
  }

  // --- MEETINGS ---
  public createOrGetMeeting(
    roomCode: string,
    hostId: string,
    companyId: string,
    title = 'Executive Meeting',
    hseContext?: HSEMeetingContext
  ): MeetingRecord {
    const existing = this.getMeeting(roomCode);
    if (existing) return existing;

    const id = crypto.randomUUID();
    const now = Date.now();
    const hseContextJson = hseContext ? JSON.stringify(hseContext) : null;

    this.db.prepare(`
      INSERT INTO meetings (id, room_code, title, host_id, company_id, status, is_locked, waiting_room_enabled, hse_context_json, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', 0, 0, ?, ?)
    `).run(id, roomCode, title, hostId, companyId, hseContextJson, now);

    return this.getMeeting(roomCode)!;
  }

  public isMeetingCohost(roomCode: string, userId: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM meeting_cohosts mc JOIN meetings m ON m.id = mc.meeting_id WHERE m.room_code = ? AND mc.user_id = ?').get(roomCode, userId);
    return !!row;
  }

  public assignMeetingCohost(roomCode: string, userId: string): boolean {
    const meeting = this.getMeeting(roomCode);
    const user = this.getUserById(userId);
    if (!meeting || !user || user.companyId !== meeting.companyId) return false;
    const result = this.db.prepare('INSERT OR IGNORE INTO meeting_cohosts (meeting_id, user_id, assigned_at) VALUES (?, ?, ?)').run(meeting.id, userId, Date.now());
    return result.changes > 0;
  }

  public getMeeting(roomCode: string): MeetingRecord | undefined {
    const row = this.db.prepare('SELECT * FROM meetings WHERE room_code = ?').get(roomCode) as any;
    if (!row) return undefined;

    const decisions = this.getDecisions(roomCode);
    const actionItems = this.getActionItems(roomCode);

    let hseContext: HSEMeetingContext | undefined;
    if (row.hse_context_json) {
      try {
        hseContext = JSON.parse(row.hse_context_json);
      } catch {
        // ignore
      }
    }

    return {
      id: row.id,
      roomCode: row.room_code,
      title: row.title,
      hostId: row.host_id,
      companyId: row.company_id,
      status: row.status,
      isLocked: Boolean(row.is_locked),
      waitingRoomEnabled: Boolean(row.waiting_room_enabled),
      hseContext,
      createdAt: row.created_at,
      decisions,
      actionItems,
    };
  }

  public updateMeeting(roomCode: string, updates: Partial<MeetingRecord>): MeetingRecord | undefined {
    const meeting = this.getMeeting(roomCode);
    if (!meeting) return undefined;

    if (updates.isLocked !== undefined) {
      this.db.prepare('UPDATE meetings SET is_locked = ? WHERE room_code = ?').run(updates.isLocked ? 1 : 0, roomCode);
    }
    if (updates.waitingRoomEnabled !== undefined) {
      this.db.prepare('UPDATE meetings SET waiting_room_enabled = ? WHERE room_code = ?').run(updates.waitingRoomEnabled ? 1 : 0, roomCode);
    }
    if (updates.hseContext !== undefined) {
      this.db.prepare('UPDATE meetings SET hse_context_json = ? WHERE room_code = ?').run(JSON.stringify(updates.hseContext), roomCode);
    }
    if (updates.title !== undefined) {
      this.db.prepare('UPDATE meetings SET title = ? WHERE room_code = ?').run(updates.title, roomCode);
    }

    return this.getMeeting(roomCode);
  }

  public listMeetings(companyId?: string, userId?: string): MeetingRecord[] {
    let rows: any[];
    if (companyId && userId) {
      rows = this.db.prepare('SELECT room_code FROM meetings WHERE company_id = ? ORDER BY created_at DESC').all(companyId) as any[];
    } else if (companyId) {
      rows = this.db.prepare('SELECT room_code FROM meetings WHERE company_id = ? ORDER BY created_at DESC').all(companyId) as any[];
    } else {
      rows = [];
    }
    return rows.map((r) => this.getMeeting(r.room_code)!).filter(Boolean);
  }

  // --- INVITATIONS (Tied to roomCode and companyId) ---
  public createInvitation(
    roomCode: string,
    companyId: string,
    token: string,
    role: Role,
    expiresInHours = 24,
    maxUses = 10,
    createdBy = 'host'
  ): Invitation {
    const id = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + expiresInHours * 60 * 60 * 1000;

    this.db.prepare(`
      INSERT INTO invitations (id, room_code, company_id, token, role, max_uses, used_count, expires_at, is_revoked, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)
    `).run(id, roomCode, companyId, token, role, maxUses, expiresAt, createdBy, now);

    return {
      id,
      roomCode,
      token,
      role,
      expiresAt,
      isRevoked: false,
      maxUses,
      usedCount: 0,
      createdBy,
      createdAt: now,
    };
  }

  public getInvitation(token: string): (Invitation & { companyId: string }) | undefined {
    const row = this.db.prepare('SELECT * FROM invitations WHERE token = ?').get(token) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      roomCode: row.room_code,
      companyId: row.company_id,
      token: row.token,
      role: row.role as Role,
      expiresAt: row.expires_at,
      isRevoked: Boolean(row.is_revoked),
      maxUses: row.max_uses,
      usedCount: row.used_count,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  public verifyAndConsumeInvitation(
    token: string,
    targetRoomCode?: string
  ): { valid: boolean; invitation?: Invitation; reason?: string } {
    const inv = this.getInvitation(token);
    if (!inv) {
      return { valid: false, reason: 'Invitation not found' };
    }
    if (inv.isRevoked) {
      return { valid: false, reason: 'Invitation has been revoked by host' };
    }
    if (Date.now() > inv.expiresAt) {
      return { valid: false, reason: 'Invitation has expired' };
    }
    if (inv.usedCount >= inv.maxUses) {
      return { valid: false, reason: 'Invitation usage limit reached' };
    }

    // P0 Constraint: Must be strictly bound to roomCode. Reject room hijacking!
    if (targetRoomCode && inv.roomCode !== targetRoomCode) {
      return { valid: false, reason: `Invitation is restricted to room '${inv.roomCode}' and cannot be used for '${targetRoomCode}'` };
    }

    const consumed = this.db.prepare('UPDATE invitations SET used_count = used_count + 1 WHERE id = ? AND is_revoked = 0 AND expires_at > ? AND used_count < max_uses').run(inv.id, Date.now());
    if (consumed.changes !== 1) return { valid: false, reason: 'Invitation is no longer available' };
    inv.usedCount += 1;

    return { valid: true, invitation: inv };
  }

  public checkInvitation(
    token: string,
    targetRoomCode?: string
  ): { valid: boolean; invitation?: Invitation; reason?: string } {
    const inv = this.getInvitation(token);
    if (!inv) {
      return { valid: false, reason: 'Invitation not found' };
    }
    if (inv.isRevoked) {
      return { valid: false, reason: 'Invitation has been revoked by host' };
    }
    if (Date.now() > inv.expiresAt) {
      return { valid: false, reason: 'Invitation has expired' };
    }
    if (inv.usedCount >= inv.maxUses) {
      return { valid: false, reason: 'Invitation usage limit reached' };
    }
    if (targetRoomCode && inv.roomCode !== targetRoomCode) {
      return { valid: false, reason: `Invitation is restricted to room '${inv.roomCode}' and cannot be used for '${targetRoomCode}'` };
    }
    return { valid: true, invitation: inv };
  }

  public revokeInvitation(token: string, companyId?: string): boolean {
    const res = companyId
      ? this.db.prepare('UPDATE invitations SET is_revoked = 1 WHERE token = ? AND company_id = ?').run(token, companyId)
      : this.db.prepare('UPDATE invitations SET is_revoked = 1 WHERE token = ?').run(token);
    return res.changes > 0;
  }

  public listInvitations(roomCode?: string): Invitation[] {
    const stmt = roomCode
      ? this.db.prepare('SELECT * FROM invitations WHERE room_code = ? ORDER BY created_at DESC')
      : this.db.prepare('SELECT * FROM invitations ORDER BY created_at DESC');
    const rows = roomCode ? (stmt.all(roomCode) as any[]) : (stmt.all() as any[]);
    return rows.map((r) => ({
      id: r.id,
      roomCode: r.room_code,
      token: r.token,
      role: r.role as Role,
      expiresAt: r.expires_at,
      isRevoked: Boolean(r.is_revoked),
      maxUses: r.max_uses,
      usedCount: r.used_count,
      createdBy: r.created_by,
      createdAt: r.created_at,
    }));
  }

  // --- CHAT MESSAGES ---
  public addChatMessage(roomCode: string, msg: ChatMessage) {
    this.db.prepare(`
      INSERT INTO chat_messages (id, room_code, sender_peer_id, sender_name, sender_role, text, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(msg.id, roomCode, msg.from, msg.senderName, msg.senderRole || 'participant', msg.text, msg.timestamp);
  }

  public getChatMessages(roomCode: string, limit = 100): ChatMessage[] {
    const rows = this.db.prepare(`
      SELECT * FROM chat_messages WHERE room_code = ? ORDER BY timestamp DESC LIMIT ?
    `).all(roomCode, limit) as any[];

    return rows.reverse().map((r) => ({
      id: r.id,
      from: r.sender_peer_id,
      senderName: r.sender_name,
      senderRole: r.sender_role as Role,
      text: r.text,
      timestamp: r.timestamp,
    }));
  }

  // --- DECISIONS & ACTION ITEMS ---
  public addDecision(roomCode: string, decision: Omit<DecisionItem, 'id' | 'timestamp'>): DecisionItem {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    this.db.prepare(`
      INSERT INTO meeting_decisions (id, room_code, title, decision_text, approved_by, status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, roomCode, decision.title, decision.decisionText, decision.approvedBy, decision.status || 'approved', timestamp);

    return { ...decision, id, timestamp };
  }

  public getDecisions(roomCode: string): DecisionItem[] {
    const rows = this.db.prepare('SELECT * FROM meeting_decisions WHERE room_code = ? ORDER BY timestamp ASC').all(roomCode) as any[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      decisionText: r.decision_text,
      approvedBy: r.approved_by,
      status: r.status,
      timestamp: r.timestamp,
    }));
  }

  public addActionItem(roomCode: string, item: Omit<ActionItem, 'id'>): ActionItem {
    const id = crypto.randomUUID();
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO action_items (id, room_code, task, assignee, due_date, priority, status, hse_ref, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, roomCode, item.task, item.assignee, item.dueDate, item.priority || 'medium', item.status || 'pending', item.hseRef || null, now);

    return { ...item, id };
  }

  public getActionItems(roomCode: string): ActionItem[] {
    const rows = this.db.prepare('SELECT * FROM action_items WHERE room_code = ? ORDER BY created_at ASC').all(roomCode) as any[];
    return rows.map((r) => ({
      id: r.id,
      task: r.task,
      assignee: r.assignee,
      dueDate: r.due_date,
      priority: r.priority,
      status: r.status,
      hseRef: r.hse_ref || undefined,
    }));
  }

  // --- AUDIT LOGS (Zero Token / Secret Storage) ---
  public logAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    // Deep Sanitization: Recursively scrub any key or value resembling tokens, keys, passwords, or hashes
    const sanitizedDetails: Record<string, any> = {};
    if (entry.details && typeof entry.details === 'object') {
      for (const [key, val] of Object.entries(entry.details)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('token') ||
          lowerKey.includes('password') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('key') ||
          lowerKey.includes('credential') ||
          lowerKey.includes('auth') ||
          lowerKey.includes('hash')
        ) {
          continue; // completely scrub
        }
        if (typeof val === 'string' && (val.includes('eyJ') || val.length > 60)) {
          continue; // scrub token-like strings
        }
        sanitizedDetails[key] = val;
      }
    }

    const detailsJson = JSON.stringify(sanitizedDetails);

    this.db.prepare(`
      INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, action, target_id, details_json, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, timestamp, entry.actorId, entry.actorName, entry.actorRole, entry.action, entry.targetId || null, detailsJson, entry.ip || null);

    return {
      id,
      timestamp,
      actorId: entry.actorId,
      actorName: entry.actorName,
      actorRole: entry.actorRole,
      action: entry.action,
      targetId: entry.targetId,
      details: sanitizedDetails,
      ip: entry.ip,
    };
  }

  public getAuditLogs(filter?: { roomCode?: string; action?: string; limit?: number }): AuditLogEntry[] {
    const limit = filter?.limit || 100;
    let query = 'SELECT * FROM audit_logs';
    const params: any[] = [];

    const clauses: string[] = [];
    if (filter?.action) { clauses.push('action = ?'); params.push(filter.action); }
    if (filter?.roomCode) { clauses.push("details_json LIKE ?"); params.push(`%\"roomCode\":\"${filter.roomCode.replace(/[%_]/g, '')}\"%`); }
    if (clauses.length) query += ` WHERE ${clauses.join(' AND ')}`;
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map((r) => {
      let details: any = {};
      try {
        details = JSON.parse(r.details_json || '{}');
      } catch {
        // ignore
      }
      return {
        id: r.id,
        timestamp: r.timestamp,
        actorId: r.actor_id,
        actorName: r.actor_name,
        actorRole: r.actor_role,
        action: r.action,
        targetId: r.target_id || undefined,
        details,
        ip: r.ip || undefined,
      };
    });
  }
}

export const db = new PersistentDatabase();

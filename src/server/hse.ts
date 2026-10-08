/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ABDULKAREM LIVE MEETING — HSE ENTERPRISE INTEGRATION LAYER
 */

import { HSEMeetingContext, Role } from '../types';
import { db, ProjectRecord } from './db';

/**
 * Get HSE project details from persistent database
 */
export function getHseProjectDetails(projectId: string): ProjectRecord | null {
  const projects = db.listProjects();
  return projects.find((p) => p.id === projectId) || null;
}

/**
 * List all available HSE projects for selection from persistent database
 */
export function listHseProjects(companyId?: string): ProjectRecord[] {
  return db.listProjects(companyId);
}

/**
 * Validate role capabilities against HSE Enterprise hierarchy
 */
export function canModerateHseMeeting(role: Role): boolean {
  return role === 'host' || role === 'admin' || role === 'hse_manager';
}

/**
 * Generate formatted HSE Minutes Compliance Header
 */
export function formatHseComplianceHeader(ctx: HSEMeetingContext): string {
  return `
> **نظام إدارة السلامة والصحة المهنية والبيئة (HSE Management System)**  
> **الشركة:** ${ctx.companyId} | **الموقع الميداني:** ${ctx.siteId} | **المشروع:** ${ctx.projectId}  
> **تصنيف الجلسة:** ${ctx.category} | **تقرير عدم المطابقة المرتبط (NCR):** \`${ctx.ncrNumber || 'None'}\`  
> **بلاغ الحادثة المرتبط (Incident):** \`${ctx.incidentId || 'None'}\` | **إجراء CAPA:** \`${ctx.capaId || 'None'}\`  
> **موضوع الـ Toolbox Talk:** ${ctx.toolboxTopic || 'None'}  
`;
}

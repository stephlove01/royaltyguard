import { apiGet, apiPost, apiRequest } from './apiClient'
import type { ApiUser } from './apiClient'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

interface PaginatedResponse<T> extends ApiEnvelope<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
  }
}

export interface StatementOverview {
  id: number
  artistId: number
  platform: string
  fileName: string
  fileType: string
  statementPeriod: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface AuditOverview {
  id: number
  statementId: number
  status: string
  totalExpected: string
  totalActual: string
  totalDifference: string
  createdAt: string
  updatedAt: string
}

export interface AuditDiscrepancy {
  id: number
  auditId: number
  royaltyRowId: number
  expectedAmount: string
  actualAmount: string
  difference: string
  threshold: string
  status: string
  trackName?: string
  plays?: string
  territory?: string
}

export interface AuditDetail {
  audit: AuditOverview
  statement: {
    id: number
    platform: string
    statementPeriod: string
  }
  discrepancies: AuditDiscrepancy[]
}

export interface StatementUploadResult {
  originalFilename: string
  storedFilename: string
  fileSize: number
  mimeType: string
}

export interface DashboardActivity {
  id: string
  kind: 'statement' | 'audit'
  title: string
  detail: string
  status: string
  occurredAt: string
}

export interface DashboardData {
  totalStatements: number
  completedAudits: number
  totalDiscrepancies: number
  totalDisputes: number
  recentActivity: DashboardActivity[]
}

type LoginResponse = ApiEnvelope<{ token: string; user: ApiUser }>
type RegisterResponse = ApiEnvelope<{ user: ApiUser }>
type StatementsResponse = ApiEnvelope<{ statements: StatementOverview[] }>
type StatementResponse = ApiEnvelope<{ statement: StatementOverview }>
type AuditResponse = ApiEnvelope<AuditDetail>

export async function login(email: string, password: string): Promise<LoginResponse['data']> {
  const response = await apiPost<LoginResponse>('/auth/login', { email, password })
  return response.data
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<RegisterResponse['data']> {
  const response = await apiPost<RegisterResponse>('/auth/register', { name, email, password })
  return response.data
}

export async function getDashboardData(): Promise<DashboardData> {
  const [statementsResponse, auditsResponse, completedResponse, discrepanciesResponse, disputesResponse] =
    await Promise.all([
      apiGet<StatementsResponse>('/statements'),
      apiGet<PaginatedResponse<AuditOverview>>('/audits?page=1&limit=100'),
      apiGet<PaginatedResponse<AuditOverview>>('/audits?status=completed&page=1&limit=1'),
      apiGet<PaginatedResponse<{ id: number }>>('/discrepancies?page=1&limit=1'),
      apiGet<PaginatedResponse<{ id: number }>>('/disputes?page=1&limit=1'),
    ])

  const recentActivity: DashboardActivity[] = [
    ...statementsResponse.data.statements.map((statement) => ({
      id: `statement-${statement.id}`,
      kind: 'statement' as const,
      title: statement.fileName,
      detail: `${statement.platform} · ${statement.statementPeriod}`,
      status: statement.status,
      occurredAt: statement.createdAt,
    })),
    ...auditsResponse.data.map((audit) => ({
      id: `audit-${audit.id}`,
      kind: 'audit' as const,
      title: `Audit for statement #${audit.statementId}`,
      detail: 'Royalty audit',
      status: audit.status,
      occurredAt: audit.createdAt,
    })),
  ]
    .sort((first, second) => Date.parse(second.occurredAt) - Date.parse(first.occurredAt))
    .slice(0, 5)

  return {
    totalStatements: statementsResponse.data.statements.length,
    completedAudits: completedResponse.pagination.total,
    totalDiscrepancies: discrepanciesResponse.pagination.total,
    totalDisputes: disputesResponse.pagination.total,
    recentActivity,
  }
}

export async function getStatements(): Promise<StatementOverview[]> {
  const response = await apiGet<StatementsResponse>('/statements')
  return response.data.statements
}

export async function getStatement(statementId: number): Promise<StatementOverview> {
  const response = await apiGet<StatementResponse>(`/statements/${statementId}`)
  return response.data.statement
}

export async function uploadStatementFile(file: File): Promise<StatementUploadResult> {
  const body = new FormData()
  body.append('file', file)
  const response = await apiRequest<ApiEnvelope<StatementUploadResult>>('/statements/upload', {
    method: 'POST',
    body,
  })
  return response.data
}

export async function getAudits(
  page = 1,
  limit = 100,
  statementId?: number,
): Promise<PaginatedResponse<AuditOverview>> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (statementId !== undefined) query.set('statementId', String(statementId))
  return apiGet<PaginatedResponse<AuditOverview>>(`/audits?${query.toString()}`)
}

export async function getAudit(auditId: number): Promise<AuditDetail> {
  const response = await apiGet<AuditResponse>(`/audits/${auditId}`)
  return response.data
}

export async function runAudit(
  statementId: number,
): Promise<{ audit: AuditOverview; discrepancies: AuditDiscrepancy[] }> {
  const response = await apiPost<
    ApiEnvelope<{ audit: AuditOverview; discrepancies: AuditDiscrepancy[] }>
  >(`/statements/${statementId}/run-audit`, {})
  return response.data
}
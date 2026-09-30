export interface CanonicalRoyaltyRow {
  id?: number
  trackName: string
  eligibleUnits: string
  territory: string
  tier: string | null
  actualPayout: string
}

export interface CanonicalRoyaltyStatement {
  platform: string
  statementPeriod: string
  rows: CanonicalRoyaltyRow[]
}

export type RawRoyaltyRow = Record<string, unknown>

export interface RawRoyaltyStatement {
  platform: unknown
  statementPeriod: unknown
  rows: unknown
}

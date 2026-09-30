import {
  CanonicalRoyaltyRow,
  CanonicalRoyaltyStatement,
  RawRoyaltyRow,
  RawRoyaltyStatement,
} from './royaltySchema'

const platformAliases: Record<string, string> = {
  spotify: 'Spotify',
  apple: 'Apple Music',
  'apple music': 'Apple Music',
  audiomack: 'Audiomack',
  youtube: 'YouTube Music',
  'youtube music': 'YouTube Music',
}

function readValue(input: RawRoyaltyRow, names: string[]): unknown {
  for (const name of names) {
    if (input[name] !== undefined && input[name] !== null) return input[name]
  }
  return undefined
}

function normalizeText(value: unknown, field: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${field} is required`)
  }

  const normalized = String(value).trim().replace(/\s+/g, ' ')
  if (!normalized) throw new Error(`${field} is required`)
  return normalized
}

function normalizeDecimal(value: unknown, field: string): string {
  const normalized = normalizeText(value, field)
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`${field} must be a non-negative decimal`)
  }
  return normalized
}

function normalizeEligibleUnits(value: unknown): string {
  const normalized = normalizeText(value, 'eligibleUnits')
  if (!/^\d+$/.test(normalized)) {
    throw new Error('eligibleUnits must be a non-negative whole number')
  }
  return normalized
}

export function normalizePlatform(value: unknown): string {
  const normalized = normalizeText(value, 'platform')
  return platformAliases[normalized.toLowerCase()] ?? normalized
}

export function normalizeTerritory(value: unknown): string {
  return normalizeText(value, 'territory').toUpperCase()
}

export function normalizeStatementPeriod(value: unknown): string {
  return normalizeText(value, 'statementPeriod').toUpperCase()
}

export function normalizeRoyaltyRow(input: RawRoyaltyRow): CanonicalRoyaltyRow {
  const tier = readValue(input, ['tier', 'rateTier'])
  return {
    trackName: normalizeText(readValue(input, ['trackName', 'track_name', 'track', 'title']), 'trackName'),
    eligibleUnits: normalizeEligibleUnits(
      readValue(input, ['eligibleUnits', 'eligible_units', 'plays', 'streams', 'units']),
    ),
    territory: normalizeTerritory(readValue(input, ['territory', 'country', 'countryCode'])),
    tier: tier === undefined || tier === null || String(tier).trim() === '' ? null : normalizeText(tier, 'tier'),
    actualPayout: normalizeDecimal(
      readValue(input, ['actualPayout', 'actual_payout', 'payout', 'royalty']),
      'actualPayout',
    ),
  }
}

export function normalizeRoyaltyStatement(input: RawRoyaltyStatement): CanonicalRoyaltyStatement {
  if (!Array.isArray(input.rows)) throw new Error('rows must be an array')

  return {
    platform: normalizePlatform(input.platform),
    statementPeriod: normalizeStatementPeriod(input.statementPeriod),
    rows: input.rows.map((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(`rows[${index}] must be an object`)
      }
      return normalizeRoyaltyRow(row as RawRoyaltyRow)
    }),
  }
}

import { PoolConnection, RowDataPacket } from 'mysql2/promise'

export interface RoyaltyRate extends RowDataPacket {
  id: number
  platform: string
  territory: string | null
  rate: string
  currency: string
  effectiveFrom: Date
  effectiveTo: Date | null
  source: string
}

export interface RoyaltyRateLookupInput {
  platform: string
  territory: string
  periodStart: string
}

export async function findApplicableRoyaltyRate(
  connection: PoolConnection,
  input: RoyaltyRateLookupInput,
): Promise<RoyaltyRate | null> {
  const [rates] = await connection.execute<RoyaltyRate[]>(
    `SELECT id, platform, territory, CAST(rate AS CHAR) AS rate, currency,
      effective_from AS effectiveFrom, effective_to AS effectiveTo, source
    FROM royalty_rates
    WHERE platform = ?
      AND (territory = ? OR territory IS NULL)
      AND effective_from <= ?
      AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY CASE WHEN territory = ? THEN 0 ELSE 1 END, effective_from DESC
    LIMIT 1`,
    [input.platform, input.territory, input.periodStart, input.periodStart, input.territory],
  )

  return rates[0] ?? null
}

import { parseScaledDecimal } from './royaltyCalculationService'

export function getDiscrepancyThresholdCents(): bigint {
  const configured = process.env.DISCREPANCY_THRESHOLD ?? '0.00'
  const thresholdCents = parseScaledDecimal(configured, 2)

  if (thresholdCents < 0n) {
    throw new Error('DISCREPANCY_THRESHOLD must not be negative')
  }

  return thresholdCents
}

export function exceedsDiscrepancyThreshold(
  differenceCents: bigint,
  thresholdCents: bigint,
): boolean {
  return differenceCents > thresholdCents
}

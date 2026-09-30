const centsPerUnit = 100n
const microUnitsPerRate = 1_000_000n
const microUnitsPerCent = 10_000n

export interface RoyaltyCalculation {
  expectedCents: bigint
  actualCents: bigint
  differenceCents: bigint
}

export function parseScaledDecimal(value: string, scale: number): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value)

  if (!match) throw new Error('Invalid decimal value in database or configuration')

  const fraction = match[3] ?? ''
  if (fraction.length > scale && /[^0]/.test(fraction.slice(scale))) {
    throw new Error('Decimal value exceeds the supported precision')
  }

  const scaled = BigInt(match[2]) * 10n ** BigInt(scale)
    + BigInt(fraction.slice(0, scale).padEnd(scale, '0') || '0')
  return match[1] === '-' ? -scaled : scaled
}

export function formatCents(cents: bigint): string {
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  const whole = absolute / centsPerUnit
  const fraction = (absolute % centsPerUnit).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

export function calculateRoyalty(
  eligibleUnits: string,
  rate: string,
  actualPayout: string,
): RoyaltyCalculation {
  const eligibleUnitsValue = BigInt(eligibleUnits)
  const rateMicros = parseScaledDecimal(rate, 6)
  const actualCents = parseScaledDecimal(actualPayout, 2)

  if (eligibleUnitsValue < 0n || rateMicros < 0n) {
    throw new Error('Royalty rows and rates must not be negative')
  }

  const expectedCents = (eligibleUnitsValue * rateMicros + microUnitsPerCent / 2n)
    / microUnitsPerCent

  return {
    expectedCents,
    actualCents,
    differenceCents: expectedCents - actualCents,
  }
}

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateRoyalty, formatCents, parseScaledDecimal } from '../src/services/royaltyCalculationService'

test('calculates expected, actual, and difference in integer cents', () => {
  const result = calculateRoyalty('100000', '0.004000', '300.00')

  assert.deepEqual(result, {
    expectedCents: 40000n,
    actualCents: 30000n,
    differenceCents: 10000n,
  })
})

test('rounds precision-sensitive royalty values half up to cents', () => {
  const result = calculateRoyalty('1000', '0.000005', '0.00')

  assert.equal(result.expectedCents, 1n)
  assert.equal(formatCents(result.expectedCents), '0.01')
})

test('supports zero plays and large play counts without floating point loss', () => {
  assert.equal(calculateRoyalty('0', '0.004000', '12.34').expectedCents, 0n)
  assert.equal(
    calculateRoyalty('1000000000000', '0.004000', '0.00').expectedCents,
    400000000000n,
  )
})

test('repeated identical inputs produce identical results', () => {
  const first = calculateRoyalty('125000', '0.006000', '100.00')
  const second = calculateRoyalty('125000', '0.006000', '100.00')

  assert.deepEqual(first, second)
})

test('rejects malformed, negative, and over-precise financial inputs', () => {
  assert.throws(() => calculateRoyalty('-1', '0.004000', '0.00'))
  assert.throws(() => calculateRoyalty('1', '-0.004000', '0.00'))
  assert.throws(() => calculateRoyalty('1', '0.004000', 'not-money'))
  assert.throws(() => parseScaledDecimal('0.0000001', 6))
  assert.throws(() => calculateRoyalty('one', '0.004000', '0.00'))
})

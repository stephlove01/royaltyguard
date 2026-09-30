import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  exceedsDiscrepancyThreshold,
  getDiscrepancyThresholdCents,
} from '../src/services/discrepancyThresholdService'

function withThreshold(value: string | undefined, callback: () => void): void {
  const previous = process.env.DISCREPANCY_THRESHOLD
  if (value === undefined) delete process.env.DISCREPANCY_THRESHOLD
  else process.env.DISCREPANCY_THRESHOLD = value

  try {
    callback()
  } finally {
    if (previous === undefined) delete process.env.DISCREPANCY_THRESHOLD
    else process.env.DISCREPANCY_THRESHOLD = previous
  }
}

test('does not create a discrepancy below the configured threshold', () => {
  assert.equal(exceedsDiscrepancyThreshold(99n, 100n), false)
})

test('does not create a discrepancy at the configured threshold', () => {
  assert.equal(exceedsDiscrepancyThreshold(100n, 100n), false)
})

test('creates a discrepancy above the configured threshold', () => {
  assert.equal(exceedsDiscrepancyThreshold(101n, 100n), true)
})

test('supports zero difference and zero threshold', () => {
  assert.equal(exceedsDiscrepancyThreshold(0n, 0n), false)
  assert.equal(exceedsDiscrepancyThreshold(1n, 0n), true)
})

test('reads configurable decimal thresholds as cents', () => {
  withThreshold('1.25', () => assert.equal(getDiscrepancyThresholdCents(), 125n))
  withThreshold(undefined, () => assert.equal(getDiscrepancyThresholdCents(), 0n))
})

test('rejects invalid threshold values', () => {
  withThreshold('-0.01', () => assert.throws(() => getDiscrepancyThresholdCents()))
  withThreshold('0.001', () => assert.throws(() => getDiscrepancyThresholdCents()))
  withThreshold('not-a-number', () => assert.throws(() => getDiscrepancyThresholdCents()))
})

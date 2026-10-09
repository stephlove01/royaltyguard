import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  isCanonicalDemoPlatform,
  normalizePlatform,
  normalizeRoyaltyRow,
  normalizeRoyaltyStatement,
} from '../src/services/normalizationService'

test('normalizes the four canonical platform names and listed aliases', () => {
  assert.equal(normalizePlatform('Spotify'), 'Spotify')
  assert.equal(normalizePlatform('spotify'), 'Spotify')
  assert.equal(normalizePlatform('Apple Music'), 'Apple Music')
  assert.equal(normalizePlatform('apple music'), 'Apple Music')
  assert.equal(normalizePlatform('apple'), 'Apple Music')
  assert.equal(normalizePlatform('YouTube Music'), 'YouTube Music')
  assert.equal(normalizePlatform('youtube music'), 'YouTube Music')
  assert.equal(normalizePlatform('youtube'), 'YouTube Music')
  assert.equal(normalizePlatform('Amazon Music'), 'Amazon Music')
  assert.equal(normalizePlatform('amazon music'), 'Amazon Music')
  assert.equal(normalizePlatform('amazon'), 'Amazon Music')
})

test('preserves existing Audiomack support', () => {
  assert.equal(normalizePlatform('Audiomack'), 'Audiomack')
  assert.equal(normalizePlatform('audiomack'), 'Audiomack')
  assert.equal(isCanonicalDemoPlatform('Audiomack'), true)
})

test('does not map unsupported platform names onto a demo platform', () => {
  assert.equal(normalizePlatform('Tidal'), 'Tidal')
  assert.equal(normalizePlatform('Boomplay'), 'Boomplay')
  assert.equal(isCanonicalDemoPlatform('Tidal'), false)
})

test('rejects empty platform values', () => {
  assert.throws(() => normalizePlatform(''), /platform is required/)
  assert.throws(() => normalizePlatform('   '), /platform is required/)
})

test('Amazon Music sample CSV matches the existing statement schema', () => {
  const csvPath = resolve(__dirname, '../../sample-data/amazon_music_statement.csv')
  const [header, ...rows] = readFileSync(csvPath, 'utf8').trim().split(/\r?\n/)

  assert.equal(header, 'track_name,plays,territory,tier,actual_payout')
  assert.ok(rows.length > 0)

  const statement = normalizeRoyaltyStatement({
    platform: 'amazon',
    statementPeriod: '2026-Q1',
    rows: rows.map((line) => {
      const match = line.match(/^"([^"]+)",(\d+),([A-Za-z]+),([^,]+),(\d+\.\d{2})$/)
      assert.ok(match, `expected CSV row: ${line}`)
      return {
        track_name: match[1],
        plays: match[2],
        territory: match[3],
        tier: match[4],
        actual_payout: match[5],
      }
    }),
  })

  assert.equal(statement.platform, 'Amazon Music')
  for (const row of statement.rows) {
    assert.ok(row.trackName)
    assert.ok(/^\d+$/.test(row.eligibleUnits))
    assert.equal(row.territory, 'NG')
    assert.ok(row.tier)
    assert.ok(/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(row.actualPayout))
    assert.doesNotThrow(() => normalizeRoyaltyRow(row))
  }
})

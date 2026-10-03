import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

type SourceRow = Record<string, string>
type AiRow = Record<string, unknown>
type WorkflowItem = { json: Record<string, unknown> }

const workflowPath = resolve(__dirname, '../../n8n/royaltyguard-statement-processing.json')
const workflow = JSON.parse(readFileSync(workflowPath, 'utf8')) as {
  nodes: Array<{ name: string; typeVersion: number; parameters: Record<string, unknown> }>
}
const extractor = workflow.nodes.find((node) => node.name === 'Advanced AI Extract')
const validator = workflow.nodes.find((node) => node.name === 'Validate AI Output Against CSV')

assert.ok(extractor)
assert.ok(validator)

const schema = JSON.parse(extractor.parameters.inputSchema as string) as {
  required: string[]
  additionalProperties: boolean
  properties: {
    rows: {
      items: {
        required: string[]
        additionalProperties: boolean
        properties: Record<string, { type: string | string[]; minimum?: number }>
      }
    }
  }
}
const validatorCode = validator.parameters.jsCode as string

function sourceRow(overrides: Partial<SourceRow> = {}): SourceRow {
  return {
    track_name: 'Sunset Echo',
    plays: '150000',
    territory: 'NG',
    tier: 'standard',
    actual_payout: '450.00',
    ...overrides,
  }
}

function aiRow(source: SourceRow, overrides: Partial<AiRow> = {}): AiRow {
  return {
    trackName: source.track_name,
    plays: Number(source.plays),
    territory: source.territory,
    tier: source.tier,
    actualPayout: source.actual_payout,
    ...overrides,
  }
}

function runValidation(source: SourceRow[], outputs: unknown[]): unknown {
  const sourceItems: WorkflowItem[] = source.map((json) => ({ json }))
  const aiItems: WorkflowItem[] = outputs.map((output) => ({ json: { output } }))
  const execute = new Function('$input', '$', validatorCode) as (
    input: { all: () => WorkflowItem[] },
    lookup: (name: string) => { all: () => WorkflowItem[] },
  ) => unknown

  return execute(
    { all: () => aiItems },
    (name) => {
      assert.equal(name, 'Extract From File')
      return { all: () => sourceItems }
    },
  )
}

function wrapped(row: AiRow): { rows: AiRow[] } {
  return { rows: [row] }
}

test('extractor uses the strict canonical rows schema with optional nullable tier', () => {
  assert.equal(extractor.typeVersion, 1.2)
  assert.equal(extractor.parameters.schemaType, 'manual')
  assert.deepEqual(schema.required, ['rows'])
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(schema.properties.rows.items.required, ['trackName', 'plays', 'territory', 'actualPayout'])
  assert.equal(schema.properties.rows.items.additionalProperties, false)
  assert.deepEqual(Object.keys(schema.properties.rows.items.properties).sort(), [
    'actualPayout',
    'plays',
    'territory',
    'tier',
    'trackName',
  ])
  assert.equal(schema.properties.rows.items.properties.plays.type, 'integer')
  assert.equal(schema.properties.rows.items.properties.plays.minimum, 0)
  assert.deepEqual(schema.properties.rows.items.properties.tier.type, ['string', 'null'])
})

test('valid AI rows matching source pass validation', () => {
  const first = sourceRow()
  const second = sourceRow({ track_name: 'Night City Lights', plays: '120000', actual_payout: '500.00' })

  assert.ok(Array.isArray(runValidation([first, second], [wrapped(aiRow(first)), wrapped(aiRow(second))])))
})

test('accepts a large play count when the JSON number exactly matches the source', () => {
  const source = sourceRow({ plays: '9007199254740992' })

  assert.ok(Array.isArray(runValidation([source], [wrapped(aiRow(source))])))
})

test('null tier is accepted when the CSV source has no tier', () => {
  const source = sourceRow({ tier: '' })

  assert.ok(Array.isArray(runValidation([source], [wrapped(aiRow(source, { tier: null }))])))
})

test('changed plays are rejected', () => {
  const source = sourceRow()
  assert.throws(() => runValidation([source], [wrapped(aiRow(source, { plays: 150001 }))]), /plays does not match/)
})

test('changed actual payout is rejected', () => {
  const source = sourceRow()
  assert.throws(() => runValidation([source], [wrapped(aiRow(source, { actualPayout: '450.01' }))]), /actualPayout does not exactly match/)
})

test('missing AI row is rejected', () => {
  const source = sourceRow()
  assert.throws(() => runValidation([source], []), /AI row count does not match/)
  assert.throws(() => runValidation([source], [{ rows: [] }]), /exactly one row/)
})

test('extra AI rows are rejected', () => {
  const source = sourceRow()
  const row = aiRow(source)
  assert.throws(() => runValidation([source], [{ rows: [row, row] }]), /exactly one row/)
})

test('duplicate mapping to a different source row is rejected', () => {
  const first = sourceRow()
  const second = sourceRow({ track_name: 'Night City Lights', plays: '120000', actual_payout: '500.00' })

  assert.throws(
    () => runValidation([first, second], [wrapped(aiRow(first)), wrapped(aiRow(first))]),
    /plays does not match|actualPayout does not exactly match|trackName does not match/,
  )
})

test('missing track name is rejected', () => {
  const source = sourceRow()
  assert.throws(() => runValidation([source], [wrapped(aiRow(source, { trackName: '' }))]), /trackName is required/)
})

test('missing territory is rejected', () => {
  const source = sourceRow()
  assert.throws(() => runValidation([source], [wrapped(aiRow(source, { territory: '' }))]), /territory is required/)
})

test('invalid plays are rejected', () => {
  const source = sourceRow()
  assert.throws(() => runValidation([source], [wrapped(aiRow(source, { plays: 150000.5 }))]), /plays must be a non-negative integer/)
  assert.throws(() => runValidation([source], [wrapped(aiRow(source, { plays: -1 }))]), /plays must be a non-negative integer/)
  assert.throws(() => runValidation([source], [wrapped(aiRow(source, { plays: '150000' }))]), /plays must be a non-negative integer/)
})

test('missing actual payout is rejected', () => {
  const source = sourceRow()
  assert.throws(() => runValidation([source], [wrapped(aiRow(source, { actualPayout: '' }))]), /actualPayout must be a non-negative decimal string/)
})

test('AI-calculated financial fields are rejected', () => {
  const source = sourceRow()
  assert.throws(() => runValidation([source], [wrapped(aiRow(source, { expectedPayout: '600.00' }))]), /unsupported field expectedPayout/)
})
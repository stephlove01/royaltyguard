import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

type Item = { json: Record<string, any> }
type NodeDefinition = {
  id: string
  name: string
  type: string
  typeVersion: number
  parameters: Record<string, any>
  onError?: string
  retryOnFail?: boolean
  maxTries?: number
  credentials?: Record<string, { name: string }>
}
type Workflow = {
  name: string
  active: boolean
  nodes: NodeDefinition[]
  connections: Record<string, Record<string, Array<Array<{ node: string; type: string; index: number }>>>>
}

const workflow = JSON.parse(
  readFileSync(resolve(__dirname, '../../n8n/royaltyguard-multiplatform-audit-dispute.json'), 'utf8'),
) as Workflow

function node(name: string): NodeDefinition {
  const found = workflow.nodes.find((entry) => entry.name === name)
  assert.ok(found, `workflow is missing node: ${name}`)
  return found
}

function linked(from: string, to: string, output = 0): boolean {
  return workflow.connections[from]?.main?.[output]?.some((entry) => entry.node === to) ?? false
}

function executeCode(name: string, input: Item[], lookup: (name: string) => Item[], env: Record<string, string | undefined> = {}) {
  const source = node(name).parameters.jsCode as string
  const execute = new Function('$input', '$', '$env', source) as (
    inputApi: { first: () => Item; all: () => Item[] },
    lookup: (nodeName: string) => { first: () => Item; all: () => Item[] },
    environment: Record<string, string | undefined>,
  ) => Item[]
  return execute(
    { first: () => input[0], all: () => input },
    (nodeName) => ({ first: () => lookup(nodeName)[0], all: () => lookup(nodeName) }),
    env,
  )
}

function normalizeRows(options: {
  platform: string
  fileType: 'csv' | 'pdf'
  rows: unknown[]
  sourceRows: Record<string, unknown>[]
  uncertainFields?: string[]
}) {
  const metadata: Item = {
    json: {
      valid: true,
      platform: options.platform,
      statementPeriod: '2026-Q1',
      sourceFileId: 'synthetic-file-1',
      fileName: `${options.platform} statement.${options.fileType}`,
      mimeType: options.fileType === 'csv' ? 'text/csv' : 'application/pdf',
      sourceLocation: 'https://drive.example.test/synthetic-file-1',
      syntheticDemo: true,
      fileType: options.fileType,
    },
  }
  const outputItems = [{ json: { output: { rows: options.rows, uncertainFields: options.uncertainFields ?? [] } } }]
  const sourceItems = options.sourceRows.map((json) => ({ json }))
  return executeCode('Validate AI Output and Normalize Rows', outputItems, (name) => {
    if (name === 'Validate File, Platform, and Period') return [metadata]
    if (name === 'Extract CSV' || name === 'Extract PDF') return sourceItems
    throw new Error(`Unexpected node lookup: ${name}`)
  })[0]
}

test('workflow is valid JSON with resolvable nodes and the intended existing node families', () => {
  assert.equal(workflow.active, false)
  assert.equal(new Set(workflow.nodes.map((entry) => entry.id)).size, workflow.nodes.length)

  const names = new Set(workflow.nodes.map((entry) => entry.name))
  for (const [source, destinations] of Object.entries(workflow.connections)) {
    assert.ok(names.has(source), `connection source is missing: ${source}`)
    for (const output of Object.values(destinations)) {
      for (const branch of output) {
        for (const connection of branch) assert.ok(names.has(connection.node), `connection target is missing: ${connection.node}`)
      }
    }
  }

  assert.equal(node('Google Drive Trigger').type, 'n8n-nodes-base.googleDriveTrigger')
  assert.equal(node('Extract CSV').parameters.operation, 'csv')
  assert.equal(node('Extract PDF').parameters.operation, 'pdf')
  assert.equal(node('AI - Normalize Statement (Information Extractor)').type, '@n8n/n8n-nodes-langchain.informationExtractor')
  assert.equal(node('Gemini Chat Model - Configure Credential').credentials?.googlePalmApi.name, 'Google Gemini(PaLM) Api account')
})

test('normalizes varied CSV aliases to the common row contract for supported platforms', () => {
  const spotify = normalizeRows({
    platform: 'Spotify',
    fileType: 'csv',
    rows: [{ trackName: 'Sunset Echo', plays: 150000, territory: 'NG', tier: 'standard', actualPayout: '450.00' }],
    sourceRows: [{ track_name: 'Sunset Echo', plays: '150000', territory: 'NG', tier: 'standard', actual_payout: '450.00' }],
  })
  const apple = normalizeRows({
    platform: 'Apple Music',
    fileType: 'csv',
    rows: [{ trackName: 'Golden Hour', plays: 130000, territory: 'ng', tier: null, actualPayout: '760.00' }],
    sourceRows: [{ title: 'Golden Hour', streams: '130000', country: 'NG', payout: '760.00' }],
  })

  assert.equal(spotify.json.valid, true)
  assert.deepEqual(spotify.json.rows[0], {
    trackName: 'Sunset Echo', eligibleUnits: '150000', territory: 'NG', tier: 'standard', actualPayout: '450.00',
  })
  assert.equal(apple.json.platform, 'Apple Music')
  assert.deepEqual(apple.json.rows[0], {
    trackName: 'Golden Hour', eligibleUnits: '130000', territory: 'NG', tier: null, actualPayout: '760.00',
  })
})

test('flags uncertain, absent, and source-mismatched fields instead of calculating', () => {
  const uncertain = normalizeRows({
    platform: 'Spotify', fileType: 'csv',
    rows: [{ trackName: 'Sunset Echo', plays: 150000, territory: 'NG', actualPayout: '450.00' }],
    sourceRows: [{ track_name: 'Sunset Echo', plays: '150000', territory: 'NG', actual_payout: '450.00' }],
    uncertainFields: ['territory'],
  })
  const mismatch = normalizeRows({
    platform: 'Spotify', fileType: 'csv',
    rows: [{ trackName: 'Sunset Echo', plays: 150000, territory: 'NG', actualPayout: '451.00' }],
    sourceRows: [{ track_name: 'Sunset Echo', plays: '150000', territory: 'NG', actual_payout: '450.00' }],
  })
  const missing = normalizeRows({
    platform: 'Spotify', fileType: 'csv',
    rows: [{ trackName: 'Sunset Echo', plays: 150000, territory: 'NG', actualPayout: '' }],
    sourceRows: [{ track_name: 'Sunset Echo', plays: '150000', territory: 'NG', actual_payout: '450.00' }],
  })

  assert.equal(uncertain.json.valid, false)
  assert.match(uncertain.json.error, /Uncertain source fields/)
  assert.equal(mismatch.json.valid, false)
  assert.match(mismatch.json.error, /differs from CSV source/)
  assert.equal(missing.json.valid, false)
})

test('accepts only values present in extracted PDF text and marks the result for review', () => {
  const accepted = normalizeRows({
    platform: 'YouTube Music', fileType: 'pdf',
    rows: [{ trackName: 'Echoes in Bloom', plays: 135000, territory: 'NG', actualPayout: '390.00' }],
    sourceRows: [{ text: 'Echoes in Bloom | Plays 135000 | Territory NG | Actual payout 390.00' }],
  })
  const rejected = normalizeRows({
    platform: 'YouTube Music', fileType: 'pdf',
    rows: [{ trackName: 'Echoes in Bloom', plays: 135000, territory: 'NG', actualPayout: '391.00' }],
    sourceRows: [{ text: 'Echoes in Bloom | Plays 135000 | Territory NG | Actual payout 390.00' }],
  })

  assert.equal(accepted.json.valid, true)
  assert.equal(accepted.json.validationMode, 'pdf_text_match_review_required')
  assert.equal(rejected.json.valid, false)
})

test('uses decimal-safe arithmetic and only allows configured demo rates for synthetic statements', () => {
  const calc = node('Code - Calculate Expected Payout').parameters.jsCode as string
  const execute = new Function('$input', '$', '$env', calc) as (input: { all: () => Item[] }, lookup: (name: string) => { all: () => Item[] }, env: Record<string, string>) => Item[]
  const row: Item = { json: { statementId: 12, platform: 'Spotify', statementPeriod: '2026-Q1', trackName: 'Demo Track', eligibleUnits: '100000', territory: 'NG', tier: null, actualPayout: '300.00', sourceMetadata: {} } }
  const calculated = execute({ all: () => [{ json: { rate: '0.004000', rateSource: 'synthetic_demo_config' } }] }, () => ({ all: () => [row] }), { ROYALTYGUARD_DISCREPANCY_THRESHOLD: '0.00' })

  assert.equal(calculated[0].json.expectedPayout, '400.00')
  assert.equal(calculated[0].json.difference, '100.00')
  assert.equal(calculated[0].json.isDiscrepancy, true)
  assert.equal(calculated[0].json.resultLabel, 'potential_discrepancy')

  const resolver = node('Resolve Backend or Synthetic Demo Rate').parameters.jsCode as string
  const resolve = new Function('$input', '$', '$env', resolver) as (input: { all: () => Item[] }, lookup: (name: string) => { all: () => Item[] }, env: Record<string, string>) => Item[]
  const synthetic = { json: { platform: 'Spotify', syntheticDemo: true } }
  const real = { json: { platform: 'Spotify', syntheticDemo: false } }
  const failedRate = { json: { success: false, error: { statusCode: 404 } } }
  const lookup = () => ({ all: () => [synthetic] })
  assert.equal(resolve({ all: () => [failedRate] }, lookup, { ROYALTYGUARD_DEMO_RATES_JSON: '{"Spotify":"0.004000"}' })[0].json.rateSource, 'synthetic_demo_config')
  assert.throws(() => resolve({ all: () => [failedRate] }, () => ({ all: () => [real] }), { ROYALTYGUARD_DEMO_RATES_JSON: '{"Spotify":"0.004000"}' }), /synthetic-only/)
})

test('reply and escalation decisions fail closed and require approval before sending', () => {
  const sent = { json: { threadId: 'thread-a', messageId: 'sent-a', sentAt: '2026-01-01T00:00:00.000Z', disputeId: 4 } }
  const dispute = { json: { recipient: 'royalties@example.test' } }
  const replyCode = node('Check Reply in Sent Thread').parameters.jsCode as string
  const execute = new Function('$input', '$', replyCode) as (input: { first: () => Item }, lookup: (name: string) => { first: () => Item }) => Item[]
  const lookup = (name: string) => ({ first: () => name === 'Build Send Receipt' ? sent : dispute })
  const original = { id: 'sent-a', internalDate: '1767225600000', from: 'demo@example.test' }
  const noReply = execute({ first: () => ({ json: { threadId: 'thread-a', messages: [original] } }) }, lookup)[0]
  const withReply = execute({ first: () => ({ json: { threadId: 'thread-a', messages: [original, { id: 'reply-a', internalDate: '1767225660000', from: 'royalties@example.test' }] } }) }, lookup)[0]
  const missing = execute({ first: () => ({ json: { messages: [] } }) }, lookup)[0]

  assert.equal(noReply.json.replyStatus, 'no_reply')
  assert.equal(withReply.json.replyStatus, 'received')
  assert.equal(missing.json.replyStatus, 'review_required')
  assert.ok(linked('Escalation Approved?', 'Gmail - Send Approved Escalation', 0))
  assert.ok(linked('Escalation Approved?', 'Build Escalation Declined Summary', 1))
  assert.ok(linked('Check Reply in Sent Thread', 'Build Reply Check Error Summary', 1))
  assert.equal(node('Wait - 1 Minute').parameters.amount, 1)
  assert.equal(node('Wait - 1 Minute').parameters.unit, 'minutes')
})

test('keeps backend authentication and ownership while automatically delivering eligible disputes', () => {
  const serialized = JSON.stringify(workflow)
  assert.ok(linked('Webhook - Backend Automatic Dispute', 'Validate Automatic Dispute'))
  assert.equal(node('Validate Automatic Dispute').parameters.jsCode.includes('$env.N8N_WEBHOOK_SECRET'), true)
  assert.ok(serialized.includes('royaltyguard-multiplatform-approved-send'))
  assert.ok(!serialized.includes('/api/discrepancies/'))
  assert.ok(!serialized.includes('GEMINI_API_KEY'))
  assert.ok(!serialized.includes('replace_with_n8n_webhook_secret'))
  assert.equal(node('Gmail - Send Automatic Dispute').retryOnFail, false)
  assert.ok(node('Validate Automatic Dispute').parameters.jsCode.includes('deliveryMode must be automatic'))
  assert.ok(node('Build Send Receipt').parameters.jsCode.includes("typeof gmail.id === 'string'"))
  assert.equal(node('Gmail - Send Approved Escalation').parameters.operation, 'send')
})

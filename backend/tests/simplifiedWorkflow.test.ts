import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

type Item = { json: Record<string, any> }
type Node = { id: string; name: string; type: string; parameters: Record<string, any>; credentials?: Record<string, { name: string }> }
type Workflow = { active: boolean; nodes: Node[]; connections: Record<string, Record<string, Array<Array<{ node: string }>>>> }

const workflow = JSON.parse(readFileSync(resolve(__dirname, '../../n8n/royaltyguard-simplified-audit.json'), 'utf8')) as Workflow
const node = (name: string) => {
  const found = workflow.nodes.find((entry) => entry.name === name)
  assert.ok(found, `missing workflow node: ${name}`)
  return found
}

function runCode(name: string, input: Item[], lookup: (name: string) => Item[], env: Record<string, string | undefined> = {}) {
  const source = node(name).parameters.jsCode as string
  const execute = new Function('$input', '$', '$env', source) as (
    inputApi: { all: () => Item[]; first: () => Item },
    lookupApi: (nodeName: string) => { all: () => Item[]; first: () => Item },
    environment: Record<string, string | undefined>,
  ) => Item[]
  return execute({ all: () => input, first: () => input[0] }, (nodeName) => ({ all: () => lookup(nodeName), first: () => lookup(nodeName)[0] }), env)
}

test('simplified workflow is inactive, valid, connected, and has the required 12-node minimum', () => {
  assert.equal(workflow.active, false)
  assert.equal(workflow.nodes.length, 12)
  assert.equal(new Set(workflow.nodes.map((entry) => entry.id)).size, 12)
  const names = new Set(workflow.nodes.map((entry) => entry.name))
  for (const [source, outputKinds] of Object.entries(workflow.connections)) {
    assert.ok(names.has(source), `missing connection source ${source}`)
    for (const branches of Object.values(outputKinds)) for (const branch of branches) for (const target of branch) assert.ok(names.has(target.node), `missing connection target ${target.node}`)
  }
  assert.equal(node('Google Drive Trigger').type, 'n8n-nodes-base.googleDriveTrigger')
  assert.equal(node('Extract From File').parameters.operation, 'csv')
  assert.equal(node('AI Agent - Normalize Statement').type, '@n8n/n8n-nodes-langchain.informationExtractor')
  assert.equal(node('Gemini Chat Model').credentials?.googlePalmApi.name, 'Google Gemini(PaLM) Api account')
  assert.equal(node('HTTP Request - Get Royalty Rate').parameters.url.includes('/api/webhooks/n8n/royalty-rate'), true)
})

test('normalization preserves CSV source values and accepts the documented platform aliases', () => {
  const source: Item = { json: { title: 'Golden Hour', streams: '130000', country: 'ng', payout: '760.00' } }
  const ai: Item = { json: { output: { rows: [{ trackName: 'Golden Hour', plays: 130000, territory: 'NG', tier: null, actualPayout: '760.00' }] } } }
  const drive: Item = { json: { id: 'file-1', name: 'apple_music_2026-Q1.csv', mimeType: 'text/csv', appProperties: { platform: 'Apple Music', statementPeriod: '2026-Q1' }, webViewLink: 'https://drive.example.test/file-1' } }
  const [result] = runCode('Normalize Royalty Data', [ai], (name) => {
    if (name === 'Google Drive Trigger') return [drive]
    if (name === 'Extract From File') return [source]
    throw new Error(`unexpected lookup ${name}`)
  })
  assert.equal(result.json.platform, 'Apple Music')
  assert.equal(result.json.statementPeriod, '2026-Q1')
  assert.deepEqual(result.json.rows, [{ trackName: 'Golden Hour', eligibleUnits: '130000', territory: 'NG', tier: null, actualPayout: '760.00' }])
  const sourceCode = node('Normalize Royalty Data').parameters.jsCode as string
  for (const platform of ['Spotify', 'Apple Music', 'YouTube Music', 'Amazon Music', 'Audiomack']) assert.ok(sourceCode.includes(platform))
})

test('normalization fails closed for PDF, missing metadata, and source-mismatched AI output', () => {
  const source: Item = { json: { track: 'Song', plays: '1', territory: 'NG', payout: '0.01' } }
  const ai: Item = { json: { output: { rows: [{ trackName: 'Song', plays: 2, territory: 'NG', actualPayout: '0.01' }] } } }
  const run = (drive: Item) => runCode('Normalize Royalty Data', [ai], (name) => name === 'Google Drive Trigger' ? [drive] : [source])
  assert.throws(() => run({ json: { id: 'pdf', name: 'spotify_2026-Q1.pdf', mimeType: 'application/pdf' } }), /Manual review required: PDF/)
  assert.throws(() => run({ json: { id: 'csv', name: 'unknown.csv', mimeType: 'text/csv' } }), /platform and statementPeriod/)
  assert.throws(() => run({ json: { id: 'csv', name: 'spotify_2026-Q1.csv', mimeType: 'text/csv', appProperties: { platform: 'Spotify', statementPeriod: '2026-Q1' } } }), /differs from CSV source/)
})

test('calculation is decimal-safe, labels only potential discrepancies, and packages the persistence contract', () => {
  const row: Item = { json: { statementId: 7, platform: 'Spotify', statementPeriod: '2026-Q1', sourceMetadata: { sourceFileId: 'file-1' }, trackName: 'Song', eligibleUnits: '100000', territory: 'NG', tier: null, actualPayout: '300.00' } }
  const [result] = runCode('Calculate Royalty Leakage', [{ json: { data: { rate: '0.004000' } } }], (name) => {
    assert.equal(name, 'Expand Rate Requests')
    return [row]
  }, { ROYALTYGUARD_DISCREPANCY_THRESHOLD: '0.00' })
  assert.equal(result.json.totalExpected, '400.00')
  assert.equal(result.json.totalDifference, '100.00')
  assert.equal(result.json.discrepancyCount, 1)
  assert.equal(result.json.potentialDiscrepancy, true)
  assert.equal(result.json.resultLabel, 'potential_discrepancy_for_review')
  assert.deepEqual(Object.keys(result.json).sort(), ['discrepancyCount', 'potentialDiscrepancy', 'resultLabel', 'results', 'sourceFileId', 'statementId', 'threshold', 'totalActual', 'totalDifference', 'totalExpected'].sort())
})

test('does not bypass authenticated dispute drafting or server-side delivery', () => {
  const serialized = JSON.stringify(workflow)
  assert.ok(!serialized.includes('/api/discrepancies/'))
  assert.ok(!serialized.includes('Authorization'))
  assert.ok(!serialized.includes('GEMINI_API_KEY'))
  assert.ok(!serialized.includes('n8n-nodes-base.gmail'))
  assert.ok(!serialized.includes('n8n-nodes-base.wait'))
  assert.ok(serialized.includes('N8N_WEBHOOK_SECRET'))
})

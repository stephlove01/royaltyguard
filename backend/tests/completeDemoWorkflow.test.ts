import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

type NodeDefinition = {
  id: string
  name: string
  type: string
  parameters: Record<string, any>
  credentials?: Record<string, { name: string }>
  retryOnFail?: boolean
}
type Workflow = {
  active: boolean
  nodes: NodeDefinition[]
  connections: Record<string, Record<string, Array<Array<{ node: string }>>>>
}

const workflow = JSON.parse(
  readFileSync(resolve(__dirname, '../../n8n/royaltyguard-complete-demo.json'), 'utf8'),
) as Workflow

function node(name: string): NodeDefinition {
  const found = workflow.nodes.find((entry) => entry.name === name)
  assert.ok(found, `workflow is missing ${name}`)
  return found
}

function linked(from: string, to: string, output = 0): boolean {
  return workflow.connections[from]?.main?.[output]?.some((target) => target.node === to) ?? false
}

test('complete demo workflow is inactive, valid, and has only resolved connections', () => {
  assert.equal(workflow.active, false)
  assert.equal(workflow.nodes.length, 32)
  assert.equal(new Set(workflow.nodes.map((entry) => entry.id)).size, workflow.nodes.length)
  const names = new Set(workflow.nodes.map((entry) => entry.name))
  for (const [source, kinds] of Object.entries(workflow.connections)) {
    assert.ok(names.has(source), `missing source ${source}`)
    for (const outputs of Object.values(kinds)) for (const branch of outputs) for (const target of branch) assert.ok(names.has(target.node), `missing target ${target.node}`)
  }
})

test('audit path uses the installed extractor, protected rate endpoint, deterministic leakage code, and persistence', () => {
  assert.equal(node('Google Drive Trigger').type, 'n8n-nodes-base.googleDriveTrigger')
  assert.equal(node('Extract From File').parameters.operation, 'csv')
  assert.equal(node('AI Agent - Normalize Statement').type, '@n8n/n8n-nodes-langchain.informationExtractor')
  assert.equal(node('Gemini Chat Model').credentials?.googlePalmApi.name, 'Google Gemini(PaLM) Api account')
  assert.ok(node('HTTP Request - Get Royalty Rate').parameters.url.includes('/api/webhooks/n8n/royalty-rate'))
  assert.ok(linked('Calculate Royalty Leakage', 'IF Leakage'))
  assert.ok(linked('IF Leakage', 'Generate Dispute Draft - Authenticated App Handoff'))
  assert.ok(linked('Generate Dispute Draft - Authenticated App Handoff', 'Persist Audit Results'))
  assert.ok(linked('Persist Audit Results', 'Final Audit Summary'))
})

test('draft handoff preserves the supported authenticated application integration', () => {
  const handoff = node('Generate Dispute Draft - Authenticated App Handoff')
  assert.equal(handoff.type, 'n8n-nodes-base.code')
  assert.ok(handoff.parameters.jsCode.includes('/api/discrepancies/:id/dispute-draft'))
  const serialized = JSON.stringify(workflow)
  assert.ok(!serialized.includes('GEMINI_API_KEY'))
  assert.ok(!serialized.includes('Authorization'))
  assert.ok(!serialized.includes('replace_with_n8n_webhook_secret'))
})

test('automatic send waits one minute, checks a thread, and keeps escalation approval separate', () => {
  assert.ok(linked('Webhook - Backend Automatic Dispute', 'Validate Automatic Dispute'))
  assert.ok(linked('Validate Automatic Dispute', 'Already Sent?'))
  assert.ok(linked('Already Sent?', 'Gmail - Send Automatic Dispute', 1))
  assert.ok(linked('Gmail - Send Automatic Dispute', 'Build Safe Send Failure Receipt', 1))
  assert.ok(linked('Build Safe Send Failure Receipt', 'Respond - Dispute Send Failed'))
  assert.ok(linked('Build Send Receipt', 'Respond - Dispute Sent'))
  assert.ok(linked('Build Send Receipt', 'Wait - 1 Minute'))
  assert.equal(node('Wait - 1 Minute').parameters.amount, 1)
  assert.equal(node('Wait - 1 Minute').parameters.unit, 'minutes')
  assert.ok(linked('Gmail - Get Sent Thread for Reply Check', 'Check Reply in Sent Thread'))
  assert.ok(linked('Reply Received?', 'Final Follow-up Summary'))
  assert.ok(linked('Reply Received?', 'Confirmed No Reply?', 1))
  assert.ok(linked('Confirmed No Reply?', 'Gmail - Request Escalation Approval'))
  assert.ok(linked('Escalation Approved?', 'Gmail - Send Approved Escalation'))
  assert.ok(linked('Escalation Approved?', 'Final Follow-up Summary', 1))
  assert.equal(node('Gmail - Send Automatic Dispute').retryOnFail, false)
})

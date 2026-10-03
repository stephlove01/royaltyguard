import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

type WorkflowItem = { json: Record<string, unknown> }
type WorkflowDefinition = {
  name: string
  nodes: Array<{
    name: string
    type: string
    typeVersion: number
    parameters: Record<string, unknown>
    credentials?: Record<string, { name: string }>
    retryOnFail?: boolean
    maxTries?: number
  }>
}

const sendWorkflow = JSON.parse(
  readFileSync(resolve(__dirname, '../../n8n/royaltyguard-dispute-send.json'), 'utf8'),
) as WorkflowDefinition

const draftWorkflow = JSON.parse(
  readFileSync(resolve(__dirname, '../../n8n/royaltyguard-dispute-draft.json'), 'utf8'),
) as WorkflowDefinition

function findNode(workflow: WorkflowDefinition, name: string) {
  const found = workflow.nodes.find((node) => node.name === name)
  assert.ok(found, `workflow is missing node: ${name}`)
  return found
}

const sendValidateCode = findNode(sendWorkflow, 'Validate Approved Dispute').parameters.jsCode as string
const sendReceiptCode = findNode(sendWorkflow, 'Build Send Receipt').parameters.jsCode as string

function sendRequest(overrides: {
  body?: Record<string, unknown>
  headers?: Record<string, string>
} = {}): WorkflowItem {
  return {
    json: {
      headers: overrides.headers ?? { 'x-n8n-webhook-secret': 'shared-secret' },
      body: {
        idempotencyKey: 'dispute-7',
        dispute: {
          id: 7,
          recipient: 'royalties@example.com',
          subject: 'Royalty discrepancy',
          body: 'Please review the reported payout.',
        },
        ...overrides.body,
      },
    },
  }
}

function runSendValidate(
  item: WorkflowItem,
  env: Record<string, string | undefined> = { N8N_WEBHOOK_SECRET: 'shared-secret' },
  staticData: Record<string, unknown> = {},
): WorkflowItem[] {
  const items = [item]
  const execute = new Function('$input', '$env', '$getWorkflowStaticData', sendValidateCode) as (
    input: { first: () => WorkflowItem; all: () => WorkflowItem[] },
    environment: Record<string, string | undefined>,
    getStatic: (key: string) => Record<string, unknown>,
  ) => WorkflowItem[]

  return execute({ first: () => items[0], all: () => items }, env, () => staticData)
}

test('send workflow preserves the required approval chain and Gmail configuration', () => {
  const names = sendWorkflow.nodes.map((node) => node.name)
  const expected = [
    'Webhook - Approved Dispute Send',
    'Validate Approved Dispute',
    'Gmail - Send Approved Dispute',
    'Build Send Receipt',
    'Respond - Dispute Sent',
  ]

  for (const name of expected) {
    assert.ok(names.includes(name), `missing node ${name}`)
  }

  assert.ok(
    names.indexOf('Webhook - Approved Dispute Send') <
      names.indexOf('Gmail - Send Approved Dispute'),
  )

  const webhook = findNode(sendWorkflow, 'Webhook - Approved Dispute Send')
  assert.equal(webhook.parameters.httpMethod, 'POST')
  assert.equal(webhook.parameters.responseMode, 'responseNode')

  const gmail = findNode(sendWorkflow, 'Gmail - Send Approved Dispute')
  assert.equal(gmail.type, 'n8n-nodes-base.gmail')
  assert.equal(gmail.credentials?.gmailOAuth2.name, 'Gmail account')
  assert.equal(gmail.parameters.sendTo, '={{ $json.recipient }}')
  assert.equal(gmail.parameters.subject, '={{ $json.subject }}')
  assert.equal(gmail.parameters.message, '={{ $json.message }}')
  assert.equal(gmail.retryOnFail, true)
  assert.equal(gmail.maxTries, 3)

  const serialized = JSON.stringify(sendWorkflow)
  assert.ok(!serialized.includes('replace_with_n8n_webhook_secret'), 'secret must not be hard-coded')
  assert.ok(!serialized.includes('$env.N8N_WEBHOOK_SECRET='), 'secret must come from env')
  // The dispute workflow must never call the audit workflow endpoints.
  assert.ok(!serialized.includes('/api/webhooks/n8n/audit-results'))
  assert.ok(!serialized.includes('/api/webhooks/n8n/statements'))
})

test('validates an approved dispute payload and preserves its idempotency key', () => {
  const [result] = runSendValidate(sendRequest())

  assert.deepEqual(result.json, {
    idempotencyKey: 'dispute-7',
    disputeId: 7,
    recipient: 'royalties@example.com',
    subject: 'Royalty discrepancy',
    message: 'Please review the reported payout.',
    idempotentReplay: false,
  })
})

test('accepts the secret when the header casing differs', () => {
  const [result] = runSendValidate(
    sendRequest({ headers: { 'X-N8N-Webhook-Secret': 'shared-secret' } }),
  )

  assert.equal(result.json.disputeId, 7)
})

test('rejects a missing webhook secret', () => {
  assert.throws(() => runSendValidate(sendRequest({ headers: {} })), /Invalid or missing webhook secret/)
})

test('rejects an invalid webhook secret', () => {
  assert.throws(
    () => runSendValidate(sendRequest({ headers: { 'x-n8n-webhook-secret': 'wrong' } })),
    /Invalid or missing webhook secret/,
  )
})

test('rejects when the workflow secret is not configured', () => {
  assert.throws(() => runSendValidate(sendRequest(), {}), /N8N_WEBHOOK_SECRET is not configured/)
})

test('rejects a payload without an idempotency key', () => {
  assert.throws(
    () => runSendValidate(sendRequest({ body: { idempotencyKey: '' } })),
    /idempotencyKey is required/,
  )
})

test('rejects an incomplete draft payload', () => {
  assert.throws(
    () => runSendValidate(sendRequest({ body: { dispute: undefined } })),
    /dispute payload is required/,
  )
  assert.throws(
    () =>
      runSendValidate(
        sendRequest({ body: { dispute: { id: 7, recipient: '', subject: 's', body: 'b' } } }),
      ),
    /recipient must be a valid email address/,
  )
  assert.throws(
    () =>
      runSendValidate(
        sendRequest({
          body: { dispute: { id: 7, recipient: 'a@b.co', subject: '', body: 'b' } },
        }),
      ),
    /subject is required/,
  )
  assert.throws(
    () =>
      runSendValidate(
        sendRequest({
          body: { dispute: { id: 7, recipient: 'a@b.co', subject: 's', body: '' } },
        }),
      ),
    /body is required/,
  )
  assert.throws(
    () =>
      runSendValidate(
        sendRequest({ body: { dispute: { id: 0, recipient: 'a@b.co', subject: 's', body: 'b' } } }),
      ),
    /dispute.id must be a positive integer/,
  )
})

test('replays the stored receipt instead of re-sending for a repeated idempotency key', () => {
  const staticData: Record<string, unknown> = {
    sentReceipts: {
      'dispute-7': {
        success: true,
        idempotencyKey: 'dispute-7',
        disputeId: 7,
        recipient: 'royalties@example.com',
        subject: 'Royalty discrepancy',
        messageId: 'gmail-message-1',
        sentAt: '2026-01-02T00:00:00.000Z',
      },
    },
  }

  const [result] = runSendValidate(sendRequest(), { N8N_WEBHOOK_SECRET: 'shared-secret' }, staticData)

  assert.equal(result.json.idempotentReplay, true)
  assert.equal(result.json.messageId, 'gmail-message-1')
})

test('builds a structured Gmail send receipt and stores it for idempotency', () => {
  const staticData: Record<string, unknown> = {}
  const execute = new Function('$input', '$', '$getWorkflowStaticData', sendReceiptCode) as (
    input: { first: () => WorkflowItem },
    lookup: (name: string) => { first: () => WorkflowItem },
    getStatic: (key: string) => Record<string, unknown>,
  ) => WorkflowItem[]

  const [receipt] = execute(
    { first: () => ({ json: { id: 'gmail-message-1', threadId: 'thread-1' } }) },
    (name: string) => {
      assert.equal(name, 'Validate Approved Dispute')
      return {
        first: () => ({
          json: {
            idempotencyKey: 'dispute-7',
            disputeId: 7,
            recipient: 'royalties@example.com',
            subject: 'Royalty discrepancy',
            message: 'Please review.',
          },
        }),
      }
    },
    () => staticData,
  )

  assert.equal(receipt.json.success, true)
  assert.equal(receipt.json.messageId, 'gmail-message-1')
  assert.equal(receipt.json.provider, 'gmail')
  assert.equal((staticData.sentReceipts as Record<string, unknown>)['dispute-7'], receipt.json)
})

const draftValidateCode = findNode(draftWorkflow, 'Validate Draft Request').parameters.jsCode as string
const draftPromptCode = findNode(draftWorkflow, 'Build Dispute Draft Prompt').parameters.jsCode as string
const draftValidateOutputCode = findNode(draftWorkflow, 'Validate Draft Output').parameters.jsCode as string

const VERIFIED_FACTS = {
  discrepancyId: 3,
  auditId: 2,
  statementId: 5,
  platform: 'Spotify',
  statementPeriod: '2026-Q1',
  trackName: 'Sunset Echo',
  plays: '150000',
  territory: 'NG',
  actualPayout: '450.00',
  expectedPayout: '600.00',
  difference: '150.00',
  threshold: '0.00',
  discrepancyStatus: 'open',
  artistName: 'Demo Artist',
}

function draftRequest(facts: unknown = VERIFIED_FACTS, secret = 'shared-secret'): WorkflowItem {
  return {
    json: {
      headers: { 'x-n8n-webhook-secret': secret },
      body: { discrepancy: facts },
    },
  }
}

function runDraftValidate(
  item: WorkflowItem,
  secret: string | undefined = 'shared-secret',
): WorkflowItem[] {
  const items = [item]
  const execute = new Function('$input', '$env', draftValidateCode) as (
    input: { first: () => WorkflowItem; all: () => WorkflowItem[] },
    env: Record<string, string | undefined>,
  ) => WorkflowItem[]

  return execute({ first: () => items[0], all: () => items }, { N8N_WEBHOOK_SECRET: secret })
}

function runDraftOutput(output: unknown): WorkflowItem[] {
  const execute = new Function('$input', '$', draftValidateOutputCode) as (
    input: { first: () => WorkflowItem },
    lookup: (name: string) => { first: () => WorkflowItem },
  ) => WorkflowItem[]

  return execute({ first: () => ({ json: { output } }) }, (name: string) => {
    assert.equal(name, 'Validate Draft Request')
    return { first: () => ({ json: { facts: VERIFIED_FACTS } }) }
  })
}

test('draft workflow wires the Gemini extractor with a strict draft schema', () => {
  const names = draftWorkflow.nodes.map((node) => node.name)
  for (const name of [
    'Webhook - Request Dispute Draft',
    'Validate Draft Request',
    'Build Dispute Draft Prompt',
    'Information Extractor - Dispute Draft',
    'Validate Draft Output',
    'Respond - Dispute Draft',
  ]) {
    assert.ok(names.includes(name), `missing node ${name}`)
  }

  const webhook = findNode(draftWorkflow, 'Webhook - Request Dispute Draft')
  assert.equal(webhook.parameters.httpMethod, 'POST')
  assert.equal(webhook.parameters.responseMode, 'responseNode')

  const extractor = findNode(draftWorkflow, 'Information Extractor - Dispute Draft')
  assert.equal(extractor.type, '@n8n/n8n-nodes-langchain.informationExtractor')
  assert.equal(extractor.typeVersion, 1.2)
  assert.equal(extractor.parameters.schemaType, 'manual')

  const schema = JSON.parse(extractor.parameters.inputSchema as string) as {
    additionalProperties: boolean
    required: string[]
    properties: Record<string, unknown>
  }
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(schema.required.sort(), ['body', 'facts_used', 'missing_information', 'subject'])
  assert.deepEqual(Object.keys(schema.properties).sort(), [
    'body',
    'facts_used',
    'missing_information',
    'subject',
  ])

  const gemini = findNode(draftWorkflow, 'Google Gemini Chat Model - Configure Credential')
  assert.equal(gemini.type, '@n8n/n8n-nodes-langchain.lmChatGoogleGemini')
  assert.equal(gemini.credentials?.googlePalmApi.name, 'Google Gemini(PaLM) Api account')

  const serialized = JSON.stringify(draftWorkflow)
  assert.ok(!serialized.includes('/api/webhooks/n8n/audit-results'))
  assert.ok(!serialized.includes('replace_with_n8n_webhook_secret'))
})

test('draft request validation accepts only verified facts with a valid secret', () => {
  const [result] = runDraftValidate(draftRequest())
  assert.deepEqual(result.json.facts, VERIFIED_FACTS)

  assert.throws(() => runDraftValidate(draftRequest(VERIFIED_FACTS, 'wrong')), /Invalid or missing webhook secret/)

  const missingHeader: WorkflowItem = { json: { headers: {}, body: { discrepancy: VERIFIED_FACTS } } }
  assert.throws(() => runDraftValidate(missingHeader), /Invalid or missing webhook secret/)
})

test('draft request validation rejects missing discrepancy facts', () => {
  const missingFacts: WorkflowItem = {
    json: { headers: { 'x-n8n-webhook-secret': 'shared-secret' }, body: {} },
  }
  assert.throws(() => runDraftValidate(missingFacts), /discrepancy facts are required/)

  const { trackName, ...partial } = VERIFIED_FACTS
  assert.throws(() => runDraftValidate(draftRequest(partial)), /discrepancy facts are missing: trackName/)
})

test('draft prompt builder includes the verified facts and guardrails', () => {
  const execute = new Function('$input', draftPromptCode) as (input: {
    first: () => WorkflowItem
  }) => WorkflowItem[]

  const [built] = execute({ first: () => ({ json: { facts: VERIFIED_FACTS } }) })
  const prompt = built.json.prompt as string

  assert.ok(prompt.includes('Sunset Echo'))
  assert.ok(prompt.includes('ONLY the verified facts'))
  assert.ok(prompt.includes('Do not calculate'))
  assert.ok(
    prompt.includes('{"subject":"string","body":"string","facts_used":[],"missing_information":[]}'),
  )
})

test('draft output validation returns a normalised draft', () => {
  const [result] = runDraftOutput({
    subject: '  Royalty discrepancy for Sunset Echo  ',
    body: 'Please review the reported payout for Sunset Echo.',
    facts_used: ['trackName', 'difference'],
    missing_information: ['contract reference'],
  })

  assert.equal(result.json.subject, 'Royalty discrepancy for Sunset Echo')
  assert.deepEqual(result.json.facts_used, ['trackName', 'difference'])
  assert.deepEqual(result.json.missing_information, ['contract reference'])
})

test('draft output validation rejects invented fields and unsupported fact paths', () => {
  assert.throws(
    () =>
      runDraftOutput({
        subject: 's',
        body: 'b',
        facts_used: [],
        missing_information: [],
        expectedPayout: '600.00',
      }),
    /unsupported field expectedPayout/,
  )

  assert.throws(
    () =>
      runDraftOutput({
        subject: 's',
        body: 'b',
        facts_used: ['contractTerm'],
        missing_information: [],
      }),
    /facts_used contains unsupported fact path contractTerm/,
  )
})

test('draft output validation rejects missing or malformed fields', () => {
  assert.throws(
    () => runDraftOutput({ subject: '', body: 'b', facts_used: [], missing_information: [] }),
    /subject is required/,
  )
  assert.throws(
    () => runDraftOutput({ subject: 's', body: 'b', facts_used: 'trackName', missing_information: [] }),
    /facts_used must be an array/,
  )
  assert.throws(
    () => runDraftOutput({ subject: 's', body: 'b', facts_used: [], missing_information: 'none' }),
    /missing_information must be an array/,
  )
})


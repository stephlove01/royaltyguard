
import 'dotenv/config'
import app from './app'
import { buildDisputeWebhookUrl } from './services/disputeSendService'

const port = process.env.PORT || 5000

console.log('[RoyaltyGuard send configuration]', {
  webhookUrlConfigured: Boolean(
    buildDisputeWebhookUrl(
      process.env.N8N_BASE_URL,
      process.env.N8N_DISPUTE_WEBHOOK_PATH,
    ),
  ),
  webhookSecretConfigured: Boolean(
    process.env.N8N_WEBHOOK_SECRET?.trim(),
  ),
  webhookHeaderNameConfigured: Boolean(
    process.env.N8N_WEBHOOK_HEADER_NAME?.trim(),
  ),
})

app.listen(port, () => {
  console.log(`RoyaltyGuard API running on port ${port}`)
})

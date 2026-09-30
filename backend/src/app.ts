import cors from 'cors'
import express from 'express'
import authRoutes from './routes/authRoutes'
import healthRoutes from './routes/healthRoutes'
import statementsRoutes from './routes/statementsRoutes'
import auditsRoutes from './routes/auditsRoutes'
import discrepanciesRoutes from './routes/discrepanciesRoutes'
import disputesRoutes from './routes/disputesRoutes'
import n8nRoutes from './routes/n8nRoutes'
import errorHandler from './middleware/errorHandler'

const app = express()

app.use(cors())
app.use(express.json())
app.use('/api', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/statements', statementsRoutes)
app.use('/api/audits', auditsRoutes)
app.use('/api/discrepancies', discrepanciesRoutes)
app.use('/api/disputes', disputesRoutes)
app.use('/api/webhooks/n8n', n8nRoutes)

app.get('/', (_req, res) => {
  res.json({
    message: 'RoyaltyGuard API is running',
  })
})

app.use(errorHandler)

export default app
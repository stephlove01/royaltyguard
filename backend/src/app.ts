import cors from 'cors'
import express from 'express'
import authRoutes from './routes/authRoutes'
import healthRoutes from './routes/healthRoutes'
import statementsRoutes from './routes/statementsRoutes'
import errorHandler from './middleware/errorHandler'

const app = express()

app.use(cors())
app.use(express.json())
app.use('/api', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/statements', statementsRoutes)

app.get('/', (_req, res) => {
  res.json({
    message: 'RoyaltyGuard API is running',
  })
})

app.use(errorHandler)

export default app
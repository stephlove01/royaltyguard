import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 5000

app.get('/', (_req, res) => {
  res.json({
    message: 'RoyaltyGuard API is running',
  })
})

app.listen(PORT, () => {
  console.log(`RoyaltyGuard API running on port ${PORT}`)
})
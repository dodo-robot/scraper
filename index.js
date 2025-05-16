import express from 'express'
import { searchWines, getWineDetails } from './scraper.js'
import { generateWineDescription } from './sommellier.js'

const app = express()
const PORT = process.env.PORT || 4000

app.get('/search', async (req, res) => {
  const query = req.query.query
  if (!query) return res.status(400).json({ error: 'Missing query param' })

  try {
    const results = await searchWines(query)
    res.json(results)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Search failed' })
  }
})

app.get('/details', async (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).json({ error: 'Missing url param' })

  try {
    const details = await getWineDetails(url)
    const { wine, reviews, wineFacts, foodPairings } = details
    const wineData = {
      reviews: reviews,
      wineFacts: wineFacts,
      foodPairings: foodPairings,
    }
    const description = await generateWineDescription(wineData, 'it')
    details.description = description
    
    res.json(details)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Detail fetch failed' })
  }
})

 

app.listen(PORT, () => {
  console.log(`🍷 Vivino API running on port ${PORT}`)
})

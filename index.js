import express from 'express'
import { searchWines, getWineDetails } from './scraper.js'
import {
  generateWineDescription,
  generateDescriptionFromWine,
  recommendWinesPerDish
} from './sommellier.js'
import { retry } from './utils.js'

const app = express()
const PORT = process.env.PORT || 4000

// Add this middleware to parse JSON bodies
app.use(express.json())

app.get('/search', async (req, res) => {
  const query = req.query.query
  if (!query) return res.status(400).json({ error: 'Missing query param' })

  try {
    const results = await retry(() => searchWines(query), 3)
    res.json(results)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Search failed after retries' })
  }
})

app.post('/pairings', async (req, res) => {
  try {
    const {
      dish,
      wines,
    } = req.body // ✅ use req.body, not req.json()
    const {recommendations, usage} = await retry(() => recommendWinesPerDish(dish, wines), 3)

    const result = { 
      recommendations: recommendations,
      usage: usage,
    }

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Suggestions fetch failed after retries' })
  }
})


app.get('/details', async (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).json({ error: 'Missing url param' })

  try {
    const details = await retry(() => getWineDetails(url), 3)
    const { wine, reviews, wineFacts, foodPairings } = details
    const wineData = { reviews, wineFacts, foodPairings }

    const {description, usage} = await retry(
      () => generateWineDescription(wineData, 'it'),
      2
    )

    wine.description = description
    wine.foodPairings = foodPairings

    const result = { 
      wine: wine,
      usage: usage,
    }

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Detail fetch failed after retries' })
  }
})

app.post('/description', async (req, res) => {
  try {
    const {
      name,
      wineType,
      grape,
      region,
      country,
      year,
      winery,
      description,
    } = req.body // ✅ use req.body, not req.json()

    if (!name || !wineType || !grape) {
      return res
        .status(400)
        .json({ error: 'Missing required wine fields (name, wineType, grape)' })
    }

    const res = await retry(
      () =>
        generateDescriptionFromWine(
          { name, wineType, grape, region, country, year, winery, description },
          'it'
        ),
      2
    )

    const wine = {
      name,
      wineType,
      grape,
      region,
      country,
      year,
      winery,
      description: res.description,
    }

    const result = { 
      wine: wine,
      usage: res.usage,
    }


    res.json(result)
  } catch (err) {
    console.error('Error generating wine description:', err)
    res
      .status(500)
      .json({ error: 'Description generation failed after retries' })
  }
})

app.listen(PORT, () => {
  console.log(`🍷 Vivino API running on port ${PORT}`)
})

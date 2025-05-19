import express from 'express'
import { searchWines, getWineDetails } from './scraper.js'
import {
  generateWineDescription,
  generateDescriptionFromWine,
} from './sommellier.js'
import { retry } from './utils.js'

const app = express()
const PORT = process.env.PORT || 4000

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

app.get('/details', async (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).json({ error: 'Missing url param' })

  try {
    const details = await retry(() => getWineDetails(url), 3)
    const { wine, reviews, wineFacts, foodPairings } = details
    const wineData = { reviews, wineFacts, foodPairings }

    const description = await retry(
      () => generateWineDescription(wineData, 'it'),
      2
    )

    wine.description = description
    wine.foodPairings = foodPairings

    res.json(wine)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Detail fetch failed after retries' })
  }
})


app.post('/description', async (req, res) => {
  try {
    const body = await req.json() // <- THIS is key
    const {
      name,
      wineType,
      grape,
      region,
      country,
      year,
      winery,
      description,
    } = body

    if (!name || !wineType || !grape) {
      return res
        .status(400)
        .json({ error: 'Missing required wine fields (name, wineType, grape)' })
    }

    const generatedDescription = await retry(
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
      generatedDescription,
    }

    res.json(wine)
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

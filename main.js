import { getWineDetails } from './scraper.js'
import { generateWineDescription } from './sommellier.js'
import * as cheerio from 'cheerio'

async function main() {
  try {
    const data = await getWineDetails('/IT/it/wines/1894613')

    console.log(data)
    const { wine, reviews, wineFacts, foodPairings } = data
    const wineData = {
      reviews: reviews,
      wineFacts: wineFacts,
      foodPairings: foodPairings,
    }
    const italianDesc = await generateWineDescription(wineData, 'it')
    console.log(italianDesc)
  } catch (error) {
    console.error('Error in main:', error)
  }
}

main()

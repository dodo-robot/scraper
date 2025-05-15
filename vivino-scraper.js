import { chromium } from 'playwright'
  
;(async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119 Safari/537.36',
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  const page = await context.newPage()
  await page.goto('https://www.vivino.com/search/wines?q=bianco', {
    timeout: 60000,
  })
  await page.waitForSelector('div.wine-card', { timeout: 15000 })

  const wines = await page.$$eval('div.wine-card', (cards) => {
    return cards.map((card) => {
      const nameElement = card.querySelector('a.wine-card__name')
      const wineryElement = card.querySelector('div.wine-card__winery')
      const regionElement = card.querySelector('div.wine-card__region')
      const imageElement = card.querySelector('div.wine-card__image')

      const name = nameElement ? nameElement.textContent.trim() : null
      const winery = wineryElement ? wineryElement.textContent.trim() : null
      const region = regionElement ? regionElement.textContent.trim() : null

      let image = null
      if (imageElement) {
        const style = imageElement.getAttribute('style')
        const match = style && style.match(/url\(["']?(.*?)["']?\)/)
        image = match ? match[1] : null
      }

      return { name, winery, region, image }
    })
  })

  console.log(wines)
  await browser.close()
})()

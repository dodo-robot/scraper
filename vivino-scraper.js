const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({ headless: false }) // set to true when done debugging
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  })

  const page = await context.newPage()

  // 🕵️‍♂️ Add stealth-like JS tricks
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    window.chrome = { runtime: {} }
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] })
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    })
  })

  const search = 'shiraz'
  const url = `https://www.vivino.com/search/wines?q=${encodeURIComponent(
    search
  )}`

  console.log('Navigating to', url)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

  await page.waitForSelector('.search-results-list .card', { timeout: 15000 })

  const wines = await page.$$eval('.search-results-list .card', (cards) =>
    cards.map((card) => {
      const name = card.querySelector('.bold')?.innerText?.trim()
      const imageStyle = card
        .querySelector('.wine-card__image-wrapper')
        ?.getAttribute('style')
      const image = imageStyle?.match(/url\("(.+?)"\)/)?.[1] ?? null
      const href = card
        .querySelector('[data-cartitemsource="text-search"]')
        ?.getAttribute('href')
      const url = href ? `https://www.vivino.com${href}` : null
      return { name, image, url }
    })
  )

  console.log('✅ Found wines:', wines.slice(0, 5))
  await browser.close()
})()

import { chromium, Browser, Page } from 'playwright'

let browser: Browser | null = null
let page: Page | null = null

async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119 Safari/537.36',
    })
    page = await context.newPage()
  }
  return page
}

export async function closeBrowser() {
  if (browser) {
    await browser.close()
    browser = null
    page = null
  }
}

export async function searchWines(query: string) {
  const page = await initBrowser()

  await page.goto(
    `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`,
    { timeout: 60000 }
  )
  await page.waitForSelector('.search-results-list .card', { timeout: 15000 })

  const wines = await page.$$eval('.search-results-list .card', (cards) => {
    return cards
      .map((card) => {
        try {
          const content = card.querySelector('.wine-card__content')
          const figure = card.querySelector('.wine-card__image-wrapper')

          const hrefElement = content?.querySelector(
            '[data-cartitemsource="text-search"]'
          )
          const uri = hrefElement?.getAttribute('href') || null

          const imageStyle =
            figure?.querySelector('.wine-card__image')?.getAttribute('style') ||
            ''
          const imageMatch = imageStyle.match(/url\(["']?(.*?)["']?\)/)
          const image = imageMatch ? imageMatch[1] : null

          const name = card.querySelector('.bold')?.textContent?.trim() || null

          const countryHref =
            content
              ?.querySelector('[data-item-type="country"]')
              ?.getAttribute('href') || ''
          const country = countryHref.replace('/wine-countries/', '') || null

          return { url: uri, image, name, country }
        } catch (err) {
          return null
        }
      })
      .filter(Boolean)
  })

  return wines
}

export async function getWineDetails(wineUrl: string) {
  const page = await initBrowser()
  const fullUrl = `https://www.vivino.com${wineUrl}`

  await page.goto(fullUrl, { timeout: 60000 })
  await page.waitForSelector('.wineHeadline-module__wineHeadline--32Ety', {
    timeout: 15000,
  })

  const wine = await page.evaluate(() => {
    try {
      const getText = (selector: string) =>
        document.querySelector(selector)?.textContent?.trim() || null

      const srcImg = (() => {
        const preloadLinks = Array.from(
          document.querySelectorAll('link[rel="preload"][as="image"]')
        )
        const wineImage = preloadLinks.find((link) =>
          /vivino\.com\/thumbs\/.*\.(png|jpg)/.test(link.href)
        )
        return wineImage?.href || null
      })()

      const winery = getText('a.wineHeadline-module__link--G1mKm div')
      const wineName =
        document
          .querySelector('div.wineHeadline-module__wineHeadline--32Ety')
          ?.lastChild?.textContent.trim() || null

      const region = getText('[data-cy="breadcrumb-region"]')
      const country = getText('[data-cy="breadcrumb-country"]')
      const wineType = getText('[data-cy="breadcrumb-winetype"]')
      const grape = getText('[data-cy="breadcrumb-grape"]')

      return {
        url: window.location.href,
        image: srcImg,
        name: wineName,
        winery,
        wine_type: wineType,
        region,
        country,
        grape,
      }
    } catch (err) {
      console.error('Error extracting wine details:', err)
      return null
    }
  })

  return wine
}

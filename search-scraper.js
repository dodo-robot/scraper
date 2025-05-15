import { chromium } from 'playwright'
import fs from 'fs'

;(async () => {
  const browser = await chromium.launch({
    headless: true,
  })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119 Safari/537.36',
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  await context.addCookies([
    {
      name: 'cookieConsent',
      value: 'true',
      domain: '.vivino.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    },
  ])

  const page = await context.newPage()

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'language', { get: () => 'en-US' })
    window.localStorage.setItem('vivino_user_country', '"US"')
  })

  await page.route('**/*', (route) => {
    const url = route.request().url()
    const blocked = ['cookielaw', 'consent', 'onetrust', 'braze', 'datadog']
    if (blocked.some((b) => url.includes(b))) return route.abort()
    return route.continue()
  })

  const query = 'bianco'
  await page.goto(
    `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`,
    { timeout: 60000 }
  )

  await page.evaluate(() => {
    ;['#onetrust-banner-sdk', '#consent-blocker', '.popup', '.overlay'].forEach(
      (sel) => document.querySelector(sel)?.remove()
    )
  })

  const html = await page.content()
  fs.writeFileSync('vivino_search_results.html', html)

  await page.waitForLoadState('networkidle')

  // Confirm cards loaded
  await page.waitForFunction(
    () => document.querySelectorAll('.default-wine-card').length > 0
  )

  const wineCards = await page.$$('.default-wine-card')
  console.log('Wine card count:', wineCards.length)
  // Adjust the selector based on the current structure
  /* await page.waitForSelector('div[class^="wineCard__wineCard"]', {
    state: 'attached',
    timeout: 15000,
  }) */

  const wines = await page.$$eval('.default-wine-card', (cards) =>
    cards
      .map((card) => {
        try {
          const imageWrapper = card.querySelector('.wine-card__image-wrapper a')
          const href = imageWrapper?.getAttribute('href') || null

          const style =
            card
              .querySelector('figure.wine-card__image')
              ?.getAttribute('style') || ''
          const imageMatch = style.match(/url\(["']?(.*?)["']?\)/)
          const image = imageMatch ? `https:${imageMatch[1]}` : null

          const name =
            card.querySelector('.wine-card__name .bold')?.textContent?.trim() ||
            null
          const regionText =
            card.querySelector('.wine-card__region')?.textContent?.trim() ||
            null

          const countryHref =
            card
              .querySelector('.wine-card__region a[data-item-type="country"]')
              ?.getAttribute('href') || ''
          const country = countryHref.replace('/wine-countries/', '') || null

          return { url: href, image, name, region: regionText, country }
        } catch (err) {
          return null
        }
      })
      .filter(Boolean)
  )

  console.log(wines)
  await browser.close()
})()

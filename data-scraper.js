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


  await page.evaluate(() => {
    ;['#onetrust-banner-sdk', '#consent-blocker', '.popup', '.overlay'].forEach(
      (sel) => document.querySelector(sel)?.remove()
    )
  })

  const html = await page.content()
  fs.writeFileSync('vivino_results.html', html)

  await page.waitForLoadState('networkidle')
 
  const wineUrl = '/IT/it/wines/1894613'
  const fullUrl = `https://www.vivino.com${wineUrl}`
  await page.goto(fullUrl, { timeout: 60000 })

  await page.waitForSelector('.wineHeadline-module__wineHeadline--32Ety', {
    timeout: 15000,
  })

  const wine = await page.evaluate(() => {
    try {
      const getText = (selector) =>
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


  console.log(wine)
  await browser.close()
})()

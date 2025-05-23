import { chromium } from 'playwright'
import { loadProxies, getNextProxy } from './proxyRotator.js'

let browser = null
let context = null

async function initBrowser() {
  if (browser) return browser
  return await chromium.launch({ headless: true })
}

export async function closeBrowser() {
  if (browser) {
    await browser.close()
    browser = null
    context = null
  }
}

import { chromium } from 'playwright'

export async function createBrowserWithProxy(proxyUrl) {
  const browser = await chromium.launch({
    headless: true,
    proxy: {
      server: proxyUrl, // e.g., http://user:pass@ip:port
    },
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
  return { browser, context, page }
}

export async function searchWines(query) {
  const proxyUrl = await getNextProxy() // e.g., 'http://user:pass@ip:port'
  const { browser,context,  page } = await createBrowserWithProxy(proxyUrl)

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

  await page.goto(
    `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`,
    { timeout: 60000 }
  )
  await page.evaluate(() => {
    ;['#onetrust-banner-sdk', '#consent-blocker', '.popup', '.overlay'].forEach(
      (sel) => document.querySelector(sel)?.remove()
    )
  })

  await page.waitForLoadState('networkidle')

  await page.waitForFunction(
    () => document.querySelectorAll('.default-wine-card').length > 0
  )

  const wineCards = await page.$$('.default-wine-card')
  console.log('Wine card count:', wineCards.length)

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

  await page.close()
  return wines
}

export async function getWineDetails(wineUrl) {
  browser = await initBrowser()
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

  await page.close()
  return wine
}

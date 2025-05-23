import axios from 'axios'
import * as cheerio from 'cheerio'
import { loadProxies, getNextProxy, fetchWithProxy } from './proxyRotator.js'
import fs from 'fs'
import { chromium } from 'playwright'

export async function createBrowserWithProxy(proxyUrl) {
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
  return { browser, context, page }
}

let browserPool = []
let currentBrowserIndex = 0

export async function initializeBrowserPool() {
  
  const proxies = await loadProxies() // Assumes this gives you proxy list

  browserPool = await Promise.all(
    proxies.slice(0, 10).map(async (proxy) => {
      const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
      const browserEntry = await createBrowserWithProxy(proxyUrl)
      return browserEntry
    })
  )
}



function getNextBrowser() {
  if (browserPool.length === 0) throw new Error('Browser pool is empty')
  const browserEntry = browserPool[currentBrowserIndex]
  currentBrowserIndex = (currentBrowserIndex + 1) % browserPool.length
  return browserEntry
}

async function safeText(page, selector, label) {
  try {
    const el = await page.$(selector)
    if (!el) {
      console.warn(`Missing element: ${label} (${selector})`)
      return null
    }
    return (await el.textContent())?.trim()
  } catch (e) {
    console.error(`Failed to get ${label}:`, e)
    return null
  }
}


export async function searchWines(query) {
  await loadProxies()

  const data = await fetchWithProxy(
    `https://www.vivino.com/search/wines?q=${query}`
  )
  const $ = cheerio.load(data)
  const results = []

  $('.default-wine-card').each((_, el) => {
    const element = $(el)
    const name = element.find('.wine-card__name .bold').text().trim()
    const regionText = element.find('.wine-card__region').text().trim()
    const href =
      element.find('.wine-card__image-wrapper a').attr('href') || null

    const style = element.find('figure.wine-card__image').attr('style') || ''
    const imageMatch = style.match(/url\(["']?(.*?)["']?\)/)
    const image = imageMatch ? `https:${imageMatch[1]}` : null

    const countryHref = element
      .find('.wine-card__region a[data-item-type="country"]')
      .attr('href')
    const country = countryHref
      ? countryHref.replace('/wine-countries/', '')
      : null

    results.push({ url: href, image, name, region: regionText, country })
  })

  return results
}

export async function getWineDetails(wineUrl) {
  try {
    if (browserPool.length == 0) { 
      await initializeBrowserPool()

    }
    const { browser, context, page } = getNextBrowser()
    const fullUrl = `https://www.vivino.com${wineUrl}`

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

    await page.goto(fullUrl, { waitUntil: 'domcontentloaded' })

    // Scroll to load dynamic content (like reviews)
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0
        const distance = 100
        const timer = setInterval(() => {
          window.scrollBy(0, distance)
          totalHeight += distance

          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer)
            resolve()
          }
        }, 100)
      })
    })

    await page.evaluate(() => {
      ;[
        '#onetrust-banner-sdk',
        '#consent-blocker',
        '.popup',
        '.overlay',
      ].forEach((sel) => document.querySelector(sel)?.remove())
    })

    let reviews = []

    const hasReviews = await page.$('[data-testid="communityReview"]')
    if (hasReviews) {
      reviews = await page.$$eval(
        '[data-testid="communityReview"]',
        (reviewEls) =>
          reviewEls.slice(0, 3).map((el) => {
            const ps = el.querySelectorAll('p')
            return Array.from(ps)
              .map((p) => p.textContent.trim())
              .join('\n')
          })
      )
    }


    const wineFacts = await page.$$eval('.wineFacts__fact--3BAsi', (factEls) =>
      factEls.map((el) => el.textContent.trim())
    )

    const foodPairings = await page.$$eval(
      '.foodPairing__foodImage--2OYHg',
      (factEls) => factEls.map((el) => el.getAttribute('aria-label'))
    )

    // Get structured wine data
    const winery = await page.$eval(
      'a.wineHeadline-module__link--G1mKm div',
      (el) => el.textContent.trim()
    )

    const wineName = await page.$eval(
      'div.wineHeadline-module__wineHeadline--32Ety',
      (el) => el.lastChild.textContent.trim()
    )
    const region = await safeText(
      page,
      '[data-cy="breadcrumb-region"]',
      'region'
    )
    const country = await safeText(
      page,
      '[data-cy="breadcrumb-country"]',
      'country'
    )
    const wineType = await safeText(
      page,
      '[data-cy="breadcrumb-winetype"]',
      'winetype'
    )

    const grape = await safeText(page, '[data-cy="breadcrumb-grape"]', 'grape')


    const image = await page.getAttribute(
      'link[rel="preload"][as="image"]',
      'href'
    )
    const fullImage =
      image && image.startsWith('//') ? `https:${image}` : image || null

    const wine = {
      url: wineUrl,
      image: fullImage,
      name: wineName,
      winery,
      wine_type: wineType,
      region,
      country,
      grape,
    }

    return { wine, reviews, wineFacts, foodPairings }
  } catch (err) {
    console.error('Error in getWineDetails:', err)
    return null
  }
}

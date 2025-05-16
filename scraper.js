import axios from 'axios'
import * as cheerio from 'cheerio'
import { loadProxies, getNextProxy, fetchWithProxy  } from './proxyRotator.js'
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


export async function getTopReviews(wineUrl) {
  try {
    await loadProxies()
    const proxy = await getNextProxy() // e.g., 'http://user:pass@ip:port'
    const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`

    const { browser, context, page } = await createBrowserWithProxy(proxyUrl)
    console.log('reviews')
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

    // Now wait for reviews to appear
    await page.waitForSelector('[data-testid="communityReview"]', {
      timeout: 10000,
    })

    await page.evaluate(() => {
      ;[
        '#onetrust-banner-sdk',
        '#consent-blocker',
        '.popup',
        '.overlay',
      ].forEach((sel) => document.querySelector(sel)?.remove())
    })

    await page.waitForSelector('[data-testid="communityReview"]', {
      timeout: 10000,
    })

    const reviews = await page.$$eval(
      '[data-testid="communityReview"]',
      (reviewEls) =>
        reviewEls.slice(0, 3).map((el) => {
          const ps = el.querySelectorAll('p')
          return Array.from(ps)
            .map((p) => p.textContent.trim())
            .join('\n')
        })
    )

    const wineFacts = await page.$$eval('.wineFacts__fact--3BAsi', (factEls) =>
      factEls.map((el) => el.textContent.trim())
    )

    const foodPairings = await page.$$eval(
      '.foodPairing__foodImage--2OYHg',
      (factEls) => factEls.map((el) => el.getAttribute('aria-label'))
    )
     

    
    if (browser) {
      await browser.close()
    }

    return { reviews, wineFacts, foodPairings }
  } catch (err) {
    console.error('Error in getTopReviews:', err)
    return []
  }  
}



export async function getWineDetails(url) {
  try {

    await loadProxies()
    const data = await fetchWithProxy(`https://www.vivino.com${url}`)

    const $ = cheerio.load(data)

    const getText = (selector) => $(selector).text().trim() || null

    const srcImg = $('link[rel="preload"][as="image"]')
      .map((i, el) => $(el).attr('href'))
      .get()
      .find((href) => /vivino\.com\/thumbs\/.*\.(png|jpg)/.test(href))

    const image = srcImg?.startsWith('//') ? `https:${srcImg}` : srcImg || null


    const winery = $('a.wineHeadline-module__link--G1mKm div').text().trim()
    const wineName = $('div.wineHeadline-module__wineHeadline--32Ety')
      .contents()
      .last()
      .text()
      .trim()

    const region = $('[data-cy="breadcrumb-region"]').text().trim()
    const country = $('[data-cy="breadcrumb-country"]').text().trim()
    const wineType = $('[data-cy="breadcrumb-winetype"]').text().trim()
    const grape = $('[data-cy="breadcrumb-grape"]').text().trim()

    const result = {
      url,
      image: image,
      name: wineName,
      winery,
      wine_type: wineType,
      region,
      country,
      grape,
    }

    console.log(result)
    return result
  } catch (err) {
    console.error('Scraping failed:', err.message)
    return null
  }
}

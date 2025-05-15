import axios from 'axios'
import * as cheerio from 'cheerio'
import { loadProxies, getNextProxy, fetchWithProxy } from './proxyRotator.js'

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

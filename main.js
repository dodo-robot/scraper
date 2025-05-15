import { loadProxies, fetchWithProxy } from './proxyRotator.js'
import * as cheerio from 'cheerio'


async function main() {
    await loadProxies()

    const data = await fetchWithProxy(
      'https://www.vivino.com/search/wines?q=bianco'
    )

    console.log(data)
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

    console.log(results)

}

main()

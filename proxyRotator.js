import axios from 'axios'
import dotenv from 'dotenv'

import { HttpsProxyAgent } from 'https-proxy-agent'

dotenv.config()

let proxies = []
let currentIndex = 0

export async function loadProxies() {
  try {
    const url = new URL(
      'https://proxy.webshare.io/api/v2/proxy/list/?mode=direct'
    )
    const response = await axios.get(url.href, {
      headers: {
        Authorization: `Token ${process.env.WEBSHARE_API_KEY}`,
      },
    })

    proxies = response.data.results.map((proxy) => ({
      host: proxy.proxy_address,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
    }))
    return proxies
    console.log(`Loaded ${proxies.length} proxies from Webshare`)
  } catch (error) {
    console.error('Failed to load proxies:', error.message)
  }
}

export async function getNextProxy() {
  if (proxies.length === 0) throw Error
  const proxy = proxies[currentIndex]
  currentIndex = (currentIndex + 1) % proxies.length
  console.log(proxy)
  return proxy
}

export async function fetchWithProxy(url) {
  const proxy = await getNextProxy()

  const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`

  console.log(`Using proxy: ${proxy.host}:${proxy.port}`)

  try {
    const agent = new HttpsProxyAgent(proxyUrl)

    const response = await axios.get(url, {
      httpsAgent: agent,
      httpAgent: agent,
      timeout: 10000,
    })

    return response.data
  } catch (error) {
    console.error('Request failed:', error.message)
    return null
  }
}

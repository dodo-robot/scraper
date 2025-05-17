async function retry(fn, retries = 3, delay = 500) {
  let attempt = 0
  while (attempt < retries) {
    try {
      return await fn()
    } catch (err) {
      attempt++
      if (attempt >= retries) throw err
      await new Promise((res) => setTimeout(res, delay * Math.pow(2, attempt))) // exponential backoff
    }
  }
}

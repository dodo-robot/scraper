import { OpenAI } from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateWineDescription(
  { reviews, wineFacts },
  language = 'it'
) {
  const langText =
    language === 'en'
      ? "Write a very short, engaging wine description based on the wine facts and community reviews. Summarize the wine's aroma, taste, and overall impression never citing the price in ENGLISH."
      : "Scrivi una brevissima e coinvolgente descrizione del vino basata sui fatti del vino e sulle recensioni della comunità. Riassumi l'aroma, il gusto e l'impressione complessiva senza fare Mai riferimento al prezzo in ITALIANO."

  const prompt = `
You are a sommelier. ${langText}

Wine Facts:
${wineFacts.map((fact, i) => `${i + 1}. ${fact}`).join('\n')}

Reviews:
${reviews.map((r, i) => `${i + 1}. ${r}`).join('\n')}
  `.trim()

  const res = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 250,
  })

  return res.choices[0].message.content.trim()
}




/**
 * For each dish, recommend 3 wines per price category
 * @param {string[]} menu - List of dishes
 * @param {Array<{name: string, price: number, [key: string]: any}>} wines - Wine objects with price
 * @returns {Promise<Record<string, { low: string[], medium: string[], high: string[] }>>} Recommendations per dish
 */
export async function recommendWinesPerDish(menu, wines) {
    // Price categories
    const priceCategories = {
      low: [0, 30],
      medium: [31, 60],
      high: [61, Infinity],
    }
  
    // Group wines by price category for faster lookup
    const winesByCategory = {
      low: wines.filter(w => w.price >= priceCategories.low[0] && w.price < priceCategories.low[1]),
      medium: wines.filter(w => w.price >= priceCategories.medium[0] && w.price < priceCategories.medium[1]),
      high: wines.filter(w => w.price >= priceCategories.high[0]),
    }
  
    const recommendations = {}
  
    for (const dish of menu) {
      const prompt = `
  You are a sommelier expert. For the dish "${dish}", recommend **3 wines** for each of the following price categories:
  
  - Low price wines (under $30)
  - Medium price wines ($30 to $60)
  - High price wines (above $60)
  
  You have the following wines available:
  
  ${wines.map((w, i) => `${i + 1}. ${w.name} - $${w.price} - ${w.description}`).join('\n')}
  
  For each price category, choose 3 wines from the list above that best pair with the dish.
  
  Return the recommendations as a JSON object with keys "low", "medium", and "high", each containing an array of wine objects.
  `
  
      const res = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
      })
  
      let recs
      try {
        recs = JSON.parse(res.choices[0].message.content)
      } catch {
        recs = res.choices[0].message.content
      }
  
      recommendations[dish] = recs
    }
  
    return recommendations
  }
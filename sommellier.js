import { OpenAI } from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateWineDescription(
  { reviews, wineFacts, foodPairings },
  language = 'it'
) {
  const langText =
    language === 'en'
      ? 'Write a very short, elegant, and original wine description based on the provided wine facts and inspired by the tone and insights from the reviews. Describe the wine’s aroma, taste, and overall character. Conclude with a food pairing suggestion. Do not mention price or explicitly refer to reviews. Avoid repeating information. Answer only in English'
      : "Scrivi una descrizione molto breve, elegante e originale del vino basandoti sui fatti forniti e ispirandoti al tono e ai suggerimenti contenuti nelle recensioni. Descrivi l'aroma, il gusto e il carattere complessivo del vino. Concludi con un suggerimento di abbinamento gastronomico. Non menzionare il prezzo né fare riferimento esplicito alle recensioni. Evita ripetizioni. Rispondi solo in italiano"

  const prompt = `
You are a sommelier. ${langText}

Wine Facts:
${wineFacts.map((fact, i) => `${i + 1}. ${fact}`).join('\n')}

Food Pairings:
${foodPairings.map((fact, i) => `${i + 1}. ${fact}`).join('\n')}

Reviews:
${reviews.map((r, i) => `${i + 1}. ${r}`).join('\n')}
  `.trim()

  const res = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 400,
  })

  return trimToLastFullSentence(res.choices[0].message.content.trim())
}

export async function generateDescriptionFromWine({
  name,
  wineType,
  grape,
  region,
  country,
  year,
  winery,
  description,
  language,
}) {
  const langText =
    language === 'en'
      ? 'Write a very short, elegant, and original wine description based on the provided wine facts. Describe the wine’s aroma, taste, and overall character. Conclude with a food pairing suggestion. Avoid repetition and do not mention price. Answer only in English.'
      : "Scrivi una descrizione molto breve, elegante e originale del vino basandoti sui fatti forniti. Descrivi l'aroma, il gusto e il carattere complessivo del vino. Concludi con un suggerimento di abbinamento gastronomico. Evita ripetizioni e non menzionare il prezzo. Rispondi solo in italiano."

  const wineFacts = [
    `Name: ${name}`,
    `Type: ${wineType}`,
    `Grape: ${grape}`,
    `Region: ${region}`,
    `Country: ${country}`,
    `Year: ${year}`,
    `Winery: ${winery}`,
    `Info: ${description}`,
  ].filter(Boolean)

  const prompt = `
You are a professional sommelier. ${langText}

Wine Facts:
${wineFacts.map((fact, i) => `${i + 1}. ${fact}`).join('\n')}
`.trim()

  const res = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    max_tokens: 300,
  })

  return trimToLastFullSentence(res.choices[0].message.content.trim())
}

function trimToLastFullSentence(text) {
  const lastPeriodIndex = text.lastIndexOf('.')
  if (lastPeriodIndex === -1) return text // No period found, return as is
  return text.slice(0, lastPeriodIndex + 1).trim()
}

/**
 * For each dish, recommend 3 wines per price category
 * @param {string} dish - List of dishes
 * @param {Array<{name: string, price: number, [key: string]: any}>} wines - Wine objects with price
 * @returns {Promise<Record<string, { low: string[], medium: string[], high: string[] }>>} Recommendations per dish
 */
export async function recommendWinesPerDish(dish, wines) {
  // Price categories
  const priceCategories = {
    low: [0, 30],
    medium: [31, 60],
    high: [61, Infinity],
  }

  // Group wines by price category for faster lookup
  const winesByCategory = {
    low: wines.filter(
      (w) =>
        w.price >= priceCategories.low[0] && w.price < priceCategories.low[1]
    ),
    medium: wines.filter(
      (w) =>
        w.price >= priceCategories.medium[0] &&
        w.price < priceCategories.medium[1]
    ),
    high: wines.filter((w) => w.price >= priceCategories.high[0]),
  }

  const recommendations = {}

  const prompt = `
  You are a sommelier expert. For the dish "${dish}", recommend **3 wines** for each of the following price categories:
  
  - Low price wines (under $30)
  - Medium price wines ($30 to $60)
  - High price wines (above $60)
  
  You have the following wines available:
  
  ${wines
    .map(
      (w, i) =>
        `${i + 1}. Name: ${w.name} | Grape: ${w.grape} | Region: ${
          w.region
        } | Country: ${w.country} | Winery: ${w.winery} | Type: ${
          w.wine_type
        } | Price: $${w.price}`
    )
    .join('\n')}
  
  For each price category, choose 3 wines from the list above that best pair with the dish.
  
  Return the recommendations as a JSON object with keys "low", "medium", and "high", each containing an array of wine objects.
  `.trim()

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

  return recommendations
}

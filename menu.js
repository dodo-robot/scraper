import fetch from 'node-fetch' // or native fetch in newer Node versions
import pdf from 'pdf-parse/lib/pdf-parse.js'

export async function getPdfText(url) {
  // Fetch PDF as array buffer
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`)
  const arrayBuffer = await response.arrayBuffer()
  // pdf-parse expects a Buffer, so convert ArrayBuffer to Buffer
  const buffer = Buffer.from(arrayBuffer)
  // Parse the PDF buffer
  const data = await pdf(buffer)
  // data.text contains the extracted text
  return data.text
}

// Usage:
const url =
  'https://www.rismetis.com/_files/ugd/f8e140_442f9356af144c31aca0c74df1bc9889.pdf'

getPdfText(url)
  .then((text) => {
    console.log('Extracted text:', text)
  })
  .catch(console.error)

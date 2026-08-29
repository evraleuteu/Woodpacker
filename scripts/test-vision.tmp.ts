import dotenv from 'dotenv'
dotenv.config({ path: 'C:/Users/leute/OneDrive/Bureau/Dev/Woodpacker/Woodpacker/.env.local' })

async function main() {
  const { transcribeImage, visionConfigured } = await import('file:///C:/Users/leute/OneDrive/Bureau/Dev/Woodpacker/Woodpacker/src/lib/llm.ts')
  console.log('vision configured:', visionConfigured(), '| key set:', Boolean(process.env.OPENCODE_API_KEY))
  const fs = await import('fs')
  const buf = fs.readFileSync('C:/Users/leute/AppData/Local/Temp/opencode/test_grammatik.png')
  const dataUrl = `data:image/png;base64,${buf.toString('base64')}`
  const text = await transcribeImage(dataUrl)
  console.log('--- TRANSCRIPTION ---')
  console.log(text)
}

main().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})

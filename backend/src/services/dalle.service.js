const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateWithDalle(prompt) {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    size: '1024x1024',
    quality: 'standard',
    n: 1,
  });
  return response.data[0].url;
}

module.exports = { generateWithDalle };

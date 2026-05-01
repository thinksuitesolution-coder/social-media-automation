const { GoogleGenerativeAI } = require('@google/generative-ai');
const cloudinaryService = require('./cloudinary.service');

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateWithImagen(prompt, postId) {
  // Imagen 3 via Google AI SDK
  const response = await ai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt,
    config: { numberOfImages: 1, aspectRatio: '1:1' },
  });

  const imageBytes = response.generatedImages[0].image.imageBytes;
  // imageBytes is base64 string — upload as data URI to Cloudinary
  const dataUri = `data:image/png;base64,${imageBytes}`;
  return cloudinaryService.uploadImage(dataUri, postId);
}

module.exports = { generateWithImagen };

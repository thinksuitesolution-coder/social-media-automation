const dalleService      = require('../services/dalle.service');
const replicateService  = require('../services/replicate.service');
const imagenService     = require('../services/imagen.service');
const cloudinaryService = require('../services/cloudinary.service');
const logger            = require('./logger');

const FALLBACK_ORDER = {
  DALLE:    ['DALLE', 'REPLICATE', 'GEMINI'],
  REPLICATE:['REPLICATE', 'DALLE', 'GEMINI'],
  GEMINI:   ['GEMINI', 'DALLE', 'REPLICATE'],
};

async function generateImageWithFallback(prompt, preferredProvider, postId) {
  const order = FALLBACK_ORDER[preferredProvider] || FALLBACK_ORDER.DALLE;

  for (const provider of order) {
    try {
      let url;
      if (provider === 'DALLE') {
        url = await cloudinaryService.uploadImage(
          await dalleService.generateWithDalle(prompt), postId
        );
      } else if (provider === 'REPLICATE') {
        url = await cloudinaryService.uploadImage(
          await replicateService.generateWithReplicate(prompt), postId
        );
      } else if (provider === 'GEMINI') {
        url = await imagenService.generateWithImagen(prompt, postId);
      }
      logger.info(`Image generated with ${provider} for post ${postId}`);
      return { url, provider };
    } catch (err) {
      logger.warn(`Image provider ${provider} failed: ${err.message}`);
    }
  }

  throw new Error('All image providers failed — check API keys and quotas');
}

module.exports = { generateImageWithFallback };

const Replicate = require('replicate');

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

async function generateWithReplicate(prompt) {
  const output = await replicate.run('black-forest-labs/flux-schnell', {
    input: { prompt, aspect_ratio: '1:1', output_format: 'webp', output_quality: 90 },
  });
  // output is an array of URLs or ReadableStream objects
  if (Array.isArray(output) && output.length > 0) {
    const item = output[0];
    if (typeof item === 'string') return item;
    // Handle ReadableStream from newer Replicate SDK
    if (item && typeof item.url === 'function') return item.url().toString();
    if (item && item.url) return item.url.toString();
  }
  throw new Error('No output from Replicate');
}

module.exports = { generateWithReplicate };

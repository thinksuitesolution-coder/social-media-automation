const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadImage(imageUrlOrBase64, postId) {
  const result = await cloudinary.uploader.upload(imageUrlOrBase64, {
    folder: 'social-media-posts',
    public_id: `post-${postId}-${Date.now()}`,
    overwrite: true,
    transformation: [{ width: 1080, height: 1080, crop: 'fill', gravity: 'auto' }],
  });
  return result.secure_url;
}

async function deleteImage(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

module.exports = { uploadImage, deleteImage };

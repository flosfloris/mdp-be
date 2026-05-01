const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || 5242880);
const ALLOWED_TYPES = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp,image/gif').split(',');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only images are allowed.'));
    }
    cb(null, true);
  },
});

// POST /api/upload/avatar
// Upload user avatar
router.post('/avatar', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const filename = `avatar-${req.user.id}-${Date.now()}.webp`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Process and optimize image
    await sharp(req.file.buffer)
      .resize(500, 500, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toFile(filepath);

    const url = `/uploads/${filename}`;

    // Update user avatar URL in database
    await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [url, req.user.id]);

    res.json({ url, message: 'Avatar uploaded successfully' });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// POST /api/upload/servizio
// Upload service photos
router.post('/servizio/:servizioId', requireAuth, upload.array('files', 10), async (req, res) => {
  const { servizioId } = req.params;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  try {
    // Verify service ownership
    const service = await db.query('SELECT * FROM servizi WHERE id = $1', [servizioId]);

    if (service.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (service.rows[0].provider_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const uploadedPhotos = [];
    const altText = req.body.altText || [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const filename = `servizio-${servizioId}-${Date.now()}-${uuidv4()}.webp`;
      const filepath = path.join(UPLOAD_DIR, filename);

      // Process and optimize image
      await sharp(file.buffer)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toFile(filepath);

      const url = `/uploads/${filename}`;
      const fotoId = uuidv4();
      const alt = altText[i] || `Foto servizio ${i + 1}`;

      const result = await db.query(
        `INSERT INTO foto_servizi (id, servizio_id, url, posizione, alt_text)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [fotoId, servizioId, url, i + 1, alt]
      );

      uploadedPhotos.push(result.rows[0]);
    }

    res.status(201).json({
      photos: uploadedPhotos,
      message: `${uploadedPhotos.length} photos uploaded successfully`,
    });
  } catch (error) {
    console.error('Service photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// DELETE /api/upload/foto/:fotoId
// Delete a service photo
router.delete('/foto/:fotoId', requireAuth, async (req, res) => {
  const { fotoId } = req.params;

  try {
    const foto = await db.query('SELECT * FROM foto_servizi WHERE id = $1', [fotoId]);

    if (foto.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Verify service ownership
    const service = await db.query('SELECT * FROM servizi WHERE id = $1', [foto.rows[0].servizio_id]);

    if (service.rows[0].provider_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Delete file from disk
    const filepath = path.join(UPLOAD_DIR, path.basename(foto.rows[0].url));
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    // Delete from database
    await db.query('DELETE FROM foto_servizi WHERE id = $1', [fotoId]);

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Photo deletion error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;

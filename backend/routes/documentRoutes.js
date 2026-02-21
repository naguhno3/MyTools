const router = require('express').Router();
const c = require('../controllers/documentController');

// Stats (before /:id to avoid conflict)
router.get('/stats', c.getStats);

// Upload (multipart/form-data with file)
router.post('/upload', c.uploadMiddleware, c.uploadDocument);

// List & single metadata
router.get('/', c.listDocuments);
router.get('/:id', c.getDocument);

// Download the actual file
router.get('/:id/download', c.downloadDocument);

// Update metadata
router.put('/:id', c.updateDocument);

// Delete
router.delete('/:id', c.deleteDocument);

// Link management
router.post('/:id/link', c.addLink);
router.delete('/:id/link', c.removeLink);

module.exports = router;

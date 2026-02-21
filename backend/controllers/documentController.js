const Document = require('../models/Document');
const multer = require('multer');

// ── multer: store in memory so we can save the Buffer into MongoDB ──────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB cap
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported`));
    }
  },
});

exports.uploadMiddleware = upload.single('file');

// ── Upload a new document ──────────────────────────────────────────────────
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const {
      name, description, category, tags,
      documentDate, expiryDate, isImportant,
      entityType, entityId, entityName,
    } = req.body;

    const doc = new Document({
      name: name || req.file.originalname,
      description,
      category: category || 'other',
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean)) : [],
      fileData: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      documentDate: documentDate || undefined,
      expiryDate: expiryDate || undefined,
      isImportant: isImportant === 'true' || isImportant === true,
      linkedTo: (entityType && entityId) ? [{ entityType, entityId, entityName }] : [],
    });

    await doc.save();

    // Return without fileData
    const result = doc.toObject();
    delete result.fileData;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ── List documents (no fileData) ───────────────────────────────────────────
exports.listDocuments = async (req, res) => {
  try {
    const { category, search, entityType, entityId } = req.query;
    const filter = {};

    if (category && category !== 'all') filter.category = category;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { originalName: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } },
    ];
    if (entityType && entityId) {
      filter['linkedTo.entityType'] = entityType;
      filter['linkedTo.entityId'] = entityId;
    }

    const docs = await Document.find(filter)
      .select('-fileData') // never send binary in list
      .sort({ uploadedAt: -1 });

    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Get single document metadata (no fileData) ─────────────────────────────
exports.getDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).select('-fileData');
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Download document (streams the binary) ─────────────────────────────────
exports.downloadDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).select('+fileData');
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const safeFilename = encodeURIComponent(doc.originalName);
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
      'Content-Length': doc.fileSize,
      'Cache-Control': 'private, max-age=3600',
    });
    res.send(doc.fileData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Update document metadata (not the file itself) ─────────────────────────
exports.updateDocument = async (req, res) => {
  try {
    const { name, description, category, tags, documentDate, expiryDate, isImportant } = req.body;
    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(tags !== undefined && { tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean) }),
        ...(documentDate !== undefined && { documentDate: documentDate || undefined }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate || undefined }),
        ...(isImportant !== undefined && { isImportant }),
      },
      { new: true, select: '-fileData' }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ── Delete document ────────────────────────────────────────────────────────
exports.deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Document deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Add / remove entity link ───────────────────────────────────────────────
exports.addLink = async (req, res) => {
  try {
    const { entityType, entityId, entityName } = req.body;
    const doc = await Document.findById(req.params.id).select('-fileData');
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const exists = doc.linkedTo.some(
      l => l.entityType === entityType && l.entityId?.toString() === entityId
    );
    if (!exists) {
      doc.linkedTo.push({ entityType, entityId, entityName });
      await doc.save();
    }
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.removeLink = async (req, res) => {
  try {
    const { entityType, entityId } = req.body;
    const doc = await Document.findById(req.params.id).select('-fileData');
    if (!doc) return res.status(404).json({ error: 'Not found' });
    doc.linkedTo = doc.linkedTo.filter(
      l => !(l.entityType === entityType && l.entityId?.toString() === entityId)
    );
    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ── Stats ──────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [total, byCategory] = await Promise.all([
      Document.aggregate([
        { $group: { _id: null, count: { $sum: 1 }, totalSize: { $sum: '$fileSize' } } }
      ]),
      Document.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
    ]);
    res.json({
      totalDocuments: total[0]?.count || 0,
      totalSize: total[0]?.totalSize || 0,
      byCategory: byCategory.reduce((acc, c) => { acc[c._id] = c.count; return acc; }, {}),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

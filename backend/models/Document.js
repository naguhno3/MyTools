const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  // Display info
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: {
    type: String,
    enum: [
      'property', 'loan', 'investment', 'insurance', 'tax',
      'identity', 'vehicle', 'medical', 'legal', 'bank', 'other'
    ],
    default: 'other'
  },
  tags: [{ type: String }],

  // File data stored as binary in MongoDB
  fileData:     { type: Buffer, required: true },
  mimeType:     { type: String, required: true },
  originalName: { type: String, required: true },
  fileSize:     { type: Number, required: true }, // bytes

  // Optional link refs (which entity this doc is linked to by default)
  // Each entity stores its own linkedDocId reference back to this _id
  linkedTo: [{
    entityType: { type: String, enum: ['property', 'loan', 'investment', 'account'] },
    entityId:   { type: mongoose.Schema.Types.ObjectId },
    entityName: { type: String }, // cached display name
  }],

  // Dates
  documentDate: { type: Date },   // date on the document itself
  expiryDate:   { type: Date },
  isImportant:  { type: Boolean, default: false },

  uploadedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Never return fileData in list queries — only on explicit download
documentSchema.index({ category: 1 });
documentSchema.index({ tags: 1 });

module.exports = mongoose.model('Document', documentSchema);

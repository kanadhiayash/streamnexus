const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorRole: { type: String, default: 'system' },
  action: { type: String, required: true, index: true },
  targetType: { type: String, required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  requestId: { type: String, default: '' },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

auditEventSchema.index({ createdAt: -1 });
auditEventSchema.index({ actorId: 1, createdAt: -1 });
auditEventSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditEventSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditEvent', auditEventSchema);

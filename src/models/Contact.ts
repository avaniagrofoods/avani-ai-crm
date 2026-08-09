import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String },
  email: { type: String },
  city: { type: String },
  optedIn: { type: Boolean, default: false },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);

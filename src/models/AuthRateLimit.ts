import mongoose, { Schema, Document } from 'mongoose';

export interface IAuthRateLimit extends Document {
  key: string;
  attempts: number;
  lockedUntil: Date | null;
  expireAt: Date;
}

const AuthRateLimitSchema = new Schema<IAuthRateLimit>(
  {
    key: { type: String, required: true, unique: true, index: true },
    attempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    expireAt: { type: Date, required: true }
  },
  { timestamps: true, collection: 'authratelimits' }
);

AuthRateLimitSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const AuthRateLimit =
  mongoose.models.AuthRateLimit ||
  mongoose.model<IAuthRateLimit>('AuthRateLimit', AuthRateLimitSchema);

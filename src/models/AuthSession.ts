import mongoose, { Schema, Document } from 'mongoose';

export interface IAuthSession extends Document {
  jti: string;
  sub: string;
  email: string;
  role: 'ADMIN' | 'ADVISOR';
  revoked: boolean;
  revokedAt?: Date;
  issuedAt: Date;
  expireAt: Date;
}

const AuthSessionSchema = new Schema<IAuthSession>(
  {
    jti: { type: String, required: true, unique: true, index: true },
    sub: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, index: true },
    role: { type: String, enum: ['ADMIN', 'ADVISOR'], required: true },
    revoked: { type: Boolean, default: false, index: true },
    revokedAt: { type: Date },
    issuedAt: { type: Date, default: Date.now },
    expireAt: { type: Date, required: true }
  },
  { timestamps: false, collection: 'authsessions' }
);

AuthSessionSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const AuthSession =
  mongoose.models.AuthSession || mongoose.model<IAuthSession>('AuthSession', AuthSessionSchema);

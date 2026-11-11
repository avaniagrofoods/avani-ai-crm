import { NextResponse } from 'next/server';
import {
  verifySecureDocumentUploadToken,
  encryptDocumentReference
} from '@/lib/consent-privacy';
import connectToDatabase from '@/lib/db';
import { DocumentModel } from '@/models/Document';
import { Lead } from '@/models/Lead';
import { requireAuth, canAccessLead } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/documents/secure-upload
 * - If ?leadId=... is requested: requires a verified server session (ADMIN or assigned ADVISOR).
 *   Unspoofable: does NOT trust raw client x-advisor-role headers.
 * - If ?token=... is provided: validates signed customer document portal token.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  const leadId = searchParams.get('leadId');

  if (leadId) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    await connectToDatabase();
    const lead = await Lead.findOne({ leadId }).lean();
    if (lead && !canAccessLead(auth.session, lead)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'You are not assigned to this lead.' },
        { status: 403 }
      );
    }

    const docRecord = await DocumentModel.findOne({ leadId }).lean();
    return NextResponse.json({
      success: true,
      accessRole: auth.session.role,
      encryption: 'AES-256-GCM + TLS 1.3',
      retentionPolicyDays: 90,
      record: docRecord || null
    });
  }

  const verification = verifySecureDocumentUploadToken(token);
  if (!verification.valid || !verification.payload) {
    return NextResponse.json(
      { success: false, error: verification.error || 'Unauthorized document portal access' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    portal: 'AVANI LOAN SERVICES — Secure Document Upload Portal',
    leadId: verification.payload.leadId,
    loanCategory: verification.payload.loanCategory,
    securityNotice:
      'Documents uploaded here are encrypted in transit (TLS 1.3) and at rest (AES-256-GCM), restricted to authorized AVANI loan advisors, and retained for 90 days unless earlier deletion is requested.',
    expiresAt: new Date(verification.payload.exp).toISOString()
  });
}

/**
 * POST /api/documents/secure-upload
 * Records an encrypted document reference under a verified upload token without logging document contents.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body.token || new URL(request.url).searchParams.get('token') || '';
    const documentName = String(body.documentName || '').trim();
    const storageReference = String(body.storageReference || 'ENCRYPTED_VAULT_OBJECT').trim();

    const verification = verifySecureDocumentUploadToken(token);
    if (!verification.valid || !verification.payload) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Invalid or expired upload token' },
        { status: 401 }
      );
    }

    if (!documentName) {
      return NextResponse.json(
        { success: false, error: 'documentName is required' },
        { status: 400 }
      );
    }

    const encryptedRef = encryptDocumentReference(storageReference);
    const { leadId, loanCategory } = verification.payload;

    await connectToDatabase();
    let docRecord = await DocumentModel.findOne({ leadId });
    if (!docRecord) {
      docRecord = await DocumentModel.create({
        leadId,
        product: loanCategory,
        customerType: 'INDIVIDUAL',
        requiredDocuments: [documentName],
        receivedDocuments: [documentName],
        missingDocuments: [],
        status: 'PARTIAL',
        auditLog: [
          {
            action: 'SECURE_PORTAL_UPLOAD',
            timestamp: new Date(),
            detail: `Encrypted upload recorded for ${documentName} (${encryptedRef.slice(0, 18)}...)`
          }
        ]
      });
    } else {
      const received = new Set([...(docRecord.receivedDocuments || []), documentName]);
      const missing = (docRecord.requiredDocuments || []).filter((d: string) => !received.has(d));
      docRecord.receivedDocuments = Array.from(received);
      docRecord.missingDocuments = missing;
      docRecord.status = missing.length === 0 ? 'DOCUMENTS_SUBMITTED' : 'PARTIAL';
      docRecord.auditLog.push({
        action: 'SECURE_PORTAL_UPLOAD',
        timestamp: new Date(),
        detail: `Encrypted upload recorded for ${documentName}`
      });
      await docRecord.save();
    }

    return NextResponse.json({
      success: true,
      leadId,
      documentName,
      status: docRecord.status,
      encryptedAtRest: true,
      retentionDays: 90
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to process secure document upload' },
      { status: 500 }
    );
  }
}

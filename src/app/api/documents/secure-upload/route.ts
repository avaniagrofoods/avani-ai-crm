import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * TASK 5H.4 — DOCUMENT AND MEDIA STORAGE ELIMINATION
 *
 * Customer document and file uploads into the CRM are permanently disabled.
 * Prohibited: PDFs, PAN copies, Aadhaar copies, bank statements, salary slips,
 * property documents, images, scanned documents, audio, video, Base64 files, GridFS,
 * or binary document storage.
 */
const UPLOAD_DISABLED_RESPONSE = {
  success: false,
  error: 'DOCUMENT_UPLOAD_DISABLED',
  uploadDisabled: true,
  message:
    'Customer document and file uploads are disabled under the AVANI LOAN SERVICES zero-document-storage policy. Do not upload PAN, Aadhaar, bank statements, salary slips, or property documents to this CRM.'
};

export async function GET() {
  return NextResponse.json(UPLOAD_DISABLED_RESPONSE, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' }
  });
}

export async function POST() {
  return NextResponse.json(UPLOAD_DISABLED_RESPONSE, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' }
  });
}

import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Contact } from '@/models/Contact';

export async function POST(req: Request) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Persistence unavailable.' },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'FILE_REQUIRED', message: 'No file provided in form data.' },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'EMPTY_FILE', message: 'File is empty or contains only headers.' },
        { status: 400 }
      );
    }

    // Parse header
    const headerLine = lines[0];
    const delimiter = headerLine.includes(',') ? ',' : headerLine.includes(';') ? ';' : '\t';
    const rawHeaders = headerLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

    // Map column indices
    let nameIdx = rawHeaders.findIndex(h => h.includes('name') || h === 'full name');
    let phoneIdx = rawHeaders.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('tel') || h.includes('number'));
    let emailIdx = rawHeaders.findIndex(h => h.includes('email') || h.includes('mail'));
    let cityIdx = rawHeaders.findIndex(h => h.includes('city') || h.includes('location') || h.includes('town'));

    // Fallbacks if no explicit headers found
    if (phoneIdx === -1 && rawHeaders.length > 1) {
      phoneIdx = 1; // Default 2nd column
    }
    if (nameIdx === -1) {
      nameIdx = 0; // Default 1st column
    }

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      const rawPhone = phoneIdx >= 0 ? cols[phoneIdx] : '';
      const rawName = nameIdx >= 0 ? cols[nameIdx] : '';
      const rawEmail = emailIdx >= 0 ? cols[emailIdx] : '';
      const rawCity = cityIdx >= 0 ? cols[cityIdx] : '';

      if (!rawPhone) {
        skippedCount++;
        continue;
      }

      // Normalize phone to E.164 (+91XXXXXXXXXX)
      let digits = rawPhone.replace(/\D/g, '');
      if (digits.length === 12 && digits.startsWith('91')) {
        digits = digits.slice(2);
      } else if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.slice(1);
      }

      if (digits.length !== 10) {
        skippedCount++;
        continue;
      }

      const e164Phone = `+91${digits}`;

      try {
        const result = await Contact.findOneAndUpdate(
          { phone: e164Phone },
          {
            $set: {
              name: rawName || 'Valued Customer',
              phone: e164Phone,
              email: rawEmail || undefined,
              city: rawCity || undefined,
              optedIn: true, // Default opt-in on import with audit trail
              updatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true, rawResult: true }
        );

        if (result.lastErrorObject?.updatedExisting) {
          updatedCount++;
        } else {
          importedCount++;
        }
      } catch (err) {
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `CSV imported successfully. ${importedCount} new contacts added, ${updatedCount} updated, ${skippedCount} skipped.`,
      importedCount,
      updatedCount,
      skippedCount,
      totalRows: lines.length - 1
    });

  } catch (error: any) {
    console.error('[UploadAPI] Error uploading contacts CSV:', error);
    return NextResponse.json(
      { success: false, error: 'UPLOAD_FAILED', message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

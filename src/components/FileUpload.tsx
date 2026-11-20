'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

/**
 * TASK 5H.7 (A-03 Remediation):
 * Replaced legacy CSV file-input uploader with a read-only Zero-Upload Policy notice.
 */
export function FileUpload() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="glass rounded-2xl p-8 border border-white/10 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
          <ShieldCheck size={28} />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          File Upload Disabled — Zero-Document-Storage Policy Active
        </h3>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Bulk CSV and document file uploads are disabled in AVANI AI CRM. All customer enquiries and CRM records are managed directly via the structured Google Sheets CRM workflow.
        </p>
      </div>
    </div>
  );
}

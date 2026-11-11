import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { requireAuth, requireRole, isValidObjectId, canAccessLead, sanitizeLeadPayloadForClient } from '@/lib/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const resolvedParams = await params;
    if (!isValidObjectId(resolvedParams.id)) {
      return NextResponse.json({ success: false, error: 'Invalid lead ID format.' }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json({ success: false, error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }

    const lead = await Lead.findById(resolvedParams.id);
    if (!lead) return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });

    if (!canAccessLead(auth.session, lead)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'You are not assigned to this lead.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (!lead.stageHistory) lead.stageHistory = [];

    // 1. SUBMIT APPLICATION TO LENDER (ADMIN or assigned ADVISOR)
    if (action === 'SUBMIT_APPLICATION') {
      const { lenderId, lenderName, productName, applicationNumber, appliedAmount, notes } = body;
      if (!lenderName) {
        return NextResponse.json({ success: false, error: 'lenderName is required' }, { status: 400 });
      }
      if (['SANCTIONED', 'DISBURSEMENT_PENDING', 'DISBURSED'].includes(lead.stage || '')) {
        return NextResponse.json(
          { success: false, error: `Cannot submit new application when lead is already in stage ${lead.stage}.` },
          { status: 400 }
        );
      }
      lead.application = {
        lenderId,
        lenderName,
        productName: productName || lead.loanType,
        applicationNumber: applicationNumber || `APP-${Date.now().toString().slice(-6)}`,
        appliedAmount: Number(appliedAmount) || Number(lead.requiredLoanAmount) || 0,
        submissionDate: new Date(),
        status: 'SUBMITTED',
        notes: notes || ''
      };
      lead.stage = 'APPLICATION_SUBMITTED';
      lead.status = 'Application Submitted';
      lead.stageHistory.push({
        stage: 'APPLICATION_SUBMITTED',
        changedBy: auth.session.name,
        changedAt: new Date(),
        reason: `Application submitted to ${lenderName}`,
        notes: `Application Ref: ${lead.application.applicationNumber}`
      });
    }

    // 2. RECORD SANCTION (ADMIN ONLY)
    else if (action === 'RECORD_SANCTION') {
      const adminCheck = await requireRole(req, ['ADMIN']);
      if (!adminCheck.ok) return adminCheck.response;

      const currentStage = lead.stage || 'NEW_ENQUIRY';
      const hasSubmittedApp =
        lead.application?.status === 'SUBMITTED' ||
        ['APPLICATION_SUBMITTED', 'LENDER_PROCESSING', 'ADDITIONAL_DOCUMENTS_REQUIRED'].includes(currentStage);

      if (!hasSubmittedApp) {
        return NextResponse.json(
          { success: false, error: `Cannot record sanction from stage ${currentStage} before application submission.` },
          { status: 400 }
        );
      }

      const { sanctionedAmount, sanctionLetterRef, offeredInterestRate, sanctionedTenureMonths, conditions } = body;
      const numericSanction = Number(sanctionedAmount);
      if (!Number.isFinite(numericSanction) || numericSanction <= 0) {
        return NextResponse.json({ success: false, error: 'sanctionedAmount must be greater than 0' }, { status: 400 });
      }
      lead.sanction = {
        sanctionedAmount: numericSanction,
        sanctionDate: new Date(),
        sanctionLetterRef: sanctionLetterRef || '',
        offeredInterestRate: offeredInterestRate || '',
        sanctionedTenureMonths: Number(sanctionedTenureMonths) || 60,
        conditions: conditions || '',
        status: 'SANCTIONED'
      };
      if (lead.application) lead.application.status = 'SANCTIONED';
      lead.stage = 'SANCTIONED';
      lead.status = 'Approved';
      lead.stageHistory.push({
        stage: 'SANCTIONED',
        changedBy: auth.session.name,
        changedAt: new Date(),
        reason: `Loan sanctioned by ${lead.application?.lenderName || 'Lender'}`,
        notes: `Amount: ₹${lead.sanction.sanctionedAmount.toLocaleString('en-IN')}, Letter: ${sanctionLetterRef || 'N/A'}`
      });
    }

    // 3. RECORD DISBURSEMENT (ADMIN ONLY)
    else if (action === 'RECORD_DISBURSEMENT') {
      const adminCheck = await requireRole(req, ['ADMIN']);
      if (!adminCheck.ok) return adminCheck.response;

      const currentStage = lead.stage || 'NEW_ENQUIRY';
      const isSanctioned =
        lead.sanction?.status === 'SANCTIONED' ||
        ['SANCTIONED', 'DISBURSEMENT_PENDING', 'DISBURSED'].includes(currentStage);

      if (!isSanctioned) {
        return NextResponse.json(
          { success: false, error: `Cannot record disbursement from stage ${currentStage} without prior sanction.` },
          { status: 400 }
        );
      }

      const { disbursedAmount, proofRef, utrNumber } = body;
      const numericDisbursed = Number(disbursedAmount);
      if (!Number.isFinite(numericDisbursed) || numericDisbursed <= 0) {
        return NextResponse.json({ success: false, error: 'disbursedAmount must be greater than 0' }, { status: 400 });
      }
      if (
        utrNumber &&
        lead.disbursement?.status === 'DISBURSED' &&
        lead.disbursement?.utrNumber === utrNumber
      ) {
        return NextResponse.json({
          success: true,
          idempotentHit: true,
          leadId: lead.leadId,
          stage: lead.stage,
          disbursement: lead.disbursement
        });
      }

      lead.disbursement = {
        disbursedAmount: numericDisbursed,
        disbursementDate: new Date(),
        proofRef: proofRef || '',
        utrNumber: utrNumber || '',
        status: 'DISBURSED'
      };
      lead.stage = 'DISBURSED';
      lead.status = 'Disbursed';
      lead.stageHistory.push({
        stage: 'DISBURSED',
        changedBy: auth.session.name,
        changedAt: new Date(),
        reason: `Loan successfully disbursed`,
        notes: `Disbursed Amount: ₹${lead.disbursement.disbursedAmount.toLocaleString('en-IN')}, UTR: ${utrNumber || 'N/A'}`
      });
    }

    // 4. RECORD REVENUE (ADMIN ONLY)
    else if (action === 'RECORD_REVENUE') {
      const adminCheck = await requireRole(req, ['ADMIN']);
      if (!adminCheck.ok) return adminCheck.response;

      const existingRev: any = lead.revenue || {};
      const finalCommissionPct =
        body.agreedCommissionPct !== undefined ? Number(body.agreedCommissionPct) : (existingRev.agreedCommissionPct || 0);
      const finalConsultancyFee =
        body.agreedConsultancyFee !== undefined ? Number(body.agreedConsultancyFee) : (existingRev.agreedConsultancyFee || 0);
      const finalExpectedRevenue =
        body.expectedRevenue !== undefined ? Number(body.expectedRevenue) : (existingRev.expectedRevenue || 0);
      const finalActualReceived =
        body.actualRevenueReceived !== undefined ? Number(body.actualRevenueReceived) : (existingRev.actualRevenueReceived || 0);

      if (finalExpectedRevenue < 0 || finalActualReceived < 0) {
        return NextResponse.json({ success: false, error: 'Revenue figures cannot be negative' }, { status: 400 });
      }

      const calculatedOutstanding = Math.max(0, finalExpectedRevenue - finalActualReceived);
      const resolvedPaymentStatus =
        body.paymentStatus ||
        (finalExpectedRevenue > 0 && finalActualReceived >= finalExpectedRevenue
          ? 'RECEIVED'
          : finalActualReceived > 0
            ? 'PARTIAL'
            : finalExpectedRevenue > 0
              ? 'INVOICED'
              : 'UNBILLED');

      lead.revenue = {
        agreedCommissionPct: finalCommissionPct,
        agreedConsultancyFee: finalConsultancyFee,
        expectedRevenue: finalExpectedRevenue,
        actualRevenueReceived: finalActualReceived,
        paymentDate: body.paymentDate
          ? new Date(body.paymentDate)
          : resolvedPaymentStatus === 'RECEIVED'
            ? existingRev.paymentDate || new Date()
            : existingRev.paymentDate,
        paymentStatus: resolvedPaymentStatus,
        invoiceNumber: body.invoiceNumber || existingRev.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
        outstandingAmount:
          body.outstandingAmount !== undefined
            ? Math.max(0, Number(body.outstandingAmount))
            : calculatedOutstanding
      };

      lead.stageHistory.push({
        stage: lead.stage || 'DISBURSED',
        changedBy: auth.session.name,
        changedAt: new Date(),
        reason: `Revenue settlement updated: Status ${lead.revenue.paymentStatus}`,
        notes: `Expected: ₹${lead.revenue.expectedRevenue}, Received: ₹${lead.revenue.actualRevenueReceived}, Outstanding: ₹${lead.revenue.outstandingAmount}, Invoice: ${lead.revenue.invoiceNumber}`
      });
    } else {
      return NextResponse.json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
    }

    lead.updatedAt = new Date();
    await lead.save();

    const sanitized = sanitizeLeadPayloadForClient(lead, auth.session);
    return NextResponse.json({
      success: true,
      leadId: lead.leadId,
      stage: lead.stage,
      application: sanitized.application,
      sanction: sanitized.sanction,
      disbursement: sanitized.disbursement,
      revenue: sanitized.revenue
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

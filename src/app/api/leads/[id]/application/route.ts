import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json({ success: false, error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }
    const resolvedParams = await params;
    const lead = await Lead.findById(resolvedParams.id);
    if (!lead) return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });

    const body = await req.json();
    const { action } = body;

    // 1. SUBMIT APPLICATION TO LENDER
    if (action === 'SUBMIT_APPLICATION') {
      const { lenderId, lenderName, productName, applicationNumber, appliedAmount, notes } = body;
      lead.application = {
        lenderId,
        lenderName,
        productName: productName || lead.loanType,
        applicationNumber: applicationNumber || `APP-${Date.now().toString().slice(-6)}`,
        appliedAmount: Number(appliedAmount) || lead.requiredLoanAmount || 0,
        submissionDate: new Date(),
        status: 'SUBMITTED',
        notes: notes || ''
      };
      lead.stage = 'APPLICATION_SUBMITTED';
      lead.stageHistory.push({
        stage: 'APPLICATION_SUBMITTED',
        changedBy: body.changedBy || 'Sachin Shinde',
        changedAt: new Date(),
        reason: `Application submitted to ${lenderName}`,
        notes: `Application Ref: ${lead.application.applicationNumber}`
      });
    }

    // 2. RECORD SANCTION
    else if (action === 'RECORD_SANCTION') {
      const { sanctionedAmount, sanctionLetterRef, offeredInterestRate, sanctionedTenureMonths, conditions } = body;
      lead.sanction = {
        sanctionedAmount: Number(sanctionedAmount) || 0,
        sanctionDate: new Date(),
        sanctionLetterRef: sanctionLetterRef || '',
        offeredInterestRate: offeredInterestRate || '',
        sanctionedTenureMonths: Number(sanctionedTenureMonths) || 60,
        conditions: conditions || '',
        status: 'SANCTIONED'
      };
      if (lead.application) lead.application.status = 'SANCTIONED';
      lead.stage = 'SANCTIONED';
      lead.stageHistory.push({
        stage: 'SANCTIONED',
        changedBy: body.changedBy || 'Sachin Shinde',
        changedAt: new Date(),
        reason: `Loan sanctioned by ${lead.application?.lenderName || 'Lender'}`,
        notes: `Amount: ₹${lead.sanction.sanctionedAmount.toLocaleString('en-IN')}, Letter: ${sanctionLetterRef}`
      });
    }

    // 3. RECORD DISBURSEMENT
    else if (action === 'RECORD_DISBURSEMENT') {
      const { disbursedAmount, proofRef, utrNumber } = body;
      lead.disbursement = {
        disbursedAmount: Number(disbursedAmount) || 0,
        disbursementDate: new Date(),
        proofRef: proofRef || '',
        utrNumber: utrNumber || '',
        status: 'DISBURSED'
      };
      lead.stage = 'DISBURSED';
      lead.stageHistory.push({
        stage: 'DISBURSED',
        changedBy: body.changedBy || 'Sachin Shinde',
        changedAt: new Date(),
        reason: `Loan successfully disbursed`,
        notes: `Disbursed Amount: ₹${lead.disbursement.disbursedAmount.toLocaleString('en-IN')}, UTR: ${utrNumber}`
      });
    }

    // 4. RECORD REVENUE
    else if (action === 'RECORD_REVENUE') {
      const {
        agreedCommissionPct,
        agreedConsultancyFee,
        expectedRevenue,
        actualRevenueReceived,
        paymentDate,
        paymentStatus,
        invoiceNumber,
        outstandingAmount
      } = body;

      lead.revenue = {
        agreedCommissionPct: Number(agreedCommissionPct) || 0,
        agreedConsultancyFee: Number(agreedConsultancyFee) || 0,
        expectedRevenue: Number(expectedRevenue) || 0,
        actualRevenueReceived: Number(actualRevenueReceived) || 0,
        paymentDate: paymentDate ? new Date(paymentDate) : (paymentStatus === 'RECEIVED' ? new Date() : undefined),
        paymentStatus: paymentStatus || 'INVOICED',
        invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
        outstandingAmount: Number(outstandingAmount) || (Number(expectedRevenue || 0) - Number(actualRevenueReceived || 0))
      };
      lead.stageHistory.push({
        stage: lead.stage,
        changedBy: body.changedBy || 'Sachin Shinde',
        changedAt: new Date(),
        reason: `Revenue settlement updated: Status ${lead.revenue.paymentStatus}`,
        notes: `Expected: ₹${lead.revenue.expectedRevenue}, Received: ₹${lead.revenue.actualRevenueReceived}, Invoice: ${lead.revenue.invoiceNumber}`
      });
    } else {
      return NextResponse.json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
    }

    lead.updatedAt = new Date();
    await lead.save();

    return NextResponse.json({
      success: true,
      leadId: lead.leadId,
      stage: lead.stage,
      application: lead.application,
      sanction: lead.sanction,
      disbursement: lead.disbursement,
      revenue: lead.revenue
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

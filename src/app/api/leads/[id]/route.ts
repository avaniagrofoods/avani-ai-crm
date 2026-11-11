import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { CANONICAL_LEAD_STAGES, CanonicalLeadStage } from '@/config/pipeline';
import { CATEGORY_DOCUMENT_CHECKLISTS } from '@/lib/document-checklist';

function mapStageToLegacyStatus(stage: CanonicalLeadStage): string {
  switch (stage) {
    case 'NEW_ENQUIRY':
      return 'New';
    case 'CONTACT_PENDING':
    case 'CONTACTED':
    case 'QUALIFICATION_IN_PROGRESS':
      return 'Contacted';
    case 'QUALIFIED':
      return 'Qualified';
    case 'DOCUMENTS_PENDING':
      return 'Documents Pending';
    case 'DOCUMENTS_RECEIVED':
    case 'DOCUMENT_VERIFICATION':
    case 'LENDER_MATCHING':
    case 'APPLICATION_PREPARATION':
      return 'Documents Complete';
    case 'APPLICATION_SUBMITTED':
      return 'Application Submitted';
    case 'LENDER_PROCESSING':
    case 'ADDITIONAL_DOCUMENTS_REQUIRED':
      return 'Processing';
    case 'SANCTIONED':
    case 'DISBURSEMENT_PENDING':
      return 'Approved';
    case 'DISBURSED':
      return 'Disbursed';
    case 'NOT_ELIGIBLE':
      return 'Rejected';
    case 'CUSTOMER_NOT_INTERESTED':
      return 'Not Interested';
    case 'FOLLOW_UP_LATER':
      return 'Call Back';
    case 'CLOSED_LOST':
      return 'Closed';
    default:
      return 'Contacted';
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Production persistence unavailable.' },
        { status: 503 }
      );
    }
    const resolvedParams = await params;
    const lead = await Lead.findById(resolvedParams.id);
    if (!lead) return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    return NextResponse.json({ success: true, lead });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Production persistence unavailable.' },
        { status: 503 }
      );
    }
    const body = await req.json();
    const resolvedParams = await params;

    delete body._id;
    const currentLead = await Lead.findById(resolvedParams.id);
    if (!currentLead) return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });

    const updateFields: Record<string, any> = { ...body, updatedAt: new Date() };
    delete updateFields.stageChangeReason;
    delete updateFields.stageNotes;
    delete updateFields.changedBy;
    delete updateFields.addChecklistItem;
    delete updateFields.updateChecklistItem;

    // Validate and record stage transitions atomically
    if (body.stage) {
      if (!CANONICAL_LEAD_STAGES.includes(body.stage as CanonicalLeadStage)) {
        return NextResponse.json(
          { success: false, error: `Invalid canonical stage: ${body.stage}` },
          { status: 400 }
        );
      }
      if (body.stage !== currentLead.stage) {
        const history = Array.isArray(currentLead.stageHistory) ? [...currentLead.stageHistory] : [];
        history.push({
          stage: body.stage,
          changedBy: body.changedBy || 'Sachin Shinde',
          changedAt: new Date(),
          reason: body.stageChangeReason || 'Manual stage transition',
          notes: body.stageNotes || ''
        });
        updateFields.stageHistory = history;
        if (!body.status) {
          updateFields.status = mapStageToLegacyStatus(body.stage as CanonicalLeadStage);
        }
      }
    }

    // Handle checklist mutations cleanly (add or update checklist item)
    if (body.addChecklistItem || body.updateChecklistItem) {
      let checklist: any[] = Array.isArray(currentLead.documentChecklist) && currentLead.documentChecklist.length > 0
        ? currentLead.documentChecklist.map((item: any) => (item.toObject ? item.toObject() : { ...item }))
        : (CATEGORY_DOCUMENT_CHECKLISTS[currentLead.loanType] || CATEGORY_DOCUMENT_CHECKLISTS['Personal Loan']).map((def) => ({
            ...def,
            status: 'PENDING',
            updatedAt: new Date()
          }));

      if (body.addChecklistItem) {
        const item = body.addChecklistItem;
        if (!item.code || !item.name) {
          return NextResponse.json(
            { success: false, error: 'Checklist item code and name are required' },
            { status: 400 }
          );
        }
        const idx = checklist.findIndex((c: any) => c.code === item.code);
        const newEntry = {
          code: String(item.code),
          name: String(item.name),
          mandatory: item.mandatory !== undefined ? Boolean(item.mandatory) : true,
          category: item.category || 'BUSINESS',
          status: item.status || 'PENDING',
          updatedAt: new Date(),
          verifiedBy: item.verifiedBy,
          notes: item.notes || ''
        };
        if (idx >= 0) checklist[idx] = { ...checklist[idx], ...newEntry };
        else checklist.push(newEntry);
      }

      if (body.updateChecklistItem) {
        const upd = body.updateChecklistItem;
        const idx = checklist.findIndex((c: any) => c.code === upd.code);
        if (idx === -1) {
          return NextResponse.json(
            { success: false, error: `Checklist item not found: ${upd.code}` },
            { status: 404 }
          );
        }
        checklist[idx] = {
          ...checklist[idx],
          ...(upd.status ? { status: upd.status } : {}),
          ...(upd.verifiedBy ? { verifiedBy: upd.verifiedBy } : {}),
          ...(upd.notes !== undefined ? { notes: upd.notes } : {}),
          updatedAt: new Date()
        };
      }

      updateFields.documentChecklist = checklist;
    }

    const lead = await Lead.findByIdAndUpdate(
      resolvedParams.id,
      { $set: updateFields },
      { new: true }
    );

    return NextResponse.json({ success: true, lead });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

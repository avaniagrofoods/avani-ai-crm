import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { CANONICAL_LEAD_STAGES, CanonicalLeadStage } from '@/config/pipeline';
import { CATEGORY_DOCUMENT_CHECKLISTS } from '@/lib/document-checklist';
import {
  requireAuth,
  requireRole,
  isValidObjectId,
  canAccessLead,
  validateStageTransition,
  sanitizeLeadPayloadForClient
} from '@/lib/auth';

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
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;

    const resolvedParams = await params;
    if (!isValidObjectId(resolvedParams.id)) {
      return NextResponse.json({ success: false, error: 'Invalid lead ID format.' }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Production persistence unavailable.' },
        { status: 503 }
      );
    }

    const lead = await Lead.findById(resolvedParams.id);
    if (!lead) return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });

    if (!canAccessLead(auth.session, lead)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'You are not assigned to this lead.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, lead: sanitizeLeadPayloadForClient(lead, auth.session) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['ADMIN', 'ADVISOR']);
    if (!auth.ok) return auth.response;

    const resolvedParams = await params;
    if (!isValidObjectId(resolvedParams.id)) {
      return NextResponse.json({ success: false, error: 'Invalid lead ID format.' }, { status: 400 });
    }

    const conn = await connectToDatabase();
    if (!conn || conn.connection?.readyState !== 1) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE', message: 'Database offline. Production persistence unavailable.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const currentLead = await Lead.findById(resolvedParams.id);
    if (!currentLead) return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });

    if (!canAccessLead(auth.session, currentLead)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'You are not authorized to modify this lead.' },
        { status: 403 }
      );
    }

    const updateFields: Record<string, any> = { ...body, updatedAt: new Date() };
    // Prevent mass assignment & financial/privilege tampering via PATCH
    delete updateFields._id;
    delete updateFields.role;
    delete updateFields.stageChangeReason;
    delete updateFields.stageNotes;
    delete updateFields.changedBy;
    delete updateFields.addChecklistItem;
    delete updateFields.updateChecklistItem;
    delete updateFields.revenue;
    delete updateFields.sanction;
    delete updateFields.disbursement;
    if (auth.session.role !== 'ADMIN') {
      delete updateFields.assignedAdvisor;
      delete updateFields.assignmentHistory;
    }

    if (body.stage) {
      if (!CANONICAL_LEAD_STAGES.includes(body.stage as CanonicalLeadStage)) {
        return NextResponse.json(
          { success: false, error: `Invalid canonical stage: ${body.stage}` },
          { status: 400 }
        );
      }

      const currentStage = currentLead.stage || 'NEW_ENQUIRY';
      const transitionCheck = validateStageTransition(auth.session, currentStage, body.stage);
      if (!transitionCheck.ok) {
        return NextResponse.json(
          { success: false, error: transitionCheck.error },
          { status: transitionCheck.status }
        );
      }

      if (body.stage !== currentLead.stage) {
        const history = Array.isArray(currentLead.stageHistory) ? [...currentLead.stageHistory] : [];
        history.push({
          stage: body.stage,
          changedBy: auth.session.name,
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
          verifiedBy: auth.session.name,
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
          verifiedBy: auth.session.name,
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

    return NextResponse.json({ success: true, lead: sanitizeLeadPayloadForClient(lead, auth.session) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

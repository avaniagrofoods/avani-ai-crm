import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';
import { Conversation } from '@/models/Conversation';
import { DocumentModel } from '@/models/Document';
import { QualificationEngine } from '@/lib/qualification-engine';
import { requireAuth, isValidObjectId, canAccessLead } from '@/lib/auth';

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
      return NextResponse.json(
        { success: false, error: 'DATABASE_UNAVAILABLE' },
        { status: 503 }
      );
    }

    const lead = await Lead.findById(resolvedParams.id);
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    if (!canAccessLead(auth.session, lead)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'You are not assigned to this lead.' },
        { status: 403 }
      );
    }

    const conversation = await Conversation.findOne({ customerPhone: lead.phone }).lean();
    const docs = await DocumentModel.findOne({ leadId: lead.leadId || lead._id.toString() }).lean();

    const result = QualificationEngine.calculateScore(lead, conversation, docs);

    lead.qualificationScore = result.score;
    lead.qualificationBreakdown = {
      ...result.breakdown,
      calculatedAt: new Date()
    };

    if (result.score >= 60 && (lead.stage === 'NEW_ENQUIRY' || lead.stage === 'CONTACT_PENDING')) {
      lead.stage = 'QUALIFIED';
      lead.stageHistory.push({
        stage: 'QUALIFIED',
        changedBy: `SYSTEM_QUALIFICATION_ENGINE (${auth.session.name})`,
        changedAt: new Date(),
        reason: `Automated Qualification: Score ${result.score}/100 (${result.tierLabel})`,
        notes: result.reasoning.join(' | ')
      });
    }

    lead.updatedAt = new Date();
    await lead.save();

    return NextResponse.json({
      success: true,
      leadId: lead.leadId,
      score: result.score,
      tier: result.tier,
      tierLabel: result.tierLabel,
      breakdown: result.breakdown,
      reasoning: result.reasoning
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

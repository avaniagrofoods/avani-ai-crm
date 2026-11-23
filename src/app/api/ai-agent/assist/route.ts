import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  APPROVED_KNOWLEDGE_BASE,
  handleCrmAssistedTurn
} from '@/lib/ai-agent-compliance';
import { followupRepository } from '@/lib/google-sheets';

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    success: true,
    agent: 'AVANI AI Loan Advisory Assistant',
    autoContactAllowed: false,
    knowledgeBaseCount: APPROVED_KNOWLEDGE_BASE.length,
    productsCovered: APPROVED_KNOWLEDGE_BASE.map((k) => k.product)
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json({ success: false, error: 'Customer message text is required' }, { status: 400 });
    }

    const consentStatus =
      body.consentStatus === 'GRANTED' ||
      body.consentStatus === 'DENIED' ||
      body.consentStatus === 'WITHDRAWN' ||
      body.consentStatus === 'PENDING'
        ? body.consentStatus
        : 'PENDING';

    const result = await handleCrmAssistedTurn({
      conversation: typeof body.conversation === 'object' && body.conversation !== null
        ? (body.conversation as Record<string, unknown>)
        : undefined,
      text,
      consentStatus,
      isOptedOut: body.isOptedOut === true
    });

    // Optional canonical Google Sheets follow-up audit persistence (strictly when explicitly requested & not opted out)
    let followupLoggedId: string | null = null;
    if (
      body.persistFollowupRecommendation === true &&
      !result.consentSuppressed &&
      typeof body.leadId === 'string' &&
      typeof body.customerId === 'string' &&
      body.leadId.trim() &&
      body.customerId.trim()
    ) {
      try {
        const hours = result.followupRecommendation.suggestedFollowupHours || 24;
        const dueIso = new Date(Date.now() + hours * 3600000).toISOString();
        const saved = await followupRepository.createOrUpdateFollowup({
          lead_id: body.leadId.trim(),
          customer_id: body.customerId.trim(),
          followup_date: dueIso,
          followup_type: result.followupRecommendation.requiresHumanEscalation ? 'ADVISOR_ESCALATION' : 'AI_QUALIFICATION_FOLLOWUP',
          followup_status: 'PENDING',
          short_notes: `[AI-ASSIST] ${result.classification}: ${result.followupRecommendation.nextStep}`.slice(0, 200)
        });
        followupLoggedId = saved.record.followup_id;
      } catch (sheetsErr: unknown) {
        console.warn('[AI Agent Assist] Optional followup persistence warning:', sheetsErr instanceof Error ? sheetsErr.message : 'unavailable');
      }
    }

    return NextResponse.json({
      ...result,
      followupLoggedId
    });
  } catch (error: unknown) {
    console.error('[AI Agent Assist] Unexpected error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

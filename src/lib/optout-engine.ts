import {
  CrmSheetsService,
  customerRepository,
  leadRepository,
  consentRepository,
  followupRepository
} from '@/lib/google-sheets';

/**
 * TASK 5H.4 — GOOGLE SHEETS OPT-OUT & CONSENT WITHDRAWAL ENGINE
 * Preserves Task 3B Hindi opt-out ('रोकें'), Marathi ('थांबवा'), and English ('STOP') detection 100%,
 * while persisting opt-out and consent withdrawal exclusively to Google Sheets (CUSTOMERS, LEADS, CONSENTS, FOLLOWUPS).
 */
export class OptOutEngine {
  /**
   * Builds canonical phone variants (+91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX, 0XXXXXXXXXX)
   * so opt-out suppression works uniformly regardless of how a phone number was stored.
   */
  static getPhoneVariants(phone: string): { cleanPhone: string; raw10: string; variants: string[] } {
    const trimmed = String(phone || '').trim();
    const rawDigits = trimmed.replace(/\D/g, '');
    const raw10 = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;
    let cleanPhone = trimmed.replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.length === 10 ? '+91' + cleanPhone : (raw10.length === 10 ? '+91' + raw10 : '+' + cleanPhone);
    }
    const variants = Array.from(new Set([
      trimmed,
      cleanPhone,
      cleanPhone.replace('+91', ''),
      cleanPhone.replace('+', ''),
      ...(raw10.length === 10 ? [raw10, `+91${raw10}`, `91${raw10}`, `0${raw10}`] : []),
    ])).filter(Boolean);
    return { cleanPhone, raw10, variants };
  }

  /**
   * Checks if incoming message text contains opt-out intent across English, Marathi, and Hindi.
   */
  static isOptOutMessage(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const lower = text.trim().toLowerCase();

    const optOutPhrases = [
      // English
      'stop', 'unsubscribe', 'no more', 'do not message', 'don\'t message',
      'remove me', 'cancel', 'opt out', 'opt-out', 'pause messages', 'block',
      // Marathi
      'थांबवा', 'नको', 'बंद करा', 'मेसेज पाठवू नका', 'संदेश थांबवा',
      'nako', 'nakaye', 'thamba', 'thambwa', 'band kara',
      // Hindi
      'रोकें', 'रोको', 'बंद करो', 'संदेश मत भेजो', 'हटाओ', 'मैसेज मत करो',
      'roken', 'roko', 'band karo', 'mat bhejo', 'hatao'
    ];

    return optOutPhrases.some(phrase => lower === phrase || lower.includes(phrase));
  }

  static async processOptOut(params: {
    leadId?: string;
    phone: string;
    messageText: string;
    eventId?: string;
    suppressAcknowledgement?: boolean;
  }) {
    await CrmSheetsService.assertHealthy();

    const optOutAt = new Date();
    const { cleanPhone } = this.getPhoneVariants(params.phone);

    // 1. Upsert Customer in CUSTOMERS sheet with record_status = 'OPTED_OUT'
    const existingCustomer = await customerRepository.findByMobile(cleanPhone);
    const { record: customer } = await customerRepository.upsertCustomer({
      customer_id: existingCustomer?.customer_id,
      customer_name: existingCustomer?.customer_name || 'Customer',
      mobile_number: cleanPhone,
      city: existingCustomer?.city || 'Latur',
      enquiry_source: existingCustomer?.enquiry_source || 'WHATSAPP_INBOUND',
      record_status: 'OPTED_OUT',
      updated_at: optOutAt
    });

    // 2. Upsert Consent in CONSENTS sheet with consent_status = 'WITHDRAWN' & optout_status = 'OPTED_OUT'
    await consentRepository.upsertConsent({
      customer_id: customer.customer_id,
      channel: 'WHATSAPP',
      consent_status: 'WITHDRAWN',
      consent_source: 'WHATSAPP_OPTOUT_KEYWORD',
      consent_timestamp: optOutAt,
      optout_status: 'OPTED_OUT',
      updated_at: optOutAt
    });

    // 3. Update all matching Leads in LEADS sheet to lead_status = 'OPTED_OUT'
    const leads = await leadRepository.findByCustomerId(customer.customer_id);
    if (params.leadId) {
      const byId = await leadRepository.findById(params.leadId);
      if (byId && !leads.some((l) => l.lead_id === byId.lead_id)) {
        leads.push(byId);
      }
    }
    for (const l of leads) {
      await leadRepository.upsertLead({
        ...l,
        lead_status: 'OPTED_OUT',
        updated_at: optOutAt
      });
    }

    // 4. Cancel any pending Follow-ups in FOLLOWUPS sheet
    await followupRepository.cancelPendingFollowupsForCustomerOrLead({
      customer_id: customer.customer_id,
      lead_id: params.leadId || leads[0]?.lead_id
    });

    return {
      success: true,
      phone: cleanPhone,
      customerId: customer.customer_id,
      leadId: params.leadId || leads[0]?.lead_id,
      status: 'OPTED_OUT',
      consentStatus: 'WITHDRAWN',
      optOutAt,
      acknowledged: false,
      suppressed: true
    };
  }
}

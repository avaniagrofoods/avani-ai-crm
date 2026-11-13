import axios from 'axios';
import { ProviderRouter } from './provider-router';
import { sanitizeForLog } from './consent-privacy';
import { evaluateAuthorizedTestRecipient, maskPhoneForLog } from './safeguards';

export const GOOGLE_SHEETS_RECOMMENDED_TABS = [
  'Master Leads',
  'Personal Loan',
  'Business Loan',
  'Doctor Loan',
  'CA Loan',
  'Home Loan',
  'Mortgage Loan',
  'Education Loan',
  'School Funding',
  'College Funding',
  'Follow-up Tracker',
  'Opt-out Suppression',
  'Integration Errors',
  'Daily Reports'
] as const;

export const GOOGLE_SHEETS_STANDARD_FIELDS = [
  'Lead_ID',
  'Created_At',
  'Full_Name',
  'Mobile',
  'Email',
  'City',
  'Language',
  'Applicant_Type',
  'Loan_Category',
  'Required_Amount',
  'Monthly_Income_Range',
  'Lead_Source',
  'Consent_Status',
  'Qualification_Status',
  'Document_Checklist_Status',
  'Assigned_Advisor',
  'Next_Follow_Up',
  'CRM_Record_ID',
  'HubSpot_Record_ID'
] as const;

export function resolveGoogleSheetTabsForLead(lead: any): string[] {
  if (lead?.isOptedOut || lead?.status === 'OPTED_OUT' || lead?.consentStatus === 'WITHDRAWN' || lead?.consentStatus === 'DENIED') {
    return ['Master Leads', 'Opt-out Suppression'];
  }

  const tabs: string[] = ['Master Leads'];
  const cat = String(lead?.loanType || lead?.loan_category || 'Personal Loan').toLowerCase();

  if (cat.includes('doctor')) tabs.push('Doctor Loan');
  else if (/\bca\b/i.test(cat) || cat.includes('chartered')) tabs.push('CA Loan');
  else if (cat.includes('school')) tabs.push('School Funding');
  else if (cat.includes('college')) tabs.push('College Funding');
  else if (cat.includes('education')) tabs.push('Education Loan');
  else if (cat.includes('mortgage') || cat.includes('lap') || cat.includes('against property')) tabs.push('Mortgage Loan');
  else if (cat.includes('home')) tabs.push('Home Loan');
  else if (cat.includes('business')) tabs.push('Business Loan');
  else tabs.push('Personal Loan');

  if (lead?.nextFollowUp || lead?.followUpStatus === 'PENDING') {
    tabs.push('Follow-up Tracker');
  }

  return tabs;
}

export function formatGoogleSheetsRow(lead: any): Record<string, any> {
  const stableLeadId = lead?.leadId || (lead?._id ? String(lead._id) : `AVL-${Date.now()}`);
  return {
    Lead_ID: stableLeadId,
    Created_At: lead?.createdAt ? new Date(lead.createdAt).toISOString() : new Date().toISOString(),
    Full_Name: sanitizeForLog(lead?.name || lead?.full_name || 'Customer'),
    Mobile: lead?.phone || lead?.mobile_number || '',
    Email: lead?.email || '',
    City: lead?.city || '',
    Language: lead?.preferredLanguage || lead?.preferred_language || 'English',
    Applicant_Type: lead?.employmentType || lead?.applicant_type || 'Salaried',
    Loan_Category: lead?.loanType || lead?.loan_category || 'Personal Loan',
    Required_Amount: String(lead?.requestedAmount || lead?.requiredLoanAmount || lead?.required_loan_amount || ''),
    Monthly_Income_Range: lead?.monthlyIncomeRange || lead?.monthly_income_range || '',
    Lead_Source: lead?.leadSource || lead?.source || 'WhatsApp Inbound',
    Consent_Status: lead?.isOptedOut ? 'OPTED_OUT' : (lead?.consentStatus || 'GRANTED'),
    Qualification_Status: lead?.qualificationStatus || lead?.aiAgentStatus || lead?.status || 'PENDING',
    Document_Checklist_Status: lead?.documentStatus || 'CHECKLIST_GENERATED',
    Assigned_Advisor: lead?.assignedAgent?.name || 'Sachin Shinde',
    Next_Follow_Up: lead?.nextFollowUp || '',
    CRM_Record_ID: lead?._id ? String(lead._id) : stableLeadId,
    HubSpot_Record_ID: lead?.hubSpotContactId || lead?.hubSpotDealId || ''
  };
}

export async function logToGoogleSheets(lead: any) {
  const url = process.env.GOOGLE_SHEET_APP_SCRIPT_URL;
  const row = formatGoogleSheetsRow(lead);
  const targetTabs = resolveGoogleSheetTabsForLead(lead);

  if (!url || process.env.PROVIDER_MODE === 'mock') {
    return {
      success: true,
      mode: url ? 'mock_gate' : 'unconfigured_skip',
      leadId: row.Lead_ID,
      targetTabs,
      row
    };
  }

  try {
    await axios.post(url, {
      leadId: row.Lead_ID,
      idempotencyKey: `SHEETS:${row.Lead_ID}`,
      targetTabs,
      row,
      // Legacy compatibility fields
      name: row.Full_Name,
      phone: row.Mobile,
      loanType: row.Loan_Category,
      status: row.Qualification_Status,
      requestedAmount: row.Required_Amount,
      summary: sanitizeForLog(lead?.callSummary || '')
    });
    return { success: true, mode: 'live', leadId: row.Lead_ID, targetTabs, row };
  } catch (error: any) {
    console.error('Google Sheets logging error:', sanitizeForLog(error?.message || error));
    return { success: false, error: error?.message || 'Google Sheets sync error', leadId: row.Lead_ID };
  }
}

export function buildHubSpotSyncPayload(lead: any) {
  const stableLeadId = lead?.leadId || (lead?._id ? String(lead._id) : `AVL-${Date.now()}`);
  const fields = [
    { name: 'firstname', value: sanitizeForLog(lead?.name || lead?.full_name || 'Customer') },
    { name: 'phone', value: String(lead?.phone || lead?.mobile_number || '') },
    { name: 'email', value: String(lead?.email || '') },
    { name: 'city', value: String(lead?.city || '') },
    { name: 'loan_category', value: String(lead?.loanType || lead?.loan_category || 'Personal Loan') },
    { name: 'applicant_category', value: String(lead?.employmentType || lead?.applicant_type || 'Salaried') },
    { name: 'required_loan_amount', value: String(lead?.requestedAmount || lead?.requiredLoanAmount || lead?.required_loan_amount || '') },
    { name: 'monthly_income_range', value: String(lead?.monthlyIncomeRange || lead?.monthly_income_range || '') },
    { name: 'lead_source', value: String(lead?.leadSource || lead?.source || 'WhatsApp Inbound') },
    { name: 'consent_status', value: lead?.isOptedOut ? 'OPTED_OUT' : String(lead?.consentStatus || 'GRANTED') },
    { name: 'qualification_status', value: String(lead?.qualificationStatus || lead?.status || 'New') },
    { name: 'advisor_owner', value: String(lead?.assignedAgent?.name || 'Sachin Shinde') },
    { name: 'follow_up_date', value: String(lead?.nextFollowUp || '') },
    { name: 'crm_record_reference', value: stableLeadId },
    { name: 'hs_lead_status', value: String(lead?.status || 'NEW') },
    {
      name: 'message',
      value: `LeadID: ${stableLeadId} | Loan Type: ${lead?.loanType || 'Personal Loan'} | Amount: ${lead?.requestedAmount || 'N/A'}`
    }
  ];

  return {
    idempotencyKey: `HUBSPOT:${stableLeadId}:${lead?.phone || ''}`,
    matchingIdentifiers: {
      phone: String(lead?.phone || lead?.mobile_number || ''),
      email: String(lead?.email || '')
    },
    fields
  };
}

export async function syncToHubSpot(lead: any) {
  const payload = buildHubSpotSyncPayload(lead);

  if (lead?.isOptedOut || lead?.status === 'OPTED_OUT' || lead?.consentStatus === 'WITHDRAWN') {
    return {
      success: true,
      suppressed: true,
      reason: 'CONTACT_OPTED_OUT',
      payload
    };
  }

  const portalId = process.env.HUBSPOT_PORTAL_ID;
  const formId = process.env.HUBSPOT_FORM_ID;
  if (!portalId || !formId || process.env.PROVIDER_MODE === 'mock') {
    return {
      success: true,
      mode: portalId && formId ? 'mock_gate' : 'unconfigured_skip',
      payload
    };
  }

  const url = `https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`;

  try {
    await axios.post(url, { fields: payload.fields });
    return { success: true, mode: 'live', payload };
  } catch (error: any) {
    console.error('HubSpot sync error:', sanitizeForLog(error?.response?.data || error.message));
    return { success: false, error: error?.message || 'HubSpot sync error', payload };
  }
}

export async function triggerMakeWebhook(lead: any) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url || process.env.PROVIDER_MODE === 'mock') return;
  try {
    await axios.post(url, lead);
  } catch (error) {
    console.error('Make.com Webhook error:', sanitizeForLog(error));
  }
}

export async function triggerPabblyWebhook(lead: any) {
  if (process.env.PROVIDER_MODE === 'mock') return;
  const url = 'https://hook.pabbly.com/api/webhook/6a080bc1e6a8ff432d89bea8/6a0811cf22f0d1bfa6095a6d';
  try {
    await axios.post(url, lead);
  } catch (error) {
    console.error('Pabbly Webhook error:', sanitizeForLog(error));
  }
}

export async function sendMissedCallWhatsApp(phone: string, name: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || '+917249108474';

  if (process.env.PROVIDER_MODE !== 'live') return;
  const recipientCheck = evaluateAuthorizedTestRecipient(phone);
  if (!recipientCheck.allowed) {
    console.warn(`[WhatsAppChecklist Safety Clamp] Blocked Twilio fallback for unauthorized recipient: ${recipientCheck.targetMasked}`);
    return;
  }
  if (!accountSid || !authToken) return;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const message = `Hello ${name}, we tried calling you from Avani Finserv regarding your loan inquiry but couldn't connect. Are you still looking for a loan? Reply YES to continue chatting with our AI assistant.`;
  const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  const data = new URLSearchParams({
    To: `whatsapp:${formattedPhone}`,
    From: `whatsapp:${twilioWhatsApp}`,
    Body: message
  });

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    await axios.post(url, data.toString(), {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  } catch (error: any) {
    console.error('Twilio Missed Call WA error:', sanitizeForLog(error?.response?.data || error.message));
  }
}

export const ZAPIER_WORKFLOW_TYPES = [
  'NEW_CRM_LEAD_TO_SHEETS',
  'QUALIFIED_LEAD_TO_HUBSPOT',
  'ADVISOR_ASSIGNMENT_NOTIFICATION',
  'FOLLOWUP_DUE_REMINDER',
  'FAILED_INTEGRATION_ALERT',
  'DAILY_SUMMARY_REPORT'
] as const;

export type ZapierWorkflowType = (typeof ZAPIER_WORKFLOW_TYPES)[number];

export function buildZapierPayload(lead: any, workflowType: ZapierWorkflowType = 'NEW_CRM_LEAD_TO_SHEETS') {
  const stableLeadId = lead?.leadId || (lead?._id ? String(lead._id) : `AVL-${Date.now()}`);
  return {
    idempotencyKey: `ZAPIER:${workflowType}:${stableLeadId}`,
    workflowType,
    source_system: 'AVANI_AI_CRM_AUTHORITATIVE',
    prevent_circular_sync: true,
    leadId: stableLeadId,
    name: sanitizeForLog(lead?.name || lead?.full_name || 'Customer'),
    phone: lead?.phone || lead?.mobile_number || '',
    email: lead?.email || '',
    city: lead?.city || '',
    loanType: lead?.loanType || lead?.loan_category || 'Personal Loan',
    applicantType: lead?.employmentType || lead?.applicant_type || 'Salaried',
    status: lead?.status || 'New',
    requestedAmount: lead?.requestedAmount || lead?.requiredLoanAmount || '',
    consentStatus: lead?.isOptedOut ? 'OPTED_OUT' : (lead?.consentStatus || 'GRANTED'),
    assignedAdvisor: lead?.assignedAgent?.name || 'Sachin Shinde',
    summary: sanitizeForLog(lead?.callSummary || '')
  };
}

export async function syncToZapier(lead: any, workflowType: ZapierWorkflowType = 'NEW_CRM_LEAD_TO_SHEETS') {
  const payload = buildZapierPayload(lead, workflowType);

  if (lead?.isOptedOut || lead?.status === 'OPTED_OUT' || lead?.consentStatus === 'WITHDRAWN') {
    return {
      success: true,
      suppressed: true,
      reason: 'CONTACT_OPTED_OUT',
      payload
    };
  }

  // Prevent circular automation if payload originated from Zapier or HubSpot
  if (lead?.source_system === 'ZAPIER' || lead?.source_system === 'HUBSPOT') {
    return {
      success: true,
      suppressed: true,
      reason: 'CIRCULAR_SYNC_PREVENTED',
      payload
    };
  }

  const url = process.env.ZAPIER_WEBHOOK_URL || 'https://hooks.zapier.com/hooks/catch/26860693/44xndib/';
  if (process.env.PROVIDER_MODE === 'mock') {
    return {
      success: true,
      mode: 'mock_gate',
      payload
    };
  }

  try {
    await axios.post(url, payload);
    console.log('Logged lead to Zapier');
    return { success: true, mode: 'live', payload };
  } catch (error: any) {
    console.error('Zapier logging error:', sanitizeForLog(error?.message || error));
    return { success: false, error: error?.message || 'Zapier webhook error', payload };
  }
}

export async function sendAiSensyWhatsAppTemplate(
  phone: string,
  name: string,
  templateName: string = 'loan_consultation_offer',
  templateParams: string[] = [],
  attempt: number = 1
): Promise<{ success: boolean; message: string }> {
  if (process.env.PROVIDER_MODE !== 'live') {
    return { success: true, message: 'Mock safety gate: template dispatch simulated' };
  }
  const recipientCheck = evaluateAuthorizedTestRecipient(phone);
  if (!recipientCheck.allowed) {
    console.error(`[Integrations Safety Clamp] Blocked live AiSensy template dispatch to ${recipientCheck.targetMasked}: ${recipientCheck.reason}`);
    return { success: false, message: recipientCheck.message };
  }

  const apiKey = process.env.AISENCY_WABA_API_KEY;
  if (!apiKey) {
    console.warn('AISENCY_WABA_API_KEY is not defined.');
    return { success: false, message: 'API key missing' };
  }

  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }

  const endpoint = 'https://backend.aisensy.com/campaign/t1/api/v2';
  const payload = {
    apiKey: apiKey,
    campaignName: templateName,
    destination: cleanPhone,
    userName: name || 'Customer',
    templateParams: templateParams.length > 0 ? templateParams : [name || 'Customer'],
    source: 'API',
    media: null
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok && data.success) {
      console.log(`AiSensy WhatsApp Template ${templateName} sent to ${maskPhoneForLog(cleanPhone)}`);
      return { success: true, message: 'Sent successfully' };
    } else {
      throw new Error(data.message || `API error status ${response.status}`);
    }
  } catch (error: any) {
    console.error(`AiSensy Attempt ${attempt} failed for ${maskPhoneForLog(cleanPhone)}:`, error.message);
    if (attempt < 3) {
      console.log(`Retrying in 2 seconds (attempt ${attempt + 1})...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return sendAiSensyWhatsAppTemplate(phone, name, templateName, templateParams, attempt + 1);
    }
    return { success: false, message: error.message || 'Max retries exceeded' };
  }
}

export async function sendWhatsAppChecklist(phone: string, name: string, loanType: string) {
  const res = await ProviderRouter.dispatchMessage({
    phone,
    name,
    templateName: 'loan_consultation_offer',
    templateParams: [name],
    campaignId: `CHECKLIST_${Date.now()}`
  });
  if (res.success) {
    return;
  }

  console.log('Primary provider failed. Falling back to Twilio WhatsApp...');
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioWhatsApp = '+917249108474';

  if (process.env.PROVIDER_MODE !== 'live') return;
  const recipientCheck = evaluateAuthorizedTestRecipient(phone);
  if (!recipientCheck.allowed) {
    console.warn(`[WhatsAppChecklist Safety Clamp] Blocked Twilio fallback for unauthorized recipient: ${recipientCheck.targetMasked}`);
    return;
  }
  if (!accountSid || !authToken) return;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const message = `नमस्कार ${name},
'अवनी लोन सर्विसेस' (Avani Loan Services) शी संपर्क साधल्याबद्दल धन्यवाद. 🙏
आमच्या कॉलवरील चर्चेनुसार, आमच्याकडे तुमच्यासाठी आकर्षक व्याजदरात पर्सनल, बिझनेस, होम, मॉर्गेज, एज्युकेशन, डॉक्टर आणि सीए लोन उपलब्ध आहेत.
अधिक माहितीसाठी तुम्ही या नंबरवर 7249108474 वर 'YES' लिहून रिप्लाय करू शकता.
धन्यवाद,

नमस्ते ${name},
अवनी लोन सर्विसेस (Avani Loan Services) से बात करने के लिए धन्यवाद। 🙏
जैसा कि हमने कॉल पर चर्चा की थी, हमारे पास आपके लिए आकर्षक ब्याज दरों पर पर्सनल, बिज़नेस, होम, मॉर्गेज, एजुकेशन, डॉक्टर और सीए लोन उपलब्ध हैं।
अधिक जानकारी के लिए आप इस नंबर 7249108474 पर 'YES' लिखकर रिप्लाई कर सकते हैं।
धन्यवाद,
अवनी लोन सर्विसेस.`;

  const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  const data = new URLSearchParams({
    To: `whatsapp:${formattedPhone}`,
    From: `whatsapp:${twilioWhatsApp}`,
    Body: message
  });

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    await axios.post(url, data.toString(), {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  } catch (error: any) {
    console.error('Twilio WhatsApp error:', sanitizeForLog(error?.response?.data || error.message));
  }
}

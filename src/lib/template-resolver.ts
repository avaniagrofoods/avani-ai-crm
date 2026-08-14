export interface ResolverContext {
  lead?: any;
  conversation?: any;
  application?: any;
  advisor?: any;
  campaign?: any;
  explicitParams?: string[];
}

export interface ResolutionResult {
  success: boolean;
  resolvedParams: string[];
  missingFields: string[];
  errorCode?: 'TEMPLATE_PARAMETER_MISSING';
}

export class TemplateVariableResolver {
  static resolveVariables(requiredVariables: string[], context: ResolverContext): ResolutionResult {
    const resolvedParams: string[] = [];
    const missingFields: string[] = [];

    const { lead, conversation, application, advisor, campaign, explicitParams } = context;

    for (let i = 0; i < requiredVariables.length; i++) {
      const varName = requiredVariables[i];

      // Priority 0: Explicitly passed parameter
      if (explicitParams && explicitParams[i] && explicitParams[i].trim() !== '') {
        resolvedParams.push(explicitParams[i].trim());
        continue;
      }

      let value: string | undefined = undefined;

      // Priority 1: Lead
      if (lead) {
        if (varName === '{{1}}' || varName === '{{Customer Name}}' || varName === 'userName') {
          value = lead.name || lead.firstName;
        } else if (varName === '{{City}}') {
          value = lead.city;
        } else if (varName === '{{Product Name}}') {
          value = lead.loanType;
        }
      }

      // Priority 2: Conversation
      if (!value && conversation) {
        if (conversation.context?.fullName) value = conversation.context.fullName;
        if (!value && conversation.product) value = conversation.product;
      }

      // Priority 3: Application
      if (!value && application) {
        if (varName === '{{Application Number}}') value = application.applicationNumber || application.id;
      }

      // Priority 4: Advisor
      if (!value && advisor) {
        if (varName === '{{Advisor Name}}') value = advisor.name;
      } else if (!value && (varName === '{{Advisor Name}}' || varName === 'advisorName')) {
        value = 'Sachin Shinde (Senior Advisor)';
      }

      // Priority 5: Campaign
      if (!value && campaign) {
        if (varName === '{{Business Name}}') value = campaign.businessName || 'Avani Loan Services';
      } else if (!value && (varName === '{{Business Name}}' || varName === 'businessName')) {
        value = 'Avani Loan Services';
      }

      // Default fallback for customer name
      if (!value && (varName === '{{1}}' || varName === '{{Customer Name}}' || varName === 'userName')) {
        value = 'Valued Customer';
      }

      if (value && value.trim() !== '' && value !== 'undefined' && value !== 'null') {
        resolvedParams.push(value.trim());
      } else {
        missingFields.push(varName);
      }
    }

    if (missingFields.length > 0) {
      return {
        success: false,
        resolvedParams: [],
        missingFields,
        errorCode: 'TEMPLATE_PARAMETER_MISSING'
      };
    }

    return {
      success: true,
      resolvedParams,
      missingFields: []
    };
  }
}

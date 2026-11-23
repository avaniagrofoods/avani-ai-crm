export interface ClassifiedMetaSyncError {
  status: number;
  error: 'META_TOKEN_EXPIRED_OR_INVALID' | 'TEMPLATE_SYNC_FAILED';
  message: string;
  retryable: boolean;
  requiresOwnerTokenRefresh: boolean;
}

/**
 * Classifies Meta Graph API / template sync failures without exposing raw tokens,
 * upstream headers, or internal stack traces to HTTP clients (APR006-P3-01).
 */
export function classifyMetaTokenError(error: unknown): ClassifiedMetaSyncError {
  const errObj = (error && typeof error === 'object' ? error : {}) as Record<string, any>;
  const responseStatus = Number(errObj?.response?.status ?? errObj?.status ?? errObj?.httpStatus ?? 0);
  const graphError = errObj?.response?.data?.error ?? errObj?.error ?? {};
  const graphCode = Number(graphError?.code ?? errObj?.code ?? 0);
  const graphType = String(graphError?.type ?? '');
  const rawMessage = String(graphError?.message ?? errObj?.message ?? '');

  const isMetaAuthFailure =
    responseStatus === 401 ||
    graphCode === 190 ||
    /OAuthException/i.test(graphType) ||
    /Session has expired|Error validating access token|Invalid OAuth access token/i.test(rawMessage);

  if (isMetaAuthFailure) {
    return {
      status: 502,
      error: 'META_TOKEN_EXPIRED_OR_INVALID',
      message: 'Meta Graph API access token is expired or invalid. Owner credential refresh is required.',
      retryable: false,
      requiresOwnerTokenRefresh: true
    };
  }

  return {
    status: 500,
    error: 'TEMPLATE_SYNC_FAILED',
    message: 'WhatsApp template sync failed due to an internal error.',
    retryable: true,
    requiresOwnerTokenRefresh: false
  };
}

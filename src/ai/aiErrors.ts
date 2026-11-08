// src/ai/aiErrors.ts
// تحويل أخطاء الذكاء الاصطناعي لنص بلغة المستخدم.
import { translate } from '../i18n/translate';
import { AiError } from './providers';
import { RouteError } from './routedSend';

export function aiErrorText(err: unknown): string {
  if (err instanceof RouteError) {
    if (err.reason === 'all_busy') {
      const secs = Math.max(1, Math.ceil((err.retryInMs ?? 0) / 1000));
      return translate('ai_route_all_busy').replace('{s}', String(secs));
    }
    return translate(err.reason === 'no_slots' ? 'ai_route_no_slots' : 'ai_route_no_capable');
  }
  if (err instanceof AiError) {
    switch (err.code) {
      case 'auth':
        return translate('ai_err_auth');
      case 'rate':
        return `${translate('ai_err_rate')}${err.message ? `\n${err.message}` : ''}`;
      case 'timeout':
        return translate('ai_err_timeout');
      case 'network':
        return translate('ai_err_network');
      case 'no_model':
        return translate('ai_err_no_model');
      case 'bad_response':
        return translate('ai_err_bad_response');
      default:
        return `${translate('ai_err_http')}${err.status ? ` (${err.status})` : ''}${err.message ? `: ${err.message}` : ''}`;
    }
  }
  return String((err as any)?.message || err);
}
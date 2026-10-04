import { AppError } from './domain';
import { isLocalMode, requireLocalMode } from './runtime';
import type { Purpose } from './otp-crypto';

export interface OtpProvider {
  name: 'unifonic' | 'fake';
  send(input: { phone: string; code: string; id: string; purpose: Purpose }): Promise<string>;
  healthCheck(): Promise<boolean>;
}
const endpoint = 'https://el.cloud.unifonic.com/rest/SMS/messages';
export function providerConfigured() {
  return (
    process.env.OTP_PROVIDER === 'unifonic' &&
    Boolean(process.env.UNIFONIC_APP_SID?.trim()) &&
    /^[A-Za-z0-9 ._-]{2,11}$/.test(process.env.OTP_SENDER_ID ?? '')
  );
}
export class UnifonicProvider implements OtpProvider {
  readonly name = 'unifonic';
  constructor(private readonly request: typeof fetch = fetch) {}
  async send(input: { phone: string; code: string; id: string; purpose: Purpose }) {
    if (!providerConfigured()) throw new AppError('خدمة الرسائل غير مهيأة.', 503, 'NOT_CONFIGURED');
    try {
      const response = await this.request(endpoint, {
        method: 'POST',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          AppSid: process.env.UNIFONIC_APP_SID,
          SenderID: process.env.OTP_SENDER_ID,
          Recipient: input.phone.slice(1),
          CorrelationID: input.id,
          Body: `رمز التحقق ${input.code} ${input.purpose === 'REGISTER' ? 'لتسجيل مشاركتك' : input.purpose === 'LOGIN' ? 'لتسجيل الدخول' : 'لاختبار التحقق'} في مسابقة الانتماء واللحمة الوطنية. صالح لخمس دقائق. لا تشاركه مع أحد.`,
        }),
      });
      const data = await response.json();
      if (
        !response.ok ||
        data.success !== true ||
        !['Sent', 'Queued'].includes(data.data?.Status) ||
        !/^[0-9]+$/.test(String(data.data?.MessageID ?? ''))
      )
        throw new Error('send failed');
      return String(data.data.MessageID);
    } catch {
      // Vendor bodies may echo the SMS and credentials. Never expose or log them.
      throw new AppError(
        'تعذّر إرسال الرسالة. انتظر ثم اطلب رمزًا جديدًا.',
        503,
        'PROVIDER_FAILED',
      );
    }
  }
  async healthCheck() {
    try {
      // A non-sending reachability probe. The separate verified SMS test proves account and sender access.
      const response = await this.request(endpoint, {
        method: 'HEAD',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok || [400, 401, 403, 405].includes(response.status);
    } catch {
      return false;
    }
  }
}
class FakeProvider implements OtpProvider {
  readonly name = 'fake';
  async send() {
    requireLocalMode();
    return 'local-simulation';
  }
  async healthCheck() {
    requireLocalMode();
    return true;
  }
}
export function otpProvider(): OtpProvider {
  if (process.env.OTP_PROVIDER === 'fake' && isLocalMode()) return new FakeProvider();
  if (providerConfigured()) return new UnifonicProvider();
  throw new AppError('خدمة التحقق قيد الإعداد. يرجى المحاولة لاحقًا.', 503, 'NOT_CONFIGURED');
}

/**
 * SSLCommerz Payment Gateway Service
 * Handles SSLCommerz session initialization, transaction validation, IPN callbacks,
 * and bKash / Nagad / Rocket / Card processing.
 */

export interface SSLCommerzInitParams {
  tran_id: string;
  total_amount: number;
  currency: string;
  cus_name: string;
  cus_email: string;
  cus_phone: string;
  cus_add1: string;
  cus_city: string;
  cus_postcode: string;
  product_name: string;
  product_category?: string;
  preferred_channel?: 'bkash' | 'nagad' | 'rocket' | 'cards' | 'any';
  success_url?: string;
  fail_url?: string;
  cancel_url?: string;
  ipn_url?: string;
}

export interface SSLCommerzInitResponse {
  status: 'SUCCESS' | 'FAILED';
  failedreason?: string;
  sessionkey?: string;
  GatewayPageURL?: string;
  redirectGatewayURL?: string;
  DirectPaymentURLBank?: string;
  DirectPaymentURLCard?: string;
  DirectPaymentURLbKash?: string;
  isSandbox: boolean;
  tran_id: string;
}

export interface SSLCommerzValidationResponse {
  status: 'VALID' | 'VALIDATED' | 'FAILED' | 'CANCELLED';
  tran_id: string;
  val_id?: string;
  amount?: string | number;
  bank_tran_id?: string;
  card_type?: string;
  card_brand?: string;
  card_issuer?: string;
  card_no?: string;
  currency?: string;
  tran_date?: string;
  error?: string;
}

export interface SSLCommerzValidationResult {
  ok: boolean;
  reason?: string;
  raw?: SSLCommerzValidationResponse;
}

export interface SSLCommerzRefundResult {
  APIConnect: string;
  status?: string;
  refund_ref_id?: string;
  errorReason?: string;
}

export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayError';
  }
}

class SSLCommerzService {
  private storeId: string;
  private storePasswd: string;
  private ipnToken: string;
  private isSandbox: boolean;
  private baseUrl: string;
  private paymentSimulatorEnabled: boolean;

  constructor() {
    const isDeveloperEnvironment = ['development', 'test'].includes(process.env.NODE_ENV || '');
    this.storeId = process.env.SSLCOMMERZ_STORE_ID || (isDeveloperEnvironment ? 'testbox' : '');
    this.storePasswd = process.env.SSLCOMMERZ_STORE_PASSWORD || (isDeveloperEnvironment ? 'qwerty' : '');
    this.ipnToken = process.env.SSLCOMMERZ_IPN_TOKEN || (isDeveloperEnvironment ? 'dev-local-sslcommerz-ipn-token' : '');
    const sandboxSetting = process.env.SSLCOMMERZ_IS_SANDBOX;
    this.isSandbox = sandboxSetting === 'true';
    this.paymentSimulatorEnabled = process.env.PAYMENT_SIMULATOR === 'true' && isDeveloperEnvironment;

    if (!isDeveloperEnvironment) {
      if (!this.ipnToken) throw new Error('Production requires SSLCOMMERZ_IPN_TOKEN.');
      if (!this.storeId || !this.storePasswd || this.storeId === 'testbox' || this.storePasswd === 'qwerty') {
        throw new Error('Production requires valid SSLCommerz store credentials.');
      }
      if (process.env.PAYMENT_SIMULATOR === 'true' || sandboxSetting !== 'false') {
        throw new Error('Production requires SSLCOMMERZ_IS_SANDBOX=false and PAYMENT_SIMULATOR must not be true.');
      }
    }

    this.baseUrl = this.isSandbox
      ? 'https://sandbox.sslcommerz.com'
      : 'https://securepay.sslcommerz.com';
  }

  public getIpnToken(): string {
    return this.ipnToken;
  }

  public isPaymentSimulatorEnabled(): boolean {
    return this.paymentSimulatorEnabled;
  }

  private createSimulatedSession(params: SSLCommerzInitParams, hostUrl: string): SSLCommerzInitResponse {
    const simulatorUrl = `${hostUrl}/api/payment/simulator?tran_id=${encodeURIComponent(params.tran_id)}`;
    return {
      status: 'SUCCESS',
      sessionkey: `SSLCZ-SESS-${Date.now()}`,
      GatewayPageURL: simulatorUrl,
      DirectPaymentURLbKash: simulatorUrl,
      isSandbox: this.isSandbox,
      tran_id: params.tran_id,
    };
  }

  public getSettings() {
    return {
      storeId: this.storeId,
      isSandbox: this.isSandbox,
      gatewayUrl: this.baseUrl,
      ipnTokenConfigured: Boolean(this.ipnToken),
    };
  }

  /**
   * Initialize payment session with SSLCommerz
   */
  public async initPayment(params: SSLCommerzInitParams, hostUrl: string = 'http://localhost:3000'): Promise<SSLCommerzInitResponse> {
    if (this.paymentSimulatorEnabled) return this.createSimulatedSession(params, hostUrl);

    const successUrl = params.success_url || `${hostUrl}/api/payment/sslcommerz/success`;
    const failUrl = params.fail_url || `${hostUrl}/api/payment/sslcommerz/fail`;
    const cancelUrl = params.cancel_url || `${hostUrl}/api/payment/sslcommerz/cancel`;
    const ipnUrl = params.ipn_url || `${hostUrl}/api/payment/sslcommerz/ipn`;

    const formData = new URLSearchParams();
    formData.append('store_id', this.storeId);
    formData.append('store_passwd', this.storePasswd);
    formData.append('total_amount', String(params.total_amount));
    formData.append('currency', params.currency || 'BDT');
    formData.append('tran_id', params.tran_id);
    formData.append('success_url', successUrl);
    formData.append('fail_url', failUrl);
    formData.append('cancel_url', cancelUrl);
    formData.append('ipn_url', ipnUrl);
    formData.append('cus_name', params.cus_name || 'Valued Customer');
    formData.append('cus_email', params.cus_email || 'customer@example.com');
    formData.append('cus_add1', params.cus_add1 || 'Dhaka, Bangladesh');
    formData.append('cus_city', params.cus_city || 'Dhaka');
    formData.append('cus_postcode', params.cus_postcode || '1200');
    formData.append('cus_country', 'Bangladesh');
    formData.append('cus_phone', params.cus_phone || '01700000000');
    formData.append('shipping_method', 'Courier');
    formData.append('num_of_item', '1');
    formData.append('product_name', params.product_name || 'Marketplace Order');
    formData.append('product_category', params.product_category || 'General Goods');
    formData.append('product_profile', 'general');

    if (params.preferred_channel === 'bkash') {
      formData.append('multi_card_name', 'bkash');
    }

    try {
      const response = await fetch(`${this.baseUrl}/gwprocess/v4/api.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(8000), // 8s timeout
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'SUCCESS') {
          return {
            status: 'SUCCESS',
            sessionkey: data.sessionkey,
            GatewayPageURL: data.GatewayPageURL,
            redirectGatewayURL: data.redirectGatewayURL,
            DirectPaymentURLbKash: data.DirectPaymentURLbKash || data.GatewayPageURL,
            isSandbox: this.isSandbox,
            tran_id: params.tran_id,
          };
        }
      }
    } catch (err: any) {
      if (this.paymentSimulatorEnabled) {
        return this.createSimulatedSession(params, hostUrl);
      }
      throw new GatewayError('SSLCommerz gateway is unavailable.');
    }

    if (this.paymentSimulatorEnabled) return this.createSimulatedSession(params, hostUrl);
    throw new GatewayError('SSLCommerz gateway rejected the payment session.');
  }

  /**
   * Validates a gateway transaction against its transaction ID, currency, and amount.
   */
  public async validatePayment(valId: string, tranId: string, expectedBdt: number): Promise<SSLCommerzValidationResult> {
    if (!valId) {
      return { ok: false, reason: 'missing val_id' };
    }

    if (this.paymentSimulatorEnabled) {
      if (valId !== `SIM-${tranId}`) return { ok: false, reason: 'invalid simulator validation ID' };
      return {
        ok: true,
        raw: {
          status: 'VALID',
          tran_id: tranId,
          val_id: valId,
          amount: expectedBdt,
          currency: 'BDT',
          bank_tran_id: `SIM-BANK-${tranId}`,
        },
      };
    }

    const query = new URLSearchParams({
      val_id: valId,
      store_id: this.storeId,
      store_passwd: this.storePasswd,
      format: 'json',
    });

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/validator/api/validationserverAPI.php?${query.toString()}`,
        { signal: AbortSignal.timeout(8000) }
      );
    } catch {
      throw new GatewayError('SSLCommerz validator is unreachable.');
    }

    if (!response.ok) {
      throw new GatewayError('SSLCommerz validator is unreachable.');
    }

    let data: SSLCommerzValidationResponse;
    try {
      data = await response.json() as SSLCommerzValidationResponse;
    } catch {
      throw new GatewayError('SSLCommerz validator returned an invalid response.');
    }

    const gatewayAmount = Number(data.amount);
    const amountMatches = Number.isFinite(gatewayAmount)
      && gatewayAmount.toFixed(2) === expectedBdt.toFixed(2);
    const ok = ['VALID', 'VALIDATED'].includes(data.status)
      && data.tran_id === tranId
      && data.currency === 'BDT'
      && amountMatches;

    return {
      ok,
      reason: ok ? undefined : 'gateway validation did not match the expected payment',
      raw: data,
    };
  }

  public async initiateRefund(params: {
    bankTranId: string;
    refundTransId: string;
    amount: number;
    remarks: string;
    referenceId: string;
  }): Promise<SSLCommerzRefundResult> {
    if (this.paymentSimulatorEnabled) {
      return { APIConnect: 'DONE', status: 'success', refund_ref_id: `SIM-REF-${params.refundTransId}` };
    }
    const query = new URLSearchParams({
      bank_tran_id: params.bankTranId,
      refund_trans_id: params.refundTransId,
      refund_amount: params.amount.toFixed(2),
      refund_remarks: params.remarks.slice(0, 255),
      refe_id: params.referenceId,
      store_id: this.storeId,
      store_passwd: this.storePasswd,
      format: 'json',
    });
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/validator/api/merchantTransIDvalidationAPI.php?${query.toString()}`, {
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new GatewayError('SSLCommerz refund service is unreachable.');
    }
    if (!response.ok) throw new GatewayError('SSLCommerz refund service is unavailable.');
    let result: SSLCommerzRefundResult;
    try {
      result = await response.json() as SSLCommerzRefundResult;
    } catch {
      throw new GatewayError('SSLCommerz refund service returned an invalid response.');
    }
    if (result.APIConnect !== 'DONE' || !['success', 'processing'].includes(String(result.status))) {
      throw new GatewayError(result.errorReason || 'SSLCommerz did not accept the refund request.');
    }
    if (!result.refund_ref_id) throw new GatewayError('SSLCommerz did not return a refund reference.');
    return result;
  }

  public async getRefundStatus(refundRefId: string): Promise<SSLCommerzRefundResult> {
    if (this.paymentSimulatorEnabled) {
      return { APIConnect: 'DONE', status: 'refunded', refund_ref_id: refundRefId };
    }
    const query = new URLSearchParams({
      refund_ref_id: refundRefId,
      store_id: this.storeId,
      store_passwd: this.storePasswd,
      format: 'json',
    });
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/validator/api/merchantTransIDvalidationAPI.php?${query.toString()}`, {
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new GatewayError('SSLCommerz refund status service is unreachable.');
    }
    if (!response.ok) throw new GatewayError('SSLCommerz refund status service is unavailable.');
    let result: SSLCommerzRefundResult;
    try {
      result = await response.json() as SSLCommerzRefundResult;
    } catch {
      throw new GatewayError('SSLCommerz refund status service returned an invalid response.');
    }
    if (result.APIConnect !== 'DONE') throw new GatewayError(result.errorReason || 'SSLCommerz could not verify refund status.');
    return result;
  }
}

export const sslcommerz = new SSLCommerzService();

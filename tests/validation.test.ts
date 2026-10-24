import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  addToCartBody,
  aiChatBody,
  aiHelperBody,
  analyticsEventBody,
  bundleActiveBody,
  categoryBody,
  createBundleBody,
  createProductBody,
  createAdminBody,
  cvFormatBody,
  cvParseBody,
  deliveryReviewBody,
  productImageUploadBody,
  riderApplicationStatusBody,
  sellerStatusBody,
  productIdParam,
  productStatusBody,
  updateProductBody,
  createOrderBody,
  customerRegisterBody,
  customerUpdateBody,
  emptyBody,
  gatewayReturnBody,
  loginBody,
  paymentInitBody,
  payoutPayBody,
  resourceIdParam,
  riderApplyBody,
  riderLocationBody,
  riderProfileBody,
  riderWithdrawalBody,
  sellerPayoutRequestBody,
  sellerProfileBody,
  sellerRegisterBody,
  signupBody,
  simulatorCompleteBody,
  sslcommerzIpnBody,
  sslcommerzValidateBody,
  withdrawalStatusBody,
} from '../server/validation/schemas.ts';
import { validateBody } from '../server/middleware/validate.ts';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => assert.equal(schema.safeParse(value).success, true, JSON.stringify(value));
const bad = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => assert.equal(schema.safeParse(value).success, false, JSON.stringify(value));

test('signup: role, password length and types are enforced', () => {
  ok(signupBody, { role: 'customer', username: 'abc_12', password: 'longenough' });
  ok(signupBody, { role: 'seller', email: 'a@b.co', password: 'longenough' });
  bad(signupBody, { role: 'admin', username: 'abc', password: 'longenough' });
  bad(signupBody, { role: 'customer', username: 'abc', password: 'short' });
  bad(signupBody, { role: 'customer', username: 'abc', password: 'x'.repeat(129) });
  bad(signupBody, { role: 'customer', username: { $ne: '' }, password: 'longenough' });
  bad(signupBody, { role: 'customer', username: 'a'.repeat(500), password: 'longenough' });
});

test('login: requires two bounded strings', () => {
  ok(loginBody, { email: ' user ', password: 'x' });
  bad(loginBody, { email: '', password: 'x' });
  bad(loginBody, { email: 'u', password: '' });
  bad(loginBody, { email: ['a'], password: 'x' });
  bad(loginBody, { email: 'u', password: 'p'.repeat(1001) });
  bad(loginBody, {});
});

test('payment init: unsupported methods and bad ids fail, server-controlled keys survive for the handler to reject', () => {
  ok(paymentInitBody, { orderId: 'ORD-123', paymentMethod: 'nagad' });
  assert.equal(paymentInitBody.parse({ orderId: 'ORD-123' }).paymentMethod, 'bkash');
  bad(paymentInitBody, { orderId: 'ORD-123', paymentMethod: 'cash_on_delivery' });
  bad(paymentInitBody, { orderId: "ORD-1'; DROP TABLE orders;--" });
  bad(paymentInitBody, { orderId: 42 });
  assert.equal((paymentInitBody.parse({ orderId: 'ORD-1', amount: 1 }) as any).amount, 1, 'amount must reach the handler so it can be rejected by name');
});

test('sslcommerz validate: transaction id format and val_id', () => {
  ok(sslcommerzValidateBody, { tran_id: 'SSLCZ-AB12-9', val_id: 'v1' });
  bad(sslcommerzValidateBody, { tran_id: 'nope', val_id: 'v1' });
  bad(sslcommerzValidateBody, { tran_id: 'SSLCZ-AB12', val_id: '   ' });
  bad(sslcommerzValidateBody, { tran_id: 'SSLCZ-AB12', val_id: 'v1', order_id: { a: 1 } });
});

test('money amounts: positive, at most two decimals, bounded, numeric strings accepted', () => {
  ok(sellerPayoutRequestBody, { amount: 100 });
  ok(sellerPayoutRequestBody, { amount: '250.75' });
  bad(sellerPayoutRequestBody, { amount: 0 });
  bad(sellerPayoutRequestBody, { amount: -5 });
  bad(sellerPayoutRequestBody, { amount: 10.005 });
  bad(sellerPayoutRequestBody, { amount: 1e12 });
  bad(sellerPayoutRequestBody, { amount: 'NaN' });
  bad(sellerPayoutRequestBody, { amount: null });
  bad(sellerPayoutRequestBody, {});
});

test('payout and withdrawal bodies', () => {
  ok(payoutPayBody, { externalReference: 'TXN123' });
  bad(payoutPayBody, { externalReference: '   ' });
  bad(payoutPayBody, { externalReference: 'x'.repeat(101) });
  ok(riderWithdrawalBody, { amount: 500, payoutMethod: 'bkash', payoutAccount: '01700000000' });
  bad(riderWithdrawalBody, { amount: 500, payoutMethod: 'paypal', payoutAccount: '01700000000' });
  bad(riderWithdrawalBody, { amount: 500, payoutMethod: 'bank', payoutAccount: '' });
  ok(withdrawalStatusBody, { status: 'paid' });
  bad(withdrawalStatusBody, { status: 'pending' });
});

test('rider location: coordinates must be real numbers in range', () => {
  ok(riderLocationBody, { latitude: 23.8, longitude: 90.4 });
  ok(riderLocationBody, { latitude: '23.8', longitude: '90.4' });
  bad(riderLocationBody, { latitude: 91, longitude: 0 });
  bad(riderLocationBody, { latitude: 0, longitude: 181 });
  bad(riderLocationBody, { latitude: null, longitude: 0 });
  bad(riderLocationBody, {});
});

test('earlier schemas still behave: cart quantity, order items, id params', () => {
  assert.equal(addToCartBody.parse({ Product_ID: 'PROD-1', Quantity: '3' }).Quantity, 3);
  bad(addToCartBody, { Product_ID: 'PROD-1', Quantity: 0 });
  bad(createOrderBody, { Customer_ID: 'C1', Items: [], Shipping_Address: { Street: 's', City: 'c' } });
  ok(resourceIdParam, { id: 'PAYOUT-1' });
  bad(resourceIdParam, { id: '../etc/passwd' });
});

test('product writes: types and size caps, partial updates allowed, unknown fields kept', () => {
  ok(createProductBody, { Name: 'Shirt', Price: '499.50', Stock: 3, Category_ID: 'CAT-1', Seller_ID: 'SEL-1', Images: ['https://x.example/a.jpg'], Voucher_Expires_At: null });
  ok(updateProductBody, { Stock: 12 });
  ok(updateProductBody, {});
  assert.equal((createProductBody.parse({ Name: 'a', Featured_Deal: true }) as any).Featured_Deal, true);
  bad(createProductBody, { Name: 'x'.repeat(81) });
  bad(createProductBody, { Name: { $gt: '' } });
  bad(createProductBody, { Price: 'free' });
  bad(createProductBody, { Stock: -1 });
  bad(createProductBody, { Stock: 1.5 });
  bad(createProductBody, { Images: 'not-an-array' });
  bad(createProductBody, { Images: Array(31).fill('a') });
  bad(createProductBody, { Description: 'w'.repeat(6001) });
  bad(createProductBody, { Seller_ID: "x'; --" });
  bad(updateProductBody, { Video_URL: 'h'.repeat(2049) });
  ok(productStatusBody, { status: 'inactive' });
  bad(productStatusBody, { status: 'deleted' });
});

test('categories, bundles, analytics and params', () => {
  ok(categoryBody, { Name: ' Shoes ' });
  bad(categoryBody, { Name: '   ' });
  bad(categoryBody, { Name: 'n'.repeat(81) });
  ok(createBundleBody, { Name: 'Duo', Product_IDs: ['P1', 'P2'], Discount_Percent: '10' });
  bad(createBundleBody, { Name: 'Duo', Product_IDs: 'P1', Discount_Percent: 10 });
  bad(createBundleBody, { Name: 'Duo', Product_IDs: ['P1', 'P2'], Discount_Percent: 'lots' });
  ok(bundleActiveBody, { Active: false });
  bad(bundleActiveBody, { Active: 'false' });
  ok(analyticsEventBody, { Product_ID: 'PROD-1', Event_Type: 'click', Session_ID: 'a'.repeat(20) });
  bad(analyticsEventBody, { Product_ID: 'PROD-1', Event_Type: 'purchase', Session_ID: 'a'.repeat(20) });
  bad(analyticsEventBody, { Product_ID: 'PROD-1', Event_Type: 'click', Session_ID: 'short' });
  ok(productIdParam, { productId: 'PROD-1700000000000' });
  bad(productIdParam, { productId: 'a b' });
});

test('AI inputs are bounded before they reach the paid model', () => {
  ok(aiChatBody, { message: 'hello', history: [{ role: 'user', parts: [{ text: 'hi' }] }] });
  bad(aiChatBody, { message: '' });
  bad(aiChatBody, { message: 'x'.repeat(4001) });
  bad(aiChatBody, { message: 'hi', history: Array(61).fill({}) });
  bad(aiChatBody, { message: ['hi'] });
  ok(aiHelperBody, { productName: 'Shirt', notes: 'fast' });
  ok(aiHelperBody, {});
  bad(aiHelperBody, { sourceText: 's'.repeat(8001) });
  bad(aiHelperBody, { products: Array(51).fill({}) });
  bad(aiHelperBody, { productName: 123 });
});

test('admin review actions and delivery steps', () => {
  ok(sellerStatusBody, { status: 'approved', identityVerified: true, documentsReviewed: true, payoutVerified: true });
  ok(sellerStatusBody, { status: 'rejected', reason: 'Documents unreadable' });
  bad(sellerStatusBody, { status: 'banned' });
  bad(sellerStatusBody, { status: 'approved', identityVerified: 'yes' });
  bad(sellerStatusBody, { status: 'rejected', reason: 'r'.repeat(1001) });
  ok(riderApplicationStatusBody, { status: 'suspended', reason: null });
  bad(riderApplicationStatusBody, { status: 'pending' });
  ok(deliveryReviewBody, { rating: 5, wasTimely: true, reviewText: 'quick' });
  bad(deliveryReviewBody, { rating: 6, wasTimely: true });
  bad(deliveryReviewBody, { rating: 5, wasTimely: 'yes' });
  bad(deliveryReviewBody, { rating: 5, wasTimely: true, reviewText: 'r'.repeat(2001) });
});

test('uploads and CV helpers are bounded', () => {
  ok(productImageUploadBody, { Image: 'data:image/png;base64,AAAA' });
  bad(productImageUploadBody, { Image: 'https://example.com/a.png' });
  bad(productImageUploadBody, { Image: 'data:image/png;base64,' + 'A'.repeat(4_000_000) });
  bad(productImageUploadBody, {});
  ok(cvFormatBody, { experience: ['a'], education: [] });
  bad(cvFormatBody, { experience: 'a' });
  bad(cvFormatBody, { experience: Array(41).fill('a') });
  ok(cvParseBody, { cvBase64: 'JVBERi0=' });
  bad(cvParseBody, { cvBase64: '' });
  bad(cvParseBody, { cvBase64: 'A'.repeat(8_000_001) });
  ok(createAdminBody, { Name: 'Root', Email: 'a@b.co', Password: 'longenough', Number: '017', Address: { Street: 's', City: 'c' } });
  bad(createAdminBody, { Password: 'p'.repeat(129) });
  bad(createAdminBody, { Address: 'Dhaka' });
});

test('validateBody replies 400 with the first message and never calls the handler', () => {
  let status = 0;
  let payload: any;
  let called = false;
  const res: any = { status(code: number) { status = code; return this; }, json(body: unknown) { payload = body; return this; } };
  validateBody(loginBody)({ body: { email: '', password: '' } } as any, res, () => { called = true; });
  assert.equal(status, 400);
  assert.equal(called, false);
  assert.equal(payload.error, 'Username/Email and Password are required');
  assert.ok(Array.isArray(payload.issues));
});

const goodAddress = { House_Name: '12', Street: 'Road 5', City: 'Dhaka', Postal_Code: '1207', Latitude: 23.8, Longitude: 90.4 };
const pdfDataUrl = 'data:application/pdf;base64,JVBERi0x';

test('customer registration: required fields keep their messages, types and sizes are capped', () => {
  const good = { Name: 'Ayesha', Email: 'a@example.com', Password: 'longenough1', Number: '01700000000', Address: goodAddress, Marketing_Consent: true };
  ok(customerRegisterBody, good);
  bad(customerRegisterBody, { ...good, Password: 'short' });
  assert.equal((customerRegisterBody.safeParse({ ...good, Number: '  ' }) as any).error.issues[0].message, 'A phone number is required');
  assert.equal((customerRegisterBody.safeParse({ ...good, Address: { ...goodAddress, City: '' } }) as any).error.issues[0].message, 'Select a location and provide a street and city');
  bad(customerRegisterBody, { ...good, Password: 'x'.repeat(129) });
  bad(customerRegisterBody, { ...good, Name: 'x'.repeat(121) });
  bad(customerRegisterBody, { ...good, Name: { $gt: '' } });
  bad(customerRegisterBody, { ...good, Marketing_Consent: 'yes' });
  bad(customerRegisterBody, { ...good, Address: 'Dhaka' });
  assert.equal('Role' in (customerRegisterBody.parse({ ...good, Role: 'admin' }) as object), false, 'unknown keys are dropped');
});

test('customer update: every field optional but typed and capped', () => {
  ok(customerUpdateBody, {});
  ok(customerUpdateBody, { Name: 'New', Address: { City: 'Dhaka', Latitude: null, Longitude: null } });
  bad(customerUpdateBody, { Name: 123 });
  bad(customerUpdateBody, { Email: 'x'.repeat(256) });
  bad(customerUpdateBody, { Address: { Street: 'x'.repeat(201) } });
  bad(customerUpdateBody, { Address: [] });
});

test('seller registration: payout, identity document and address rules', () => {
  const good = { Name: 'Shop', Email: 's@example.com', Password: 'longenough1', Number: '01700000000', Address: goodAddress, Payout_Method: 'bkash', Payout_Account: '01700000000', Identity_Document: pdfDataUrl };
  ok(sellerRegisterBody, good);
  ok(sellerRegisterBody, { ...good, Password: undefined });
  assert.equal((sellerRegisterBody.safeParse({ ...good, Name: '' }) as any).error.issues[0].message, 'Name and Email are required');
  assert.equal((sellerRegisterBody.safeParse({ ...good, Payout_Method: 'cash' }) as any).error.issues[0].message, 'Choose bKash or bank payout and provide a valid payout account.');
  assert.equal((sellerRegisterBody.safeParse({ ...good, Identity_Document: undefined }) as any).error.issues[0].message, 'Upload a government ID document.');
  bad(sellerRegisterBody, { ...good, Identity_Document: 'x'.repeat(7_100_001) });
  bad(sellerRegisterBody, { ...good, Payout_Account: 'x'.repeat(101) });
  bad(sellerRegisterBody, { ...good, Description: 'x'.repeat(2001) });
  bad(sellerRegisterBody, { ...good, Address: { ...goodAddress, Street: '' } });
});

test('seller profile update: typed, capped, payout method limited to the known set', () => {
  ok(sellerProfileBody, { Name: 'Shop', Address: goodAddress, Payout_Method: 'bank', Payout_Account: '123456' });
  ok(sellerProfileBody, { Payout_Method: '' });
  bad(sellerProfileBody, { Payout_Method: 'paypal' });
  bad(sellerProfileBody, { Name: ['a'] });
  bad(sellerProfileBody, { Identity_Document: 'x'.repeat(7_100_001) });
  bad(sellerProfileBody, { Address: { Latitude: { lat: 1 } } });
});

test('rider application and profile: lists, images and CV are bounded', () => {
  const base = { Username: 'rider1', Name: 'Rafi', Email: 'r@example.com', Password: 'longenough1', Number: '01700000000', Present_Address: goodAddress, Permanent_Address: goodAddress, Has_CV: false, Experience: ['2 years'], Previous_Jobs: [], Education: ['HSC'] };
  ok(riderApplyBody, base);
  ok(riderApplyBody, { ...base, Has_CV: true, CV_Base64: pdfDataUrl, CV_File_Name: 'cv.pdf' });
  assert.equal((riderApplyBody.safeParse({ ...base, Has_CV: 'no' }) as any).error.issues[0].message, 'Choose whether you have a CV.');
  bad(riderApplyBody, { ...base, CV_Base64: 'x'.repeat(4_200_001) });
  bad(riderApplyBody, { ...base, Profile_Image: 'x'.repeat(2_900_001) });
  bad(riderApplyBody, { ...base, Experience: 'ten years' });
  bad(riderApplyBody, { ...base, Experience: Array.from({ length: 51 }, () => 'x') });
  bad(riderApplyBody, { ...base, Education: ['x'.repeat(501)] });
  ok(riderProfileBody, { ...base, Password: '' });
  bad(riderProfileBody, { ...base, Present_Address: 'Dhaka' });
  bad(riderProfileBody, { ...base, Username: 'x'.repeat(61) });
});

test('gateway callbacks never reject: bad fields are dropped, not answered with 400', () => {
  assert.deepEqual(gatewayReturnBody.parse({ tran_id: 'SSLCZ-1', val_id: 'VAL', card_no: '4111' }), { tran_id: 'SSLCZ-1', val_id: 'VAL' });
  const dropped = gatewayReturnBody.parse({ tran_id: { a: 1 }, val_id: 'x'.repeat(500) });
  assert.equal(dropped.tran_id, undefined);
  assert.equal(dropped.val_id, undefined);
  assert.equal(gatewayReturnBody.parse({}).tran_id, undefined);
  assert.deepEqual(simulatorCompleteBody.parse({ tran_id: 5, account: ['x'], code: 'y'.repeat(500) }), { tran_id: '', account: '', code: '', security: '' });
});

test('IPN: the transaction id must look like ours, other fields are capped and optional', () => {
  ok(sslcommerzIpnBody, { tran_id: 'SSLCZ-ABC-123', val_id: 'v', status: 'VALID', amount: '10.00' });
  ok(sslcommerzIpnBody, { tran_id: 'SSLCZ-ABC-123' });
  assert.equal((sslcommerzIpnBody.safeParse({ tran_id: "x'; DROP TABLE payments;--" }) as any).error.issues[0].message, 'A valid SSLCommerz transaction ID is required');
  bad(sslcommerzIpnBody, {});
  bad(sslcommerzIpnBody, { tran_id: ['SSLCZ-A'] });
  assert.equal((sslcommerzIpnBody.parse({ tran_id: 'SSLCZ-A', status: { x: 1 } }) as any).status, undefined);
});

test('bodyless routes discard whatever the client sends', () => {
  assert.deepEqual(emptyBody.parse({ anything: 1, nested: { a: 2 } }), {});
  assert.deepEqual(emptyBody.parse({}), {});
});

// Ratchet: a write route must either validate its input or be on this list. The list may only shrink.
const STILL_UNVALIDATED: string[] = JSON.parse(readFileSync('tests/unvalidated-routes.json', 'utf8'));

const writeRoutes = () => {
  const found: Array<{ key: string; validated: boolean }> = [];
  for (const file of readdirSync('server/routes').filter((name) => name.endsWith('.routes.ts'))) {
    const source = readFileSync(`server/routes/${file}`, 'utf8');
    for (const match of source.matchAll(/router\.(post|put|patch|delete)\(\s*'([^']*)'/g)) {
      const start = match.index ?? 0;
      const rest = source.slice(start, start + 600);
      const cut = Math.min(...['async', '=>', 'handle'].map((word) => { const i = rest.indexOf(word, 20); return i < 0 ? rest.length : i; }));
      const head = rest.slice(0, cut);
      found.push({ key: `${file} ${match[1].toUpperCase()} ${match[2]}`, validated: /validateBody|validateParams/.test(head) });
    }
  }
  return found;
};

test('every write route validates its input or is on the shrinking allowlist', () => {
  const routes = writeRoutes();
  assert.ok(routes.length > 50, 'route scan found the routes');
  const unvalidated = routes.filter((route) => !route.validated).map((route) => route.key);
  const fresh = unvalidated.filter((key) => !STILL_UNVALIDATED.includes(key));
  assert.deepEqual(fresh, [], 'New write routes must use validateBody/validateParams.');
  const stale = STILL_UNVALIDATED.filter((key) => !unvalidated.includes(key));
  assert.deepEqual(stale, [], 'These routes are validated now: remove them from tests/unvalidated-routes.json.');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOrderBody, customerRegisterBody, signupBody } from '../server/validation/schemas.ts';

test('customer password signup must explicitly accept the terms and privacy policy', () => {
  const signup = {
    role: 'customer',
    username: 'buyer123',
    password: 'strong-password',
  };
  assert.throws(() => signupBody.parse(signup), /Accept the Terms of Service and Privacy Policy/);
  assert.throws(() => signupBody.parse({ ...signup, acceptedTerms: false }), /Accept the Terms of Service and Privacy Policy/);
  assert.equal(signupBody.parse({ ...signup, acceptedTerms: true }).acceptedTerms, true);
});

test('direct customer registration requires explicit policy acceptance', () => {
  const registration = {
    Name: 'Test Customer',
    Email: 'customer@example.test',
    Password: 'strong-password',
    Number: '01700000000',
    Address: { Street: 'Test Street', City: 'Dhaka' },
  };
  assert.throws(() => customerRegisterBody.parse(registration), /Accept the Terms of Service and Privacy Policy/);
  assert.equal(customerRegisterBody.parse({ ...registration, acceptedTerms: true }).acceptedTerms, true);
});

test('placing an order requires explicit terms acceptance', () => {
  const order = {
    Customer_ID: 'CUST-123',
    Items: [{ Product_ID: 'PROD-123', Quantity: 1 }],
    Shipping_Address: { Street: 'Test Street', City: 'Dhaka' },
  };
  assert.throws(() => createOrderBody.parse(order), /Accept the Terms of Service, Refund Policy and Delivery Policy/);
  assert.throws(() => createOrderBody.parse({ ...order, acceptedTerms: false }), /Accept the Terms of Service, Refund Policy and Delivery Policy/);
  assert.equal(createOrderBody.parse({ ...order, acceptedTerms: true }).acceptedTerms, true);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getProfileCompletion } from '../src/lib/profileCompletion.ts';

test('customer profile requires contact and shipping details', () => {
  const incomplete = getProfileCompletion('customer', { Name: '', Email: 'pending@profile.shopniro.invalid' });
  assert.equal(incomplete.complete, false);
  assert.ok(incomplete.missingFields.includes('email address'));
  assert.ok(incomplete.missingFields.includes('shipping address street'));

  const complete = getProfileCompletion('customer', {
    Name: 'Customer Name',
    Email: 'customer@example.com',
    Number: '01700000000',
    Address: { House_Name: 'Unit 2', Street: 'Main road', City: 'Dhaka', Postal_Code: '1200', Latitude: 23.8, Longitude: 90.4 },
  });
  assert.deepEqual(complete, { complete: true, missingFields: [] });
});

test('seller profile requires identity and a mapped business address', () => {
  const incomplete = getProfileCompletion('seller', {
    Name: 'Shop',
    Username: 'shop',
    Email: 'shop@example.com',
    Number: '01700000000',
    Address: { House_Name: 'Unit 2', Street: 'Main road', City: 'Dhaka' },
  });
  assert.equal(incomplete.complete, false);
  assert.ok(incomplete.missingFields.includes('business address map location'));

  const complete = getProfileCompletion('seller', {
    Name: 'Shop',
    Username: 'shop',
    Email: 'shop@example.com',
    Number: '01700000000',
    Address: { House_Name: 'Unit 2', Street: 'Main road', City: 'Dhaka', Latitude: 23.8, Longitude: 90.4 },
    Payout_Method: 'bkash',
    Payout_Account: '01700000000',
    Has_Identity_Document: true,
  });
  assert.equal(complete.complete, true);
});

test('rider profile requires both mapped addresses and application history fields', () => {
  const incomplete = getProfileCompletion('rider', {
    Name: 'Rider',
    Username: 'rider',
    Email: 'rider@example.com',
    Number: '01700000000',
  });
  assert.equal(incomplete.complete, false);
  assert.ok(incomplete.missingFields.includes('present address map location'));
  assert.ok(incomplete.missingFields.includes('education or "None"'));

  const address = { House_Name: 'Unit 2', Street: 'Main road', City: 'Dhaka', Latitude: 23.8, Longitude: 90.4 };
  const complete = getProfileCompletion('rider', {
    Name: 'Rider',
    Username: 'rider',
    Email: 'rider@example.com',
    Number: '01700000000',
    Present_Address: address,
    Permanent_Address: address,
    Experience: ['None'],
    Previous_Jobs: ['None'],
    Education: ['None'],
  });
  assert.equal(complete.complete, true);
});

test('admin profiles are not subject to shopper profile completion', () => {
  assert.deepEqual(getProfileCompletion('admin', {}), { complete: true, missingFields: [] });
});
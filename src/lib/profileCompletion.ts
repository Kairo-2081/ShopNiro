import { UserRole } from '../types';

export interface ProfileCompletion {
  complete: boolean;
  missingFields: string[];
}

const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const hasEmail = (value: unknown) => typeof value === 'string'
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  && !value.trim().toLowerCase().endsWith('.invalid');
const hasCoordinates = (address: any) => typeof address?.Latitude === 'number'
  && Number.isFinite(address.Latitude)
  && typeof address?.Longitude === 'number'
  && Number.isFinite(address.Longitude);
const hasListEntry = (value: unknown) => Array.isArray(value)
  && value.some((entry) => typeof entry === 'string' && entry.trim().length > 0);

export function getProfileCompletion(role: UserRole, profile: any): ProfileCompletion {
  if (role === 'admin') return { complete: true, missingFields: [] };

  const missingFields: string[] = [];
  const requireText = (label: string, value: unknown) => {
    if (!hasText(value)) missingFields.push(label);
  };
  const requireEmail = (value: unknown) => {
    if (!hasEmail(value)) missingFields.push('email address');
  };
  const requireAddress = (label: string, address: any, includePostalCode: boolean, includeCoordinates: boolean) => {
    requireText(`${label} house or unit`, address?.House_Name);
    requireText(`${label} street`, address?.Street);
    requireText(`${label} city`, address?.City);
    if (includePostalCode) requireText('postal code', address?.Postal_Code);
    if (includeCoordinates && !hasCoordinates(address)) missingFields.push(`${label} map location`);
  };

  requireText('name', profile?.Name);
  requireEmail(profile?.Email);
  requireText('phone number', profile?.Number);

  if (role === 'customer') {
    requireAddress('shipping address', profile?.Address, true, true);
  } else if (role === 'seller') {
    requireText('username', profile?.Username);
    requireAddress('business address', profile?.Address, false, true);
    requireText('payout method', profile?.Payout_Method);
    requireText('payout account', profile?.Payout_Account);
    if (profile?.Has_Identity_Document !== true) missingFields.push('government ID document');
  } else if (role === 'rider') {
    requireText('username', profile?.Username);
    requireAddress('present address', profile?.Present_Address, false, true);
    requireAddress('permanent address', profile?.Permanent_Address, false, true);
    if (!hasListEntry(profile?.Experience)) missingFields.push('experience or "None"');
    if (!hasListEntry(profile?.Previous_Jobs)) missingFields.push('previous jobs or "None"');
    if (!hasListEntry(profile?.Education)) missingFields.push('education or "None"');
  }

  return { complete: missingFields.length === 0, missingFields };
}
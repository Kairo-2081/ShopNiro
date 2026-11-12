import assert from 'node:assert/strict';
import test from 'node:test';
import { POLICIES } from '../src/components/legal/policies.ts';
import { POLICY_TRANSLATIONS } from '../src/components/legal/policyTranslations.ts';
import { loadBengaliMessages, translateMessage } from '../src/lib/i18n.tsx';

test('Bangla legal pages preserve every section and list item', () => {
  for (const policy of POLICIES) {
    const translation = POLICY_TRANSLATIONS[policy.id];
    assert.equal(translation.sections.length, policy.sections.length, `${policy.id} section count`);
    assert.match(translation.title, /[\u0980-\u09FF]/, `${policy.id} title is Bangla`);
    assert.match(translation.summary, /[\u0980-\u09FF]/, `${policy.id} summary is Bangla`);

    policy.sections.forEach((section, index) => {
      const translated = translation.sections[index];
      assert.match(translated.heading, /[\u0980-\u09FF]/, `${policy.id} section ${index + 1} heading`);
      assert.equal(translated.paragraphs?.length || 0, section.paragraphs?.length || 0);
      assert.equal(translated.bullets?.length || 0, section.bullets?.length || 0);
      for (const text of [...(translated.paragraphs || []), ...(translated.bullets || [])]) {
        assert.match(text, /[\u0980-\u09FF]/, `${policy.id} section ${index + 1} text is Bangla`);
      }
    });
  }
});

test('locale messages interpolate dynamic values', async () => {
  await loadBengaliMessages();
  assert.equal(translateMessage('bn', 'receiptItemsCount', { count: 3 }), 'পণ্য · 3');
  assert.equal(translateMessage('bn', 'resendIn', { seconds: 12 }), '12 সেকেন্ড পর আবার পাঠান');
});

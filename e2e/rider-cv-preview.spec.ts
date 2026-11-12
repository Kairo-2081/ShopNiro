import { expect, test, type Page } from '@playwright/test';
import { AUTH } from './global-setup.ts';
import { blockNonLocalTraffic } from './helpers.ts';

// A one-page PDF with a single black rectangle, written by hand so the test needs no PDF library. The rectangle means a
// page that rendered shows dark pixels, and no font has to load for that to be true.
function singlePagePdf(): Buffer {
  const content = '0 0 0 rg 20 20 200 120 re f';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 160] /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(out));
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(out);
}

const isPdfJsRequest = (url: string) => /pdfjs|pdf\.worker|pdf\.mjs/i.test(url);

// Playwright runs the most recently added route first, and the traffic guard lets local requests straight through, so the
// guard has to be added before a test mocks the CV request. The other way round, the mock never sees it.
async function mockCv(page: Page, body: Buffer) {
  await blockNonLocalTraffic(page);
  await page.route('**/api/riders/me/cv', (route) => route.fulfill({ status: 200, contentType: 'application/pdf', body }));
}

async function openRiderDetails(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'My details' }).first().click();
  await expect(page.getByRole('button', { name: 'View my CV' })).toBeVisible();
}

test.describe('rider CV preview', () => {
  test.use({ storageState: AUTH.rider });

  test('loads pdf.js only when a CV is opened, then draws the page', async ({ page }) => {
    await mockCv(page, singlePagePdf());
    const pdfJsRequests: string[] = [];
    page.on('request', (request) => { if (isPdfJsRequest(request.url())) pdfJsRequests.push(request.url()); });

    await openRiderDetails(page);
    // The point of loading it lazily: opening the rider screens costs no pdf.js download.
    expect(pdfJsRequests, 'pdf.js must not load with the rider dashboard').toEqual([]);

    await page.getByRole('button', { name: 'View my CV' }).click();
    const preview = page.getByRole('dialog', { name: 'My CV' });
    await expect(preview).toBeVisible();
    await expect.poll(() => pdfJsRequests.length, { message: 'pdf.js should load once the CV is opened' }).toBeGreaterThan(0);

    const canvas = preview.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.evaluate((node: HTMLCanvasElement) => {
      const context = node.getContext('2d');
      if (!context || !node.width || !node.height) return false;
      const { data } = context.getImageData(Math.floor(node.width / 2), Math.floor(node.height / 2), 1, 1);
      return data[3] > 0 && data[0] < 60 && data[1] < 60 && data[2] < 60;
    }), { message: 'the page should be drawn: dark pixels at the centre', timeout: 20_000 }).toBe(true);

    await expect(preview.getByRole('button', { name: 'Previous CV page' })).toBeDisabled();
    await expect(preview.getByRole('button', { name: 'Next CV page' })).toBeDisabled();

    await page.keyboard.press('Escape');
    await expect(preview).toBeHidden();
  });

  test('says so when the file is not a readable PDF', async ({ page }) => {
    await mockCv(page, Buffer.from('this is not a pdf'));
    await openRiderDetails(page);
    await page.getByRole('button', { name: 'View my CV' }).click();
    await expect(page.getByRole('dialog', { name: 'My CV' }).getByRole('alert')).toHaveText('Could not render this CV.', { timeout: 20_000 });
  });
});

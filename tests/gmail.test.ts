import { describe, it, expect } from 'vitest';
import { toGmailHtml, findEmbeddedImages, GMAIL_CLIP_BYTES } from '../src/export/gmail.js';
import { render, sampleValues, getTemplate, TEMPLATES } from '../src/library/index.js';

const sample = () => {
  const template = getTemplate('news-monthly')!;
  return render(template, sampleValues(template), {
    footer: 'Example Health, 123 Example St, Portland OR 97201',
    unsubscribeUrl: 'https://example.com/unsubscribe',
  }).html;
};

describe('toGmailHtml', () => {
  it('removes the document wrapper Gmail discards anyway', () => {
    const { html } = toGmailHtml(sample());
    expect(html).not.toMatch(/<!DOCTYPE/i);
    expect(html).not.toMatch(/<html/i);
    expect(html).not.toMatch(/<head/i);
    expect(html).not.toMatch(/<body/i);
    expect(html).not.toMatch(/<meta/i);
    expect(html).not.toMatch(/<title>/i);
  });

  it('drops the style block and says what that costs', () => {
    const { html, notes } = toGmailHtml(sample());
    expect(html).not.toContain('<style>');
    expect(notes.join(' ')).toMatch(/mobile/i);
  });

  it('drops the webfont link and explains the fallback', () => {
    const { html, notes } = toGmailHtml(sample());
    expect(html).not.toContain('fonts.googleapis.com');
    expect(notes.join(' ')).toMatch(/fonts/i);
  });

  it('removes Outlook conditional comments', () => {
    const { html } = toGmailHtml(sample());
    expect(html).not.toContain('<!--[if');
  });

  it('removes the preheader, which does nothing in a hand-composed message', () => {
    const { html, notes } = toGmailHtml(sample());
    expect(html).not.toMatch(/display:none/);
    expect(notes.join(' ')).toMatch(/preheader/i);
  });

  it('keeps the preheader when explicitly asked', () => {
    const { html } = toGmailHtml(sample(), { keepPreheader: true });
    expect(html).toMatch(/display:none/);
  });

  it('keeps the content that actually matters', () => {
    const { html } = toGmailHtml(sample());
    expect(html).toContain('<table');
    expect(html).toContain('style="');
    expect(html).toContain('123 Example St');
    expect(html).toContain('https://example.com/unsubscribe');
  });

  it('strips the author-facing subject comment', () => {
    expect(toGmailHtml(sample()).html).not.toContain('SUBJECT LINE:');
  });

  it('reports the byte size and whether Gmail will clip', () => {
    const result = toGmailHtml(sample());
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.bytes).toBeLessThan(GMAIL_CLIP_BYTES);
    expect(result.willClip).toBe(false);
    expect(result.notes.some((n) => n.includes('View entire message'))).toBe(false);
  });

  it('warns when the message is past the clipping limit', () => {
    const bloated = sample().replace('</body>', '<p>' + 'x'.repeat(GMAIL_CLIP_BYTES) + '</p></body>');
    const result = toGmailHtml(bloated);
    expect(result.willClip).toBe(true);
    expect(result.notes.join(' ')).toContain('View entire message');
  });

  it('is smaller than the full document it came from', () => {
    const full = sample();
    expect(toGmailHtml(full).bytes).toBeLessThan(Buffer.byteLength(full, 'utf8'));
  });

  it('handles every shipped template without throwing or emptying', () => {
    for (const template of TEMPLATES) {
      const { html: full } = render(template, sampleValues(template));
      const result = toGmailHtml(full);
      expect(result.html.length, `${template.id} produced nothing`).toBeGreaterThan(200);
      expect(result.html, `${template.id} kept a wrapper`).not.toMatch(/<html/i);
    }
  });
});

describe('findEmbeddedImages', () => {
  it('finds data URIs and estimates their decoded size', () => {
    const payload = 'A'.repeat(400);
    const found = findEmbeddedImages(`<img src="data:image/png;base64,${payload}">`);
    expect(found).toHaveLength(1);
    expect(found[0].mime).toBe('image/png');
    expect(found[0].bytes).toBe(300); // base64 is ~4/3 of the source bytes
  });

  it('finds nothing when images are hosted', () => {
    expect(findEmbeddedImages('<img src="https://example.com/logo.png">')).toEqual([]);
  });
});

/**
 * GENERATED FILE - do not edit by hand.
 * Extracted verbatim from dispatch_email_studio.html by scripts/extract-engine.mjs
 *
 * The one deliberate change from the original: the module-scope state object `S`
 * was mutated directly by the UI. Here it is encapsulated behind setState/getState
 * so the engine is callable without a DOM. Everything else is byte-identical.
 */

module.exports = (function () {
  "use strict";
/* ==================== themes ==================== */
  // Each theme is a bundle of rendering switches, so the layouts stay genuinely
  // different without six separate renderers to keep in sync.
  var THEMES = {
    signal: {
      name: 'Signal', desc: 'Centered, classic, safe everywhere',
      header: 'centered', align: 'center', label: 'caps', card: 'tinted',
      titleRule: true, headerBand: false
    },
    beacon: {
      name: 'Beacon', desc: 'Solid color masthead, reversed type',
      header: 'band', align: 'center', label: 'caps', card: 'tinted',
      titleRule: false, headerBand: true
    },
    ledger: {
      name: 'Ledger', desc: 'Editorial, left aligned, airy',
      header: 'left', align: 'left', label: 'rule', card: 'outlined',
      titleRule: true, headerBand: false
    },
    stack: {
      name: 'Stack', desc: 'Each section on its own card',
      header: 'centered', align: 'left', label: 'caps', card: 'elevated',
      titleRule: false, headerBand: false, sectionCards: true
    },
    pulse: {
      name: 'Pulse', desc: 'High contrast section bars',
      header: 'band', align: 'left', label: 'bar', card: 'tinted',
      titleRule: false, headerBand: true
    },
    plain: {
      name: 'Plain', desc: 'Minimal chrome, text forward',
      header: 'minimal', align: 'left', label: 'plain', card: 'plain',
      titleRule: false, headerBand: false
    }
  };

  var PALETTES = {
    ocean:    { name:'Ocean',    primary:'#022D41', accent:'#88BDBC', tint:'#F2F8F7', line:'#CBE2DF', ink:'#12303C', page:'#EDF3F3' },
    midnight: { name:'Midnight', primary:'#131C34', accent:'#6366F1', tint:'#F3F4FD', line:'#DDE0F6', ink:'#1E2438', page:'#EEF0F7' },
    forest:   { name:'Forest',   primary:'#14332B', accent:'#5FAE8C', tint:'#F1F8F4', line:'#CFE7DB', ink:'#17332C', page:'#EDF3EF' },
    plum:     { name:'Plum',     primary:'#3A2244', accent:'#B47ACB', tint:'#F9F3FB', line:'#E7D6EE', ink:'#33263A', page:'#F2ECF4' },
    ember:    { name:'Ember',    primary:'#3A1F1A', accent:'#DD7C5C', tint:'#FDF4F0', line:'#F3D8CC', ink:'#3A2621', page:'#F7EFEB' },
    graphite: { name:'Graphite', primary:'#1F2933', accent:'#7B8794', tint:'#F5F7FA', line:'#E1E5EA', ink:'#22303C', page:'#EFF1F4' }
  };

  /* ==================== state ==================== */
  var S = {
    theme: 'signal', palette: 'ocean',
    name: 'UpWell Psychiatry', logo: '', logoWidth: '120',
    logoPlacement: 'header', bannerStyle: 'template', bannerSubtitle: '',
    primary: '#022D41', accent: '#88BDBC', tint: '#F2F8F7',
    line: '#CBE2DF', ink: '#12303C', page: '#EDF3F3',
    headFont: "'Raleway',Helvetica,Arial,sans-serif", headWeb: 'Raleway',
    bodyFont: "'Raleway',Helvetica,Arial,sans-serif", bodyWeb: 'Raleway',
    fsBody: 15, fsTitle: 26,
    width: 600, radius: 10, btnRadius: 6, bars: 'both',
    preheader: '', footer: '', unsub: ''
  };

  var MUTED = '#7C8B95';

  /* ==================== starters ==================== */
  var STARTERS = {
    thanks: [
      'Subject: Referral Received — Thank You for Trusting Us',
      '~ Referral Received', '# Thank You for Trusting Us', '',
      'Hi there,', '',
      'Thank you for referring your patient to us — we\u2019re honored that you trust us with their care, and we want you to know we\u2019re on it.',
      '', '## What happens next', '',
      'Our team will begin outreach right away via both email and phone, making **up to three attempts** to connect.', '',
      '1. We were able to get them scheduled',
      '2. We were unable to connect after our attempts',
      '3. They declined our services', '',
      '> **On provider matching** — we\u2019ll do everything we can to place them with your preferred provider. If that provider has an extensive wait, we\u2019ll offer another who is equally trained in that area.',
      '', '[Button: Start another referral | https://example.com/refer]', '',
      '@ The Care Team | Referral Coordination | referrals@example.com'
    ].join('\n'),

    recap: [
      'Subject: Lunch & Learn Recap — ADHD in Women',
      '~ Lunch & Learn Recap', '# ADHD in Women', '### Hannah Asher, ADHD Coach', '',
      'Hi team,', '',
      'Thanks for a full and lively hour. Here\u2019s the short version, plus what needs your eyes before next month.',
      '', '## Quick updates', '',
      '| Billing | Use CPT 96127 x 2 for GAD-7 and PHQ-9, reported per instrument',
      '| Screeners | Adult ADHD, pregnancy, PTSD, and OCD now in intake',
      '| Signatures | Builder demoed — files in the follow-up email',
      '', '## Key takeaways', '',
      '- Think **attention dysregulation, not deficit** — the trouble is directing attention, not lacking it.',
      '- It is neurodevelopmental and lifelong, not something patients develop or outgrow.',
      '- Masking and caregiving expectations hide it; it gets labeled anxiety or depression.',
      '',
      '> **From the group:** our screening tools were built around hyperactive presentations, so nuanced interviewing matters more.',
      '', '## Follow-ups', '',
      '+ Start billing 96127 for screener administration',
      '+ Review intake questionnaires when completed',
      '+ Sign up for a future session', '',
      '@ Mary Ortega | Patient Care Coordinator | mary@example.com'
    ].join('\n'),

    newsletter: [
      'Subject: What we shipped in March',
      '~ Monthly Roundup', '# Three things worth your time', '',
      'Hi there,', '',
      'A short read on what changed this month and what it means for your team.',
      '', '## By the numbers', '',
      '[Stat: 42% | Faster onboarding]',
      '[Stat: 1,280 | New teams]',
      '[Stat: 99.9% | Uptime]',
      '', '## Highlights', '',
      '- **Faster search** across every workspace, now under 200ms.',
      '- **Shared templates** so your team stops rebuilding the same doc.',
      '- **Audit logs** available on every plan, not just Enterprise.',
      '', '[Button: Read the full changelog | https://example.com/changelog]', '',
      '---', '',
      'As always, reply to this email if something is not working. A person reads it.'
    ].join('\n'),

    announce: [
      'Subject: We\u2019re expanding to Washington',
      '~ Announcement', '# We\u2019re expanding to Washington', '',
      'Starting April 1, we\u2019re accepting new patients across Washington in addition to Oregon.',
      '', '## What this means', '',
      '| Coverage | Oregon and Washington',
      '| Wait time | Under two weeks for most new patients',
      '| Care model | Telehealth, from home',
      '',
      '> Existing patients are unaffected. Your provider, schedule, and billing stay exactly the same.',
      '', '[Button: Refer a patient | https://example.com/refer]'
    ].join('\n'),

    update: [
      'Subject: Version 4.0 is here',
      '~ Product Update', '# Version 4.0', '### Faster, quieter, and finally offline',
      '', 'Here is everything in this release.', '',
      '## New', '',
      '+ Offline mode that syncs when you reconnect',
      '+ Keyboard-first command palette',
      '+ Bulk actions across every list view',
      '', '## Fixed', '',
      '- Exports no longer time out on large workspaces.',
      '- Notification digests respect your timezone.',
      '', '[Button: See the release notes | https://example.com/releases]'
    ].join('\n'),

    welcome: [
      'Subject: Welcome to {{practice_name}}',
      '~ A calm start', '# Welcome to your next step', '',
      'Hi there,', '',
      'We are glad you are here. This note gives you the few details that make getting started feel straightforward.',
      '', '## Before your first visit', '',
      '+ Complete the intake forms before {{appointment_date}}',
      '+ Bring a current medication list and any questions you want to discuss',
      '+ Contact our team through {{secure_channel}} if you need help',
      '', '[Button: Complete your forms | https://example.com/forms]', '',
      '> Your information is handled with care. Please use the secure channel for patient-specific questions.', '',
      '@ The Care Team | Patient Care | hello@example.com'
    ].join('\n'),

    careplan: [
      'Subject: Following up on our visit',
      '~ Care follow-up', '# Your next steps', '',
      'Hi {{patient_name}},', '',
      'Thank you for the thoughtful conversation at your visit. Here is a short summary of what we agreed to carry forward.',
      '', '## Your plan', '',
      '| Focus | {{care_focus}}',
      '| This week | {{this_week}}',
      '| Next check-in | {{next_checkin}}',
      '',
      '> If something feels unclear or changes before your next visit, please reach out through the secure patient portal.', '',
      '[Button: Open your care plan | https://example.com/portal]', '',
      '@ The Care Team | Patient Care | hello@example.com'
    ].join('\n'),

    event: [
      'Subject: You’re invited: {{event_name}}',
      '~ Save your seat', '# A useful hour with the care team', '',
      'We are hosting {{event_name}} for patients and families who want practical, approachable guidance on {{event_topic}}.',
      '', '## Details', '',
      '| When | {{event_date}}',
      '| Where | {{event_location}}',
      '| Format | {{event_format}}',
      '',
      'Bring your questions. We will leave time for an open conversation at the end.', '',
      '[Button: Reserve your spot | https://example.com/events]', '',
      '@ The Care Team | Community Programs | hello@example.com'
    ].join('\n'),

    hours: [
      'Subject: Practice hours and coverage update',
      '~ A scheduling note', '# Here when you need us', '',
      'A quick update so you know when our team is available over {{date_range}}.',
      '', '## At a glance', '',
      '| Office hours | {{office_hours}}',
      '| Phone coverage | {{phone_coverage}}',
      '| Secure messages | {{message_timing}}',
      '',
      '> For urgent concerns, use your established care instructions or local emergency services. This inbox is not monitored continuously.', '',
      'Thank you for planning with us.', '',
      '@ The Care Team | {{practice_name}} | hello@example.com'
    ].join('\n')
  };

  /* ==================== inline formatting ==================== */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function inline(s) {
    var out = esc(s);
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, t, u) {
      var href = u.trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(href)) { href = 'mailto:' + href; }
      return '<a href="' + href + '" style="color:' + S.primary + '; font-weight:600;">' + t + '</a>';
    });
    out = out.replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.]{2,})/g, function (m, p, mail) {
      return p + '<a href="mailto:' + mail + '" style="color:' + S.primary + ';">' + mail + '</a>';
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:' + S.primary + ';">$1</strong>');
    return out;
  }

  function stripInline(s) {
    return String(s)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/\*\*([^*]+)\*\*/g, '$1');
  }

  /* ==================== parser ==================== */
  function parse(text) {
    var lines = String(text).replace(/\r\n/g, '\n').split('\n');
    var blocks = [], subject = '', i = 0;

    function group(type, re, strip) {
      var items = [];
      while (i < lines.length && re.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(strip, ''));
        i++;
      }
      blocks.push({ type: type, items: items });
    }

    while (i < lines.length) {
      var line = lines[i].trim();
      if (!line) { i++; continue; }

      if (/^subject\s*:/i.test(line)) { subject = line.replace(/^subject\s*:/i, '').trim(); i++; continue; }
      if (line === '---' || line === '***') { blocks.push({ type: 'divider' }); i++; continue; }
      if (line.indexOf('~ ') === 0) { blocks.push({ type: 'eyebrow', text: line.slice(2).trim() }); i++; continue; }
      if (line.indexOf('### ') === 0) { blocks.push({ type: 'sub', text: line.slice(4).trim() }); i++; continue; }
      if (line.indexOf('## ') === 0) { blocks.push({ type: 'h2', text: line.slice(3).trim() }); i++; continue; }
      if (line.indexOf('# ') === 0) { blocks.push({ type: 'h1', text: line.slice(2).trim() }); i++; continue; }
      if (line.indexOf('> ') === 0) { blocks.push({ type: 'callout', text: line.slice(2).trim() }); i++; continue; }
      if (line.indexOf('@ ') === 0) {
        blocks.push({ type: 'sign', parts: line.slice(2).split('|').map(function (x) { return x.trim(); }) });
        i++; continue;
      }

      var btn = line.match(/^\[Button:\s*([^|\]]+)\|\s*([^\]]+)\]$/i);
      if (btn) { blocks.push({ type: 'button', text: btn[1].trim(), url: btn[2].trim() }); i++; continue; }

      var img = /^\[Image:\s*([^\]]*)\]$/i.exec(line);
      if (img && img[1].trim()) {
        var ip = img[1].split('|').map(function (x) { return x.trim(); });
        var imgBlock = { type: 'image', url: ip[0], alt: ip[1] || '' };
        if (ip[2]) { imgBlock.caption = ip[2]; }
        blocks.push(imgBlock);
        i++; continue;
      }

      var gb = /^\[Gallery:\s*([^\]]*)\]$/i.exec(line);
      if (gb && gb[1].trim()) {
        var gp = gb[1].split('|').map(function (x) { return x.trim(); });
        var layout = /^(single|two|three)$/i.test(gp[0]) ? gp.shift().toLowerCase() : 'single';
        var galleryItems = [];
        for (var gi = 0; gi < gp.length; gi += 3) {
          if (!gp[gi]) { continue; }
          galleryItems.push({ url: gp[gi], alt: gp[gi + 1] || '', caption: gp[gi + 2] || '' });
        }
        if (galleryItems.length) { blocks.push({ type: 'gallery', layout: layout, items: galleryItems }); }
        i++; continue;
      }

      var qb = /^\[Quote:\s*([^\]]*)\]$/i.exec(line);
      if (qb && qb[1].trim()) {
        var qp = qb[1].split('|');
        blocks.push({ type: 'quote', text: qp[0].trim(), name: (qp[1] || '').trim() });
        i++; continue;
      }

      var fb = /^\[Feature:\s*([^\]]*)\]$/i.exec(line);
      if (fb && fb[1].trim()) {
        var fp = fb[1].split('|');
        blocks.push({ type: 'feature', url: fp[0].trim(), alt: (fp[1] || '').trim(), heading: (fp[2] || '').trim(), body: fp.slice(3).join('|').trim() });
        i++; continue;
      }

      if (/^\[Stat:/i.test(line)) {
        var stats = [];
        while (i < lines.length) {
          var m = lines[i].trim().match(/^\[Stat:\s*([^|\]]+)(?:\|\s*([^\]]*))?\]$/i);
          if (!m) { break; }
          stats.push({ value: m[1].trim(), label: (m[2] || '').trim() });
          i++;
        }
        blocks.push({ type: 'stats', items: stats });
        continue;
      }

      if (/^[-*]\s+/.test(line)) { group('ul', /^[-*]\s+/, /^[-*]\s+/); continue; }
      if (/^\d+[.)]\s+/.test(line)) { group('ol', /^\d+[.)]\s+/, /^\d+[.)]\s+/); continue; }
      if (/^\+\s+/.test(line)) { group('card', /^\+\s+/, /^\+\s+/); continue; }

      if (line.indexOf('|') === 0) {
        var rows = [];
        while (i < lines.length && lines[i].trim().indexOf('|') === 0) {
          var p = lines[i].trim().replace(/^\|/, '').split('|');
          rows.push({ label: (p[0] || '').trim(), value: p.slice(1).join('|').trim() });
          i++;
        }
        blocks.push({ type: 'table', rows: rows });
        continue;
      }

      var para = [];
      while (i < lines.length) {
        var l = lines[i].trim();
        if (!l || /^(~ |#|> |\+\s|\||@ |\d+[.)]\s|[-*]\s|---|\*\*\*|\[Button:|\[Image:|\[Gallery:|\[Quote:|\[Feature:|\[Stat:|subject\s*:)/i.test(l)) { break; }
        para.push(l); i++;
      }
      if (para.length) { blocks.push({ type: 'p', lines: para }); }
    }
    return { subject: subject, blocks: blocks };
  }

  /* ==================== email rendering ==================== */
  function row(inner, padTop, padBottom) {
    return '    <tr>\n      <td class="pad" style="padding:' + (padTop || '0') + ' 32px ' +
      (padBottom || '0') + ' 32px;">\n' + inner + '\n      </td>\n    </tr>\n';
  }
  function gap(px) { return '    <tr><td style="height:' + px + 'px; line-height:' + px + 'px; font-size:' + px + 'px;">&nbsp;</td></tr>\n'; }

  function sectionLabel(text, T) {
    var HF = S.headFont;
    if (T.label === 'bar') {
      return row('        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + S.primary + '; border-radius:' + S.radius + 'px;"><tr>' +
        '<td width="5" style="width:5px; background-color:' + S.accent + ';">&nbsp;</td>' +
        '<td style="padding:10px 15px; font-family:' + HF + '; font-size:11px; letter-spacing:.14em; text-transform:uppercase; font-weight:700; color:#FFFFFF;">' + inline(text) + '</td>' +
        '</tr></table>', '18px', '10px');
    }
    if (T.label === 'rule') {
      return row('        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
        '<td width="10" valign="middle" style="width:10px; padding-bottom:8px;"><div style="width:6px; height:6px; background-color:' + S.accent + '; border-radius:50%;">&nbsp;</div></td>' +
        '<td style="border-bottom:1px solid ' + S.line + '; padding-bottom:8px; font-family:' + HF + '; font-size:12px; letter-spacing:.1em; text-transform:uppercase; font-weight:700; color:' + S.primary + ';">' + inline(text) + '</td>' +
        '</tr></table>', '20px', '12px');
    }
    if (T.label === 'plain') {
      return row('        <p style="margin:0; font-family:' + HF + '; font-size:14px; font-weight:700; color:' + S.primary + ';">' + inline(text) + '</p>', '18px', '8px');
    }
    return row('        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="18" style="width:18px; padding-right:8px;"><div style="height:2px; background-color:' + S.accent + ';">&nbsp;</div></td><td style="font-family:' + HF + '; font-size:10px; letter-spacing:.16em; text-transform:uppercase; font-weight:700; color:' + MUTED + ';">' + inline(text) + '</td></tr></table>', '18px', '9px');
  }

  function cardWrap(inner, T) {
    if (T.card === 'plain') { return inner; }
    var style = 'border-radius:' + S.radius + 'px;';
    if (T.card === 'tinted') { style += ' background-color:' + S.tint + '; border:1px solid ' + S.line + '; border-left:4px solid ' + S.accent + ';'; }
    if (T.card === 'outlined') { style += ' background-color:#FFFFFF; border:1px solid ' + S.line + ';'; }
    if (T.card === 'elevated') { style += ' background-color:#FFFFFF; border:1px solid ' + S.line + ';'; }
    return '        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="' + style + '">\n' +
      '          <tr><td style="padding:19px 20px;">\n' + inner + '\n          </td></tr>\n        </table>';
  }

  function usesHeaderBanner(T) {
    return S.bannerStyle !== 'clean' && (S.bannerStyle === 'solid' || S.bannerStyle === 'soft' || T.headerBand);
  }

  function renderBlocks(blocks, T) {
    var out = '', HF = S.headFont, BF = S.bodyFont, A = S.accent, P = S.primary,
        I = S.ink, L = S.line, fs = S.fsBody, lh = Math.round(S.fsBody * 1.66);

    var feat = 0;
    blocks.forEach(function (b) {
      if (b.type === 'eyebrow') {
        if (usesHeaderBanner(T)) { return; }   // the banner already carries the eyebrow
        out += '    <tr>\n      <td class="pad" align="' + T.align + '" style="padding:0 32px 2px 32px;">\n' +
          '        <p style="margin:0; font-family:' + HF + '; font-size:11px; letter-spacing:.22em; text-transform:uppercase; font-weight:700; color:' + A + ';">' + inline(b.text) + '</p>\n      </td>\n    </tr>\n';

      } else if (b.type === 'h1') {
        if (usesHeaderBanner(T)) { return; }
        out += '    <tr>\n      <td class="pad" align="' + T.align + '" style="padding:6px 32px 0 32px;">\n' +
          '        <h1 class="title" style="margin:0; font-family:' + HF + '; font-size:' + S.fsTitle + 'px; line-height:' + Math.round(S.fsTitle * 1.28) + 'px; font-weight:700; color:' + P + ';">' + inline(b.text) + '</h1>\n      </td>\n    </tr>\n';
        if (T.titleRule) {
          out += row('        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:2px solid ' + L + '; height:1px; line-height:1px; font-size:1px;">&nbsp;</td></tr></table>', '16px', '0');
        }
        out += gap(14);

      } else if (b.type === 'sub') {
        if (usesHeaderBanner(T)) { return; }
        out += '    <tr>\n      <td class="pad" align="' + T.align + '" style="padding:2px 32px 10px 32px;">\n' +
          '        <p style="margin:0; font-family:' + BF + '; font-size:13px; line-height:20px; font-style:italic; color:' + MUTED + ';">' + inline(b.text) + '</p>\n      </td>\n    </tr>\n';

      } else if (b.type === 'h2') {
        out += sectionLabel(b.text, T);

      } else if (b.type === 'p') {
        out += row('        <p style="margin:0; font-family:' + BF + '; font-size:' + fs + 'px; line-height:' + lh + 'px; color:' + I + ';">' +
          b.lines.map(inline).join('<br>') + '</p>', '0', '14px');

      } else if (b.type === 'divider') {
        out += row('        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ' + L + '; height:1px; line-height:1px; font-size:1px;">&nbsp;</td></tr></table>', '6px', '18px');

      } else if (b.type === 'ul' || b.type === 'card') {
        var rows = '';
        b.items.forEach(function (it, n) {
          var pb = n === b.items.length - 1 ? '0' : '9px';
          var bullet = b.type === 'card' ? '&#10003;' : '&bull;';
          rows += '            <tr>\n' +
            '              <td width="22" valign="top" style="width:22px; font-family:' + BF + '; font-size:' + (b.type === 'card' ? '14' : '18') + 'px; line-height:' + lh + 'px; color:' + A + ';">' + bullet + '</td>\n' +
            '              <td valign="top" style="font-family:' + BF + '; font-size:' + fs + 'px; line-height:' + lh + 'px; color:' + I + '; padding-bottom:' + pb + ';">' + inline(it) + '</td>\n' +
            '            </tr>\n';
        });
        var tbl = '        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">\n' + rows + '        </table>';
        out += row(b.type === 'card' ? cardWrap(tbl, T) : tbl, '0', '16px');

      } else if (b.type === 'ol') {
        var orows = '';
        b.items.forEach(function (it, n) {
          var pb = n === b.items.length - 1 ? '0' : '11px';
          orows += '            <tr>\n' +
            '              <td width="34" valign="top" style="width:34px;">\n' +
            '                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="24" style="width:24px;"><tr><td align="center" height="24" style="width:24px; height:24px; background-color:' + A + '; border-radius:12px; font-family:' + HF + '; font-size:12px; line-height:24px; font-weight:700; color:' + P + ';">' + (n + 1) + '</td></tr></table>\n' +
            '              </td>\n' +
            '              <td valign="top" style="font-family:' + BF + '; font-size:' + fs + 'px; line-height:' + lh + 'px; color:' + I + '; padding-bottom:' + pb + ';">' + inline(it) + '</td>\n' +
            '            </tr>\n';
        });
        out += row('        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">\n' + orows + '        </table>', '0', '16px');

      } else if (b.type === 'stats') {
        var n = b.items.length || 1;
        var w = Math.floor(100 / n);
        var cells = '';
        b.items.forEach(function (st) {
          cells += '            <td class="stack" width="' + w + '%" valign="top" align="center" style="width:' + w + '%; padding:16px 8px; background-color:' + S.tint + '; border:1px solid ' + L + '; border-radius:' + S.radius + 'px;">\n' +
            '              <p style="margin:0; font-family:' + HF + '; font-size:27px; line-height:32px; font-weight:700; letter-spacing:-.02em; color:' + P + ';">' + esc(st.value) + '</p>\n' +
            '              <p style="margin:2px 0 0 0; font-family:' + BF + '; font-size:12px; line-height:17px; color:' + MUTED + ';">' + esc(st.label) + '</p>\n' +
            '            </td>\n';
          cells += '            <td class="stack" width="10" style="width:10px; font-size:1px; line-height:1px;">&nbsp;</td>\n';
        });
        out += row('        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">\n          <tr>\n' + cells + '          </tr>\n        </table>', '0', '16px');

      } else if (b.type === 'table') {
        var trs = '';
        b.rows.forEach(function (r, n2) {
          var bg = n2 % 2 === 0 ? '#FFFFFF' : S.tint;
          trs += '          <tr>\n' +
            '            <td class="stack" width="32%" valign="top" style="width:32%; background-color:' + S.tint + '; padding:12px 14px; font-family:' + HF + '; font-size:10px; line-height:17px; letter-spacing:.1em; text-transform:uppercase; font-weight:700; color:' + P + '; border-bottom:1px solid ' + L + ';">' + inline(r.label) + '</td>\n' +
            '            <td class="stack" valign="top" style="background-color:' + (n2 % 2 === 0 ? '#FFFFFF' : S.tint) + '; padding:12px 14px; font-family:' + BF + '; font-size:14px; line-height:21px; color:' + I + '; border-bottom:1px solid ' + L + ';">' + inline(r.value) + '</td>\n' +
            '          </tr>\n';
        });
        out += row('        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + L + '; border-radius:6px; overflow:hidden;">\n' + trs + '        </table>', '0', '16px');

      } else if (b.type === 'callout') {
        out += row('        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + S.tint + '; border:1px solid ' + L + '; border-radius:' + S.radius + 'px;"><tr>\n' +
          '          <td style="border-left:3px solid ' + A + '; padding:13px 16px; font-family:' + BF + '; font-size:' + fs + 'px; line-height:' + lh + 'px; color:' + I + ';">' + inline(b.text) + '</td>\n' +
          '        </tr></table>', '0', '18px');

      } else if (b.type === 'button') {
        // Windows Outlook renders with Word, not a browser: it drops padding on
        // inline-block anchors (the button collapses to a bare link) and cannot
        // round the td. The VML roundrect inside the mso conditional is what
        // Outlook actually renders; everything else sees the normal anchor.
        var btnH = 44;
        var arcsize = Math.min(50, Math.round((S.btnRadius * 2) / btnH * 100));
        // Word needs a pixel width; the anchor's is set by its text, so measure
        // the same way — about 8px per bold 14px character plus the 26px of
        // horizontal padding on each side, clamped to sane ends.
        var btnW = Math.max(120, Math.min(520, b.text.length * 8 + 52));
        var vmlButton =
          '            <!--[if mso]>\n' +
          '              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="' + b.url + '" style="height:' + btnH + 'px;v-text-anchor:middle;width:' + btnW + 'px;" arcsize="' + arcsize + '%" strokecolor="' + P + '" fillcolor="' + P + '">\n' +
          '                <w:anchorlock/>\n' +
          '                <center style="color:#FFFFFF;font-family:' + HF + ';font-size:14px;font-weight:700;">' + esc(b.text) + '</center>\n' +
          '              </v:roundrect>\n' +
          '            <![endif]-->\n' +
          '            <!--[if !mso]><!-->\n' +
          '              <a href="' + b.url + '" style="display:inline-block; padding:13px 26px; background-color:' + P + '; font-family:' + HF + '; font-size:14px; line-height:18px; letter-spacing:.01em; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:' + S.btnRadius + 'px;">' + esc(b.text) + '</a>\n' +
          '            <!--<![endif]-->';
        out += row('        <table role="presentation" cellpadding="0" cellspacing="0" border="0"' + (T.align === 'center' ? ' align="center"' : '') + '><tr>\n' +
          '          <td align="center" bgcolor="' + P + '" style="border-radius:' + S.btnRadius + 'px;">\n' +
          vmlButton + '\n' +
          '          </td>\n        </tr></table>', '2px', '20px');

      } else if (b.type === 'image') {
        var im = '        <img src="' + b.url + '" alt="' + esc(b.alt) + '" width="' + (S.width - 64) + '" style="display:block; width:100%; max-width:' + (S.width - 64) + 'px; height:auto; border-radius:' + S.radius + 'px; border:1px solid ' + L + ';">';
        if (b.caption) {
          im += '\n        <p style="margin:10px 8px 0 8px; font-family:' + BF + '; font-size:12px; line-height:18px; color:' + MUTED + '; text-align:center;">' + esc(b.caption) + '</p>';
        }
        out += row(im, '0', '18px');

      } else if (b.type === 'gallery') {
        var galleryCount = b.layout === 'three' ? 3 : b.layout === 'two' ? 2 : 1;
        var galleryWidth = Math.floor(100 / galleryCount);
        var galleryCells = '';
        b.items.slice(0, galleryCount).forEach(function (item, galleryIndex) {
          var imageWidth = Math.floor((S.width - 64 - (galleryCount - 1) * 12) / galleryCount);
          var galleryCell = '            <td class="stack" valign="top" width="' + galleryWidth + '%" style="width:' + galleryWidth + '%;">' +
            '<img src="' + item.url + '" alt="' + esc(item.alt) + '" width="' + imageWidth + '" style="display:block; width:100%; max-width:' + imageWidth + 'px; height:auto; border-radius:' + S.radius + 'px; border:1px solid ' + L + ';">' +
            (item.caption ? '<p style="margin:8px 4px 0 4px; font-family:' + BF + '; font-size:11px; line-height:16px; color:' + MUTED + '; text-align:center;">' + esc(item.caption) + '</p>' : '') +
            '</td>\n';
          galleryCells += galleryCell;
          if (galleryIndex < galleryCount - 1) galleryCells += '            <td width="12" style="width:12px; font-size:1px; line-height:1px;">&nbsp;</td>\n';
        });
        out += row('        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>\n' + galleryCells + '        </tr></table>', '0', '18px');

      } else if (b.type === 'quote') {
        // A tinted social-proof card: big serif mark, italic pull line, name.
        var qInner = '<p style="margin:0; font-family:Georgia,\'Times New Roman\',serif; font-size:38px; line-height:12px; font-weight:700; color:' + A + ';">&ldquo;</p>' +
          '<p style="margin:12px 0 0 0; font-family:' + BF + '; font-size:' + fs + 'px; line-height:' + lh + 'px; font-style:italic; color:' + I + ';">' + inline(b.text) + '</p>' +
          (b.name ? '<p style="margin:14px 0 0 0; font-family:' + HF + '; font-size:10px; letter-spacing:.14em; text-transform:uppercase; font-weight:700; color:' + P + ';">&mdash; ' + esc(b.name) + '</p>' : '');
        out += row(cardWrap(qInner, T), '0', '16px');

      } else if (b.type === 'feature') {
        // Photo beside text, alternating sides like an editorial zig-zag.
        var flip = feat % 2 === 1; feat++;
        var wImg2 = Math.round((S.width - 96) * 0.46);
        var fImg = '<td class="stack" valign="middle" width="46%" style="width:46%; ' + (flip ? 'padding-left:20px;' : 'padding-right:20px;') + '">' +
          '<img src="' + b.url + '" alt="' + esc(b.alt) + '" width="' + wImg2 + '" style="display:block; width:100%; max-width:' + wImg2 + 'px; height:auto; border-radius:' + S.radius + 'px;">' +
          '</td>';
        var fTxt = '<td class="stack" valign="middle" width="54%" style="width:54%;">' +
          '<p style="margin:0; font-family:' + HF + '; font-size:17px; line-height:23px; font-weight:700; color:' + P + ';">' + inline(b.heading || b.alt || '') + '</p>' +
          '<p style="margin:6px 0 0 0; font-family:' + BF + '; font-size:' + fs + 'px; line-height:' + lh + 'px; color:' + I + ';">' + inline(b.body || '') + '</p>' +
          '</td>';
        out += row('        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
          (flip ? fTxt + fImg : fImg + fTxt) + '</tr></table>', '0', '16px');

      } else if (b.type === 'sign') {
        var nm = b.parts[0] || '', role = b.parts[1] || '', contact = b.parts[2] || '';
        var sig = '        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ' + L + '; padding-top:16px;">' +
          '<p style="margin:0; font-family:' + HF + '; font-size:' + fs + 'px; line-height:' + lh + 'px; font-weight:700; color:' + P + ';">' + inline(nm) + '</p>';
        if (role) { sig += '\n        <p style="margin:0; font-family:' + BF + '; font-size:13px; line-height:20px; color:' + MUTED + ';">' + inline(role) + '</p>'; }
        if (contact) { sig += '\n        <p style="margin:3px 0 0 0; font-family:' + BF + '; font-size:13px; line-height:20px;">' + inline(contact) + '</p>'; }
        sig += '</td></tr></table>';
        out += row(sig, '8px', '20px');
      }
    });
    return out;
  }

  function headerBlock(parsed, T) {
    var HF = S.headFont, P = S.primary, A = S.accent;
    var eyebrow = '', title = '', subtitle = '';
    parsed.blocks.forEach(function (b) {
      if (b.type === 'eyebrow' && !eyebrow) { eyebrow = b.text; }
      if (b.type === 'h1' && !title) { title = b.text; }
      // A banner owns the supporting line. Moving the authored subhead into
      // the masthead keeps the first viewport cohesive instead of splitting
      // the title treatment from its context.
      if (b.type === 'sub' && !subtitle) { subtitle = b.text; }
    });

    var initial = esc((S.name || 'P').trim().charAt(0).toUpperCase());
    var banner = usesHeaderBanner(T);
    var softBanner = S.bannerStyle === 'soft';
    var lockupInk = banner ? (softBanner ? P : '#FFFFFF') : P;
    var lockupMuted = banner ? (softBanner ? MUTED : A) : MUTED;
    var lockupMark = banner ? A : P;
    var lockupMarkInk = banner ? P : '#FFFFFF';
    var lockup = '<table role="presentation" cellpadding="0" cellspacing="0" border="0"' + (T.header === 'left' || T.header === 'minimal' ? '' : ' align="center"') + '><tr>' +
      '<td width="34" height="34" align="center" valign="middle" style="width:34px; height:34px; background-color:' + lockupMark + '; border-radius:10px; font-family:Georgia,\'Times New Roman\',serif; font-size:18px; line-height:34px; font-weight:700; color:' + lockupMarkInk + ';">' + initial + '</td>' +
      '<td style="padding-left:10px;" align="left">' +
      '<p style="margin:0; font-family:' + HF + '; font-size:15px; line-height:18px; font-weight:700; color:' + lockupInk + ';">' + esc(S.name) + '</p>' +
      '<p style="margin:2px 0 0 0; font-family:' + S.bodyFont + '; font-size:9px; line-height:12px; letter-spacing:.16em; text-transform:uppercase; font-weight:700; color:' + lockupMuted + ';">Care, clearly coordinated</p>' +
      '</td></tr></table>';
    var logoImg = S.logo && S.logoPlacement === 'header'
      ? '<img src="' + S.logo + '" width="' + S.logoWidth + '" alt="' + esc(S.name) + '" style="display:block; width:' + S.logoWidth + 'px; max-width:100%; height:auto; margin:0' + (T.header === 'left' || T.header === 'minimal' ? '' : ' auto') + ';">'
      : lockup;

    var accentRule = '<table role="presentation" cellpadding="0" cellspacing="0" border="0"' + (T.align === 'left' ? '' : ' align="center"') + '><tr><td width="42" height="4" style="width:42px; height:4px; background-color:' + A + '; font-size:4px; line-height:4px;">&nbsp;</td></tr></table>';

    if (banner) {
      var bannerBg = softBanner ? S.tint : P;
      var bannerInk = softBanner ? P : '#FFFFFF';
      var bannerMuted = softBanner ? MUTED : A;
      return '    <tr>\n      <td class="pad" align="' + T.align + '" style="background-color:' + bannerBg + '; padding:30px 32px 34px 32px;">\n' +
        '        ' + logoImg + '\n' +
        '        ' + accentRule + '\n' +
        (eyebrow ? '        <p style="margin:16px 0 0 0; font-family:' + HF + '; font-size:10px; line-height:14px; letter-spacing:.2em; text-transform:uppercase; font-weight:700; color:' + bannerMuted + ';">' + inline(eyebrow) + '</p>\n' : '') +
        (title ? '        <h1 class="title" style="max-width:520px; margin:8px 0 0 0; font-family:' + HF + '; font-size:' + S.fsTitle + 'px; line-height:' + Math.round(S.fsTitle * 1.25) + 'px; font-weight:700; letter-spacing:-.02em; color:' + bannerInk + ';">' + inline(title) + '</h1>\n' : '') +
        (subtitle ? '        <p style="max-width:470px; margin:11px 0 0 0; font-family:' + S.bodyFont + '; font-size:13px; line-height:20px; color:' + bannerMuted + ';">' + inline(subtitle) + '</p>\n' : '') +
        '      </td>\n    </tr>\n';
    }
    if (T.header === 'minimal') {
      return '    <tr>\n      <td class="pad" align="left" style="padding:26px 32px 15px 32px; border-bottom:1px solid ' + S.line + ';">' + logoImg + '\n' + accentRule + '</td>\n    </tr>\n';
    }
    var al = T.header === 'left' ? 'left' : 'center';
    return '    <tr>\n      <td class="pad" align="' + al + '" style="padding:28px 32px 20px 32px; border-bottom:1px solid ' + S.line + ';">' + logoImg + '\n' + accentRule + '</td>\n    </tr>\n';
  }

  function placedLogoRow(T, placement) {
    if (!S.logo || S.logoPlacement !== placement) { return ''; }
    var al = placement === 'footer' ? 'center' : (T.align === 'left' ? 'left' : 'center');
    var img = '<img src="' + S.logo + '" width="' + S.logoWidth + '" alt="' + esc(S.name) + '" style="display:block; width:' + S.logoWidth + 'px; max-width:' + S.logoWidth + 'px; height:auto; margin:0' + (al === 'center' ? ' auto' : '') + ';">';
    var padding = placement === 'footer' ? '0 32px 10px 32px' : '0 32px 18px 32px';
    return '    <tr>\n      <td class="pad" align="' + al + '" style="padding:' + padding + ';">' + img + '</td>\n    </tr>\n';
  }

  function buildEmail(parsed) {
    var T = THEMES[S.theme], W = S.width, P = S.primary, A = S.accent;
    var fams = [];
    if (S.headWeb) { fams.push(S.headWeb + ':wght@400;600;700'); }
    if (S.bodyWeb && S.bodyWeb !== S.headWeb) { fams.push(S.bodyWeb + ':wght@400;600;700'); }
    var webfont = fams.length
      ? '<link href="https://fonts.googleapis.com/css2?family=' + fams.join('&family=') + '&display=swap" rel="stylesheet">\n'
      : '';

    var pre = S.preheader
      ? '<div style="display:none; font-size:1px; color:' + S.page + '; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">' +
        esc(S.preheader) + '&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>\n'
      : '';

    var footer = '';
    if (S.footer || S.unsub) {
      var f = esc(S.footer).split('\n').join('<br>');
      var u = S.unsub ? '<br><a href="' + S.unsub + '" style="color:' + MUTED + '; text-decoration:underline;">Unsubscribe</a>' : '';
      footer = '  <table role="presentation" class="wrap" width="' + W + '" cellpadding="0" cellspacing="0" border="0" style="width:' + W + 'px; max-width:' + W + 'px;">\n' +
        '    <tr><td class="pad" align="center" style="border-top:1px solid ' + S.line + '; padding:18px 32px 8px 32px; font-family:' + S.bodyFont + '; font-size:11px; line-height:18px; color:' + MUTED + ';">' + f + u + '</td></tr>\n  </table>\n';
    }

    var topBar = (S.bars === 'both' || S.bars === 'top')
      ? '    <tr><td style="background-color:' + A + '; height:5px; line-height:5px; font-size:5px;">&nbsp;</td></tr>\n' : '';
    var botBar = (S.bars === 'both')
      ? '    <tr><td style="background-color:' + P + '; height:3px; line-height:3px; font-size:3px;">&nbsp;</td></tr>\n' : '';

    return '<!DOCTYPE html>\n<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">\n' +
'<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'<meta name="x-apple-disable-message-reformatting">\n<meta name="color-scheme" content="light">\n' +
(parsed.subject ? '<!-- SUBJECT LINE: ' + parsed.subject + ' -->\n' : '') +
'<title>' + esc(parsed.subject || S.name) + '</title>\n' +
'<!--[if mso]>\n<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>\n<![endif]-->\n' +
webfont +
'<style>\n' +
'  body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }\n' +
'  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }\n' +
'  img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }\n' +
'  body { margin:0 !important; padding:0 !important; width:100% !important; }\n' +
'  a { color:' + P + '; }\n' +
'  @media screen and (max-width:' + (W + 20) + 'px) {\n' +
'    .wrap { width:100% !important; }\n' +
'    .pad  { padding-left:20px !important; padding-right:20px !important; }\n' +
'    .stack { display:block !important; width:100% !important; max-width:100% !important; }\n' +
'    h1.title { font-size:' + Math.max(20, S.fsTitle - 4) + 'px !important; }\n' +
'  }\n' +
'</style>\n</head>\n\n' +
'<body style="margin:0; padding:0; background-color:' + S.page + ';">\n\n' + pre +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + S.page + ';">\n<tr>\n<td align="center" style="padding:32px 12px;">\n\n' +
'  <table role="presentation" class="wrap" width="' + W + '" cellpadding="0" cellspacing="0" border="0" style="width:' + W + 'px; max-width:' + W + 'px; background-color:#FFFFFF; border:1px solid ' + S.line + '; border-radius:' + S.radius + 'px; overflow:hidden; box-shadow:0 8px 28px rgba(16,35,44,.06);">\n\n' +
topBar + headerBlock(parsed, T) + placedLogoRow(T, 'above') + renderBlocks(parsed.blocks, T) + placedLogoRow(T, 'footer') + gap(10) + botBar +
'  </table>\n\n' + footer +
'</td>\n</tr>\n</table>\n\n</body>\n</html>';
  }

  /* ==================== plain text ==================== */
  function buildText(parsed) {
    var out = [];
    if (parsed.subject) { out.push(parsed.subject, ''); }
    parsed.blocks.forEach(function (b) {
      if (b.type === 'eyebrow') { out.push(b.text.toUpperCase(), ''); }
      else if (b.type === 'h1') { out.push(stripInline(b.text), '='.repeat(Math.min(60, b.text.length)), ''); }
      else if (b.type === 'h2') { out.push('', stripInline(b.text).toUpperCase(), ''); }
      else if (b.type === 'sub') { out.push(stripInline(b.text), ''); }
      else if (b.type === 'p') { out.push(b.lines.map(stripInline).join('\n'), ''); }
      else if (b.type === 'ul' || b.type === 'card') { b.items.forEach(function (x) { out.push('* ' + stripInline(x)); }); out.push(''); }
      else if (b.type === 'ol') { b.items.forEach(function (x, n) { out.push((n + 1) + '. ' + stripInline(x)); }); out.push(''); }
      else if (b.type === 'table') { b.rows.forEach(function (r) { out.push(stripInline(r.label) + ': ' + stripInline(r.value)); }); out.push(''); }
      else if (b.type === 'stats') { b.items.forEach(function (s2) { out.push(s2.value + ' — ' + s2.label); }); out.push(''); }
      else if (b.type === 'callout') { out.push(stripInline(b.text), ''); }
      else if (b.type === 'button') { out.push(b.text + ': ' + b.url, ''); }
      else if (b.type === 'image') { out.push('[' + (b.alt || 'image') + ']', ''); if (b.caption) { out.push(stripInline(b.caption), ''); } }
      else if (b.type === 'gallery') { out.push('Gallery:', ''); b.items.forEach(function (item) { out.push('* [' + (item.alt || 'image') + ']' + (item.caption ? ' — ' + stripInline(item.caption) : '')); }); out.push(''); }
      else if (b.type === 'quote') { out.push('\u201c' + stripInline(b.text) + '\u201d' + (b.name ? ' \u2014 ' + stripInline(b.name) : ''), ''); }
      else if (b.type === 'feature') { out.push((b.heading || b.alt ? stripInline(b.heading || b.alt) + ': ' : '') + stripInline(b.body || ''), ''); }
      else if (b.type === 'divider') { out.push('—'.repeat(40), ''); }
      else if (b.type === 'sign') { out.push(b.parts.filter(Boolean).join('\n'), ''); }
    });
    if (S.footer) { out.push('', S.footer); }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  var DEFAULTS = JSON.parse(JSON.stringify(S));
  function setState(patch) {
    if (!patch) return;
    Object.keys(patch).forEach(function (k) { S[k] = patch[k]; });
  }
  function getState() { return JSON.parse(JSON.stringify(S)); }
  function resetState() {
    Object.keys(S).forEach(function (k) { delete S[k]; });
    Object.keys(DEFAULTS).forEach(function (k) { S[k] = DEFAULTS[k]; });
  }
  function applyPalette(key) {
    var P = PALETTES[key];
    if (!P) return;
    S.palette = key;
    ['primary', 'accent', 'tint', 'line', 'ink', 'page'].forEach(function (k) { S[k] = P[k]; });
  }

  return { THEMES: THEMES, PALETTES: PALETTES, STARTERS: STARTERS, esc: esc, inline: inline, stripInline: stripInline, parse: parse, renderBlocks: renderBlocks, headerBlock: headerBlock, buildEmail: buildEmail, buildText: buildText, setState: setState, getState: getState, resetState: resetState, applyPalette: applyPalette };
})();

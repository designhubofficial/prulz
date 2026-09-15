/**
 * GENERATED FILE - do not edit by hand.
 * Extracted from upwell-email-signature-builder.html by scripts/extract-signature.mjs
 *
 * Changes from the original, both mechanical:
 *   - v(id) reads a config object rather than the DOM
 *   - drawIcon() returns '' when there is no document (icons are decorative)
 */

const __signature = (function () {
  "use strict";
  let photoData = null;
  let logoData = null;
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const tel = s => 'tel:' + String(s||'').replace(/[^\d+]/g,'');
function v(id){
    // Replaced during extraction: reads the config object instead of the DOM.
    var value = CONFIG[id];
    if (value === undefined || value === null) return '';
    if (typeof value === 'boolean') return value;
    return String(value).trim();
  }
function link(href,text,color,bold){
  return '<a href="'+esc(href)+'" style="color:'+color+';text-decoration:none;'+(bold?'font-weight:bold;':'')+'">'+esc(text)+'</a>';
}
const kb = str => Math.round((str.length*0.75)/1024);

/* ---- icons drawn on canvas, so they embed like the headshot does ---- */
const DEFAULT_LOGO = 'data:image/png;base64,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';

const iconCache = new Map();
function roundRect(x, px, py, w, h, r){
  x.beginPath();
  x.moveTo(px+r, py);
  x.lineTo(px+w-r, py); x.quadraticCurveTo(px+w, py, px+w, py+r);
  x.lineTo(px+w, py+h-r); x.quadraticCurveTo(px+w, py+h, px+w-r, py+h);
  x.lineTo(px+r, py+h); x.quadraticCurveTo(px, py+h, px, py+h-r);
  x.lineTo(px, py+r); x.quadraticCurveTo(px, py, px+r, py);
  x.closePath();
}
function makeIcon(kind, hex){
  const key = kind + hex;
  if (iconCache.has(key)) return iconCache.get(key);
  let data = '';
  try {
    data = drawIcon(kind, hex);
  } catch(e){
    data = '';
  }
  iconCache.set(key, data);
  return data;
}
function drawIcon(kind, hex){
    if (typeof document === 'undefined' || !document.createElement) { return ''; }
  const S = 48;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  if (!x) throw new Error('no canvas');

  x.fillStyle = hex;
  roundRect(x, 0, 0, S, S, 11);
  x.fill();

  x.strokeStyle = '#FFFFFF';
  x.fillStyle = '#FFFFFF';
  x.lineWidth = 2.6;
  x.lineCap = 'round';
  x.lineJoin = 'round';

  if (kind === 'facebook'){
    x.font = 'bold 32px Georgia, "Times New Roman", serif';
    x.textAlign = 'center';
    x.fillText('f', S/2, 35);
  } else if (kind === 'instagram'){
    const p = 13, w = S - p*2;
    roundRect(x, p, p, w, w, 6);
    x.stroke();
    x.beginPath(); x.arc(S/2, S/2, 5.4, 0, Math.PI*2); x.stroke();
    x.beginPath(); x.arc(S - 17.5, 17.5, 1.7, 0, Math.PI*2); x.fill();
  } else {
    const px = 12, py = 14, w = 24, h = 20;
    roundRect(x, px, py, w, h, 2.5);
    x.stroke();
    x.fillRect(px+3.5, py+3.5, 8, 6.5);
    x.lineWidth = 2.1;
    [[px+14, py+4.5, px+w-3.5, py+4.5],
     [px+14, py+9, px+w-3.5, py+9],
     [px+3.5, py+13.5, px+w-3.5, py+13.5],
     [px+3.5, py+16.5, px+w-3.5, py+16.5]].forEach(l => {
      x.beginPath(); x.moveTo(l[0], l[1]); x.lineTo(l[2], l[3]); x.stroke();
    });
  }
  const data = c.toDataURL('image/png');
  return data;
}
function iconLink(href, kind, hex, alt){
  const src = makeIcon(kind, hex);
  if (!src) return link(href, alt, hex, true);
  return '<a href="'+esc(href)+'" style="text-decoration:none;">'
    + '<img src="'+src+'" width="24" height="24" alt="'+alt+'" title="'+alt+'" '
    + 'style="display:block;width:24px;height:24px;border:0;">'
    + '</a>';
}
function iconRow(items, topMargin){
  if (!items.length) return '';
  return '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:'+topMargin+' 0 0;"><tr>'
    + items.map(i => '<td style="padding:0 8px 0 0;vertical-align:middle;">'+i+'</td>').join('')
    + '</tr></table>';
}
void iconRow;

function readImage(file, opts, done){
  if(!file){ return; }
  if(!file.type || !file.type.startsWith('image/')){ say('That file is not an image.'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      if (opts.square){
        const side = Math.min(img.width, img.height);
        c.width = c.height = opts.size;
        ctx.drawImage(img, (img.width-side)/2, (img.height-side)/2, side, side, 0, 0, opts.size, opts.size);
        done(c.toDataURL('image/jpeg', 0.85));
      } else {
        const scale = Math.min(1, opts.size / img.width);
        c.width = Math.max(1, Math.round(img.width*scale));
        c.height = Math.max(1, Math.round(img.height*scale));
        ctx.drawImage(img, 0, 0, c.width, c.height);
        done(c.toDataURL('image/png'));
      }
    };
    img.onerror = () => say('That image could not be read. Try a JPEG or PNG.');
    img.src = reader.result;
  };
  reader.onerror = () => say('That file could not be read.');
  reader.readAsDataURL(file);
}

function buildSignature(){
  const accent=v('accent'), ink=v('inkc'), rule=v('rule'), font=v('font');
  const soft='#5B858D', faint='#8CA3A8';
  const fullName = v('name') + (v('creds') ? ', ' + v('creds') : '');
  const logoW = parseInt(v('logow'),10) || 180;
  const layout = v('layout');
  const photoSrc = photoData || v('photo');
  const logoSrc  = logoData || (v('builtinlogo') ? DEFAULT_LOGO : v('logo'));
  const L = 'style="font-family:'+font+';font-size:12px;line-height:17px;color:'+soft+';margin:0;"';

  const PS = 112;
  const photoImg = photoSrc
    ? '<img src="'+esc(photoSrc)+'" width="'+PS+'" height="'+PS+'" alt="'+esc(v('name'))+'" style="display:block;width:'+PS+'px;height:'+PS+'px;border-radius:'+(v('round') ? PS/2 : 4)+'px;border:2px solid '+rule+';">'
    : '';
  const logoImg = logoSrc
    ? '<img src="'+esc(logoSrc)+'" width="'+logoW+'" alt="'+esc(v('org'))+'" style="display:block;width:'+logoW+'px;max-width:'+logoW+'px;height:auto;border:0;">'
    : '';
  const tagText = v('tagline');
  const noWidow = t => esc(t).replace(/\s+(\S+)$/, '&nbsp;$1');
  let tagline = '';
  if (tagText){
    const inner = '<div style="font-family:'+font+';font-size:11px;line-height:16px;font-weight:bold;color:'
      + soft + ';margin:0;max-width:600px;">'+noWidow(tagText)+'</div>';
    tagline = v('bubbles')
      ? '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>'
        + '<td bgcolor="'+v('bubble')+'" style="background-color:'+v('bubble')+';border-radius:6px;padding:7px 13px;">'
        + inner + '</td></tr></table>'
      : inner;
  }

  // --- identity: name, title, then the logo standing in for the practice name ---
  let d = '';
  d += '<div style="font-family:'+font+';font-size:16px;line-height:20px;font-weight:bold;color:'+ink+';margin:0 0 1px;">'+esc(fullName)+'</div>';
  if (v('pronouns')) d += '<div style="font-family:'+font+';font-size:11px;line-height:15px;color:'+faint+';margin:0 0 1px;">('+esc(v('pronouns'))+')</div>';
  if (v('title')) d += '<div style="font-family:'+font+';font-size:12.5px;line-height:17px;color:'+accent+';font-weight:bold;margin:0 0 3px;">'+esc(v('title'))+'</div>';
  const logoInline = (v('logopos') === 'name') && !!logoImg;
  if (logoInline) d += '<div style="margin:8px 0 4px;">'+logoImg+'</div>';
  else if (v('org') && (v('showorg') || !logoImg)) d += '<div style="font-family:'+font+';font-size:13px;line-height:17px;color:'+ink+';font-weight:bold;margin:0 0 2px;">'+esc(v('org'))+'</div>';
  if (v('extra')) d += '<div '+L+'>'+esc(v('extra'))+'</div>';

  // --- two columns: phone / fax on the left, follow us on the right ---
  let contact = '';
  if (v('phone'))  contact += '<div '+L+'>Call/Text: &nbsp;'+link(tel(v('phone')), v('phone'), soft)+'</div>';
  if (v('direct')) contact += '<div '+L+'>Direct: &nbsp;'+link(tel(v('direct')), v('direct'), soft)+'</div>';
  if (v('fax'))    contact += '<div '+L+'>Fax: &nbsp;'+esc(v('fax'))+'</div>';
  if (v('showemail') && v('email')) contact += '<div '+L+'>Email: &nbsp;'+link('mailto:'+v('email'), v('email'), soft)+'</div>';

  let webBlock = '';
  if (v('site'))   webBlock += '<div style="font-family:'+font+';font-size:12.5px;line-height:17px;margin:9px 0 0;">'+link(v('site'), v('site').replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,''), accent, true)+'</div>';
  if (v('states')) webBlock += '<div style="font-family:'+font+';font-size:11px;line-height:15px;color:'+faint+';margin:0;">'+esc(v('states'))+'</div>';

  const s=[];
  if (v('fb')) s.push(iconLink(v('fb'), 'facebook', accent, 'Facebook'));
  if (v('ig')) s.push(iconLink(v('ig'), 'instagram', accent, 'Instagram'));

  const cellTxt = 'vertical-align:middle;font-family:'+font+';font-size:12px;line-height:17px;';
  let follow = '';
  if (s.length){
    follow = '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 0;"><tr>'
      + '<td style="padding:0 10px 0 0;'+cellTxt+'color:'+soft+';">Follow us:</td>'
      + s.map(i => '<td style="padding:0 8px 0 0;vertical-align:middle;">'+i+'</td>').join('')
      + '</tr></table>';
  }

  let news = '';
  if (v('newsletter')){
    const wording = v('newslabel') || 'Newsletter signup';
    const bub = v('bubbles');
    const pill = bub
      ? 'bgcolor="'+v('bubble')+'" style="background-color:'+v('bubble')+';border-radius:6px;padding:6px 12px;'+cellTxt+'"'
      : 'style="padding:0 9px 0 0;'+cellTxt+'"';
    news = '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:7px 0 0;"><tr>'
      + '<td '+pill+'>'
      + link(v('newsletter'), wording, accent, true)+'</td>'
      + '<td style="vertical-align:middle;'+(bub ? 'padding-left:9px;' : '')+'">'
      + iconLink(v('newsletter'), 'newsletter', accent, wording)+'</td>'
      + '</tr></table>';
  }

  let cta = '';
  if (v('showbooking') && v('booking')){
    const label = v('bookinglabel') || 'Schedule an appointment';
    cta = '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:12px 0 0;"><tr>'
      + '<td bgcolor="'+ink+'" style="background-color:'+ink+';border-radius:5px;padding:9px 17px;">'
      + '<a href="'+esc(v('booking'))+'" style="color:#FFFBEF;font-family:'+font+';font-size:12px;font-weight:bold;'
      + 'line-height:16px;text-decoration:none;display:inline-block;">'+esc(label)+'</a>'
      + '</td></tr></table>';
  }

  const cols = contact + follow;

  const leftW = Math.max(photoImg ? PS : 0, (!logoInline && logoImg) ? logoW : 0);
  const logoNudge = Math.max(0, Math.round((leftW - logoW) / 2) + 3);
  const logoUnder = (!logoInline && logoImg)
    ? '<div style="margin:'+(photoImg ? '6px' : '0')+' 0 0 '+logoNudge+'px;">'+logoImg+'</div>'
    : '';
  const leftStack = (photoImg ? '<div style="width:'+PS+'px;margin:0 auto;">'+photoImg+'</div>' : '') + logoUnder;
  const body = d + cols + news + webBlock + cta;

  let core='';
  if (layout === 'stack') {
    core = '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="padding:0;">'
      + (leftStack ? '<div style="margin:0 0 13px;">'+leftStack+'</div>' : '')
      + body
      + (tagline ? '<div style="margin:12px 0 0;">'+tagline+'</div>' : '')
      + '</td></tr></table>';
  } else {
    const leftCell = leftStack
      ? '<td style="padding:0 18px 0 0;vertical-align:top;text-align:center;width:'+leftW+'px;">'+leftStack+'</td>'
      : '';
    core = '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>'
      + leftCell
      + '<td style="border-left:3px solid '+rule+';padding-left:16px;vertical-align:top;">'+body+'</td>'
      + '</tr>'
      + (tagline ? '<tr><td colspan="2" style="padding:13px 0 0;">'+tagline+'</td></tr>' : '')
      + '</table>';
  }

  const F = 'style="font-family:'+font+';font-size:10.5px;line-height:15px;color:'+faint+';margin:11px 0 0;max-width:520px;"';
  let footer='';
  if (v('crisis')) footer += '<div '+F+'>This inbox is not monitored around the clock and is not for emergencies. If you are in crisis, call or text <b>988</b>, or call 911.</div>';
  if (v('disclaimer')) footer += '<div '+F+'>CONFIDENTIALITY NOTICE: This message and any attachments may contain protected health information intended only for the named recipient. If you received this in error, please notify the sender and delete all copies. Any unauthorized review, use, or disclosure is prohibited.</div>';
  if (v('indep')) footer += '<div '+F+'>Clinicians at UpWell Psychiatry LLC are independently licensed provider businesses. All services rendered reflect each practitioner\'s own license, business, and practice style.</div>';

  return '<div style="font-family:'+font+';">'+core+footer+'</div>';
}

function plainText(){
  return [
    v('name') + (v('creds') ? ', ' + v('creds') : ''),
    v('title'), v('org'), v('states'),
    v('phone') ? 'Call/Text: ' + v('phone') : '',
    v('direct') ? 'Direct: ' + v('direct') : '',
    v('fax') ? 'Fax: ' + v('fax') : '',
    v('showemail') ? v('email') : '',
    v('site'),
    (v('fb')||v('ig')) ? 'Follow us: ' + [v('fb'),v('ig')].filter(Boolean).join('  ') : '',
    v('newsletter') ? (v('newslabel')||'Newsletter') + ': ' + v('newsletter') : ''
  ].filter(Boolean).join('\n');
}

  var CONFIG = {};
  function setConfig(next) { CONFIG = next || {}; }
  function setPhotoData(data) { photoData = data || null; }
  function setLogoData(data) { logoData = data || null; }

  /** Build the signature HTML from a config object. */
  function build(config) {
    setConfig(config);
    setPhotoData(config && config.photoData);
    setLogoData(config && config.logoData);
    return buildSignature();
  }

  /** Build the plain-text fallback from a config object. */
  function buildPlain(config) {
    setConfig(config);
    setPhotoData(config && config.photoData);
    setLogoData(config && config.logoData);
    return plainText();
  }

  return { build: build, buildPlain: buildPlain, DEFAULT_LOGO: DEFAULT_LOGO };
})();

export const build = __signature.build;
export const buildPlain = __signature.buildPlain;
export const DEFAULT_LOGO = __signature.DEFAULT_LOGO;

export default __signature;

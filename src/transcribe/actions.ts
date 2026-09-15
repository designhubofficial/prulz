/**
 * Reading a call back to the person who took it.
 *
 * Three passes over the transcript, all local, all rules:
 *
 *   1. **Commitments** — someone said they would do something. These are what
 *      a VA loses track of, and losing one is what a patient notices.
 *   2. **Details worth copying** — callback numbers, member IDs, dates. Not
 *      because they are hard to find, but because scrubbing an hour of audio
 *      for the one time a number was read out is how afternoons disappear.
 *   3. **A template suggestion** — which library email this call implies.
 *
 * There is no model behind any of it. That is a deliberate choice, not a
 * limitation being worked around: a transcript of a patient call is PHI in its
 * purest form, and sending it to a third-party API to be summarised would
 * undo the property that makes this whole tool usable at a practice. Rules are
 * weaker than a language model at this and they run on a locked-down laptop
 * with the wifi off, which is where the work actually happens.
 *
 * The same discipline as `checks/phi.ts` applies: **precision over recall.** A
 * panel of eleven "action items" that are mostly filler gets collapsed and
 * never reopened, and then the two real ones are lost too. Every pattern is
 * anchored on a first-person commitment or an explicit request.
 */
import { duration } from './format.js';
import type { Segment, Transcript } from './types.js';

export type ItemKind = 'commitment' | 'request';

export interface ActionItem {
  id: string;
  kind: ItemKind;
  /** What to do, phrased as a task. */
  label: string;
  /** The sentence it came from, so the guess can be judged. */
  excerpt: string;
  /** Seconds into the audio, for the jump-to-playback control. */
  atSec: number;
}

export type DetailKind = 'phone' | 'date' | 'member-id' | 'email' | 'money';

export interface Detail {
  id: string;
  kind: DetailKind;
  label: string;
  value: string;
  excerpt: string;
  atSec: number;
}

export interface Suggestion {
  templateId: string;
  label: string;
  /** Which words in the call led here, so a wrong suggestion is explicable. */
  reason: string;
  score: number;
}

export interface CallNotes {
  actions: ActionItem[];
  details: Detail[];
  suggestions: Suggestion[];
}

/* ------------------------------------------------------------- sentences */

interface Sentence {
  text: string;
  atSec: number;
}

/**
 * Split segments into sentences, keeping each one's start time.
 *
 * Whisper punctuates well but breaks on its own rhythm, so a sentence often
 * spans two segments and a segment sometimes holds three. Splitting on
 * terminators after re-joining gives units that a pattern can be anchored to;
 * matching across a segment boundary is where false positives come from.
 */
export function toSentences(segments: Segment[]): Sentence[] {
  const out: Sentence[] = [];

  for (const segment of segments) {
    // A title abbreviation ends in a period too: "Dr. Iyer" is one sentence
    // and must not split at the dot into "Dr." plus a stray name.
    const parts = segment.text.split(
      /(?<=[.!?])(?<!Dr\.)(?<!Mr\.)(?<!Mrs\.)(?<!Ms\.)(?<!St\.)(?<!Prof\.)(?<!Sr\.)(?<!Jr\.)\s+/,
    );
    for (const part of parts) {
      const text = part.trim();
      if (text) out.push({ text, atSec: segment.start });
    }
  }

  return out;
}

/* ----------------------------------------------------------- commitments */

interface Rule {
  id: string;
  re: RegExp;
  kind: ItemKind;
  /** Turn a match into a task. Receives the match and the whole sentence. */
  label: (match: RegExpMatchArray, sentence: string) => string;
}

/**
 * A commitment needs a first-person subject and a future verb.
 *
 * `I'll send` is a commitment; `we sent` is a report and `you should send` is
 * an instruction to someone else. Anchoring on the subject is what keeps this
 * list short enough to read.
 */
const COMMITMENT = String.raw`(?:I|we)(?:'|’)?(?:ll|\s+will|\s+can|\s+am\s+going\s+to|\s+are\s+going\s+to)`;

const RULES: Rule[] = [
  {
    id: 'call-back',
    kind: 'commitment',
    re: new RegExp(String.raw`\b${COMMITMENT}\s+(?:give\s+you\s+a\s+call|call\s+(?:you|back|him|her|them)|ring\s+you)\b`, 'i'),
    label: () => 'Call back',
  },
  {
    id: 'send-email',
    kind: 'commitment',
    re: new RegExp(String.raw`\b${COMMITMENT}\s+(?:send|email|forward|shoot)\s+(?:you|him|her|them|it|over|that|the)\b`, 'i'),
    label: (_m, sentence) => `Send ${objectOf(sentence) ?? 'what was promised'}`,
  },
  {
    id: 'check-confirm',
    kind: 'commitment',
    // "check with billing" is an ask-the-provider commitment, not a bare
    // check — excluding it here keeps the two rules from double-counting.
    re: new RegExp(String.raw`\b${COMMITMENT}\s+(?:check(?!\s+with)|look\s+into|find\s+out|verify|confirm|double[-\s]?check)\b`, 'i'),
    label: (_m, sentence) => `Check ${objectOf(sentence) ?? 'and report back'}`,
  },
  {
    id: 'book',
    kind: 'commitment',
    re: new RegExp(String.raw`\b${COMMITMENT}\s+(?:book|schedule|set\s+up|get\s+you\s+(?:in|on)|put\s+you\s+(?:down|on))\b`, 'i'),
    label: () => 'Book or reschedule the appointment',
  },
  {
    id: 'ask-provider',
    kind: 'commitment',
    // A named clinician ("Dr. Iyer") beats a bare role ("the doctor") when one
    // was said — the follow-up is to a person, not to a title.
    re: new RegExp(String.raw`\b${COMMITMENT}\s+(?:ask|speak\s+(?:to|with)|talk\s+to|check\s+with|run\s+(?:it|that)\s+by)\s+(?:the\s+)?(doctor|dr\.?|provider|nurse|billing|front\s+desk|office)(?:\s+([A-Z][A-Za-z'-]+))?\b`, 'i'),
    label: (m) => {
      const role = (m[1] ?? '').toLowerCase().replace(/\.$/, '');
      // The pattern is case-insensitive, so the name slot will happily swallow
      // a lowercase word ("billing office" → name "office"). A real name after
      // a role starts with a capital — check on the literal string, where the
      // flag does not apply.
      const name = m[2] && /^[A-Z]/.test(m[2]) ? m[2] : undefined;
      if (name && (role === 'dr' || role === 'doctor')) return `Follow up with Dr. ${name}`;
      if (name) return `Follow up with ${role} ${name}`;
      if (role === 'dr') return 'Follow up with the doctor';
      const article = ['doctor', 'provider', 'nurse', 'office', 'front desk'].includes(role) ? 'the ' : '';
      return `Follow up with ${article}${role}`;
    },
  },
  {
    id: 'send-forms',
    kind: 'commitment',
    re: new RegExp(String.raw`\b${COMMITMENT}\s+(?:send|email|resend|mail)\s+(?:you\s+)?(?:the\s+|those\s+|some\s+)?(?:forms?|paperwork|intake|packet|link)\b`, 'i'),
    label: () => 'Send the intake forms',
  },

  /* Requests — the other party asked for something. */
  {
    id: 'req-send',
    kind: 'request',
    re: /\b(?:can|could|would)\s+you\s+(?:please\s+)?(?:send|email|fax|forward|text)\b/i,
    label: (_m, sentence) => `Requested: send ${objectOf(sentence) ?? 'the item discussed'}`,
  },
  {
    id: 'req-callback',
    kind: 'request',
    re: /\b(?:call\s+me\s+back|give\s+me\s+a\s+call|reach\s+me\s+at|best\s+number\s+(?:to\s+reach|is))\b/i,
    label: () => 'Requested: a callback',
  },
  {
    id: 'req-reschedule',
    kind: 'request',
    re: /\b(?:need\s+to|want\s+to|like\s+to|have\s+to)\s+(?:reschedule|move|change|push)\s+(?:my|the|that|this)?\s*(?:appointment|appt|visit|session)?\b/i,
    label: () => 'Requested: reschedule',
  },
  {
    id: 'req-cancel',
    kind: 'request',
    re: /\b(?:need\s+to|want\s+to|have\s+to|going\s+to)\s+cancel\b/i,
    label: () => 'Requested: cancellation',
  },
];

/** The noun a "send/check" commitment was about, when the sentence names one. */
const OBJECTS: [RegExp, string][] = [
  [/\bsuperbill/i, 'the superbill'],
  [/\bstatement|\bbalance|\binvoice/i, 'the statement'],
  [/\breceipt/i, 'the receipt'],
  [/\bintake|\bpaperwork|\bforms?\b|\bpacket/i, 'the intake forms'],
  [/\brecords?\b|\bchart\b/i, 'the records'],
  [/\breferral/i, 'the referral'],
  [/\bprior\s+auth|\bauthoriz/i, 'the prior authorization'],
  [/\bbenefits?\b|\beligibilit|\bcoverage/i, 'the benefits check'],
  [/\bprescription|\brefill|\brx\b/i, 'the prescription'],
  [/\bzoom|\btelehealth|\bvideo\s+link|\bmeeting\s+link/i, 'the telehealth link'],
  [/\binsurance\s+card/i, 'the insurance card request'],
  [/\bdirections|\baddress/i, 'the directions'],
  [/\bestimate|\bquote|\bcost/i, 'the cost estimate'],
];

function objectOf(sentence: string): string | undefined {
  return OBJECTS.find(([re]) => re.test(sentence))?.[1];
}

export function findActions(segments: Segment[]): ActionItem[] {
  const sentences = toSentences(segments);
  const out: ActionItem[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    for (const rule of RULES) {
      const match = sentence.text.match(rule.re);
      if (!match) continue;

      const label = rule.label(match, sentence.text);

      // The same commitment restated ("I'll call you back" … "I'll call you
      // back this afternoon") is one task, not two. Dedupe on the label.
      const key = `${rule.kind}:${label.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        id: `${rule.id}-${out.length}`,
        kind: rule.kind,
        label,
        excerpt: sentence.text,
        atSec: sentence.atSec,
      });
    }
  }

  return out;
}

/* --------------------------------------------------------------- details */

interface DetailRule {
  kind: DetailKind;
  label: string;
  re: RegExp;
}

const DETAIL_RULES: DetailRule[] = [
  {
    kind: 'phone',
    label: 'Phone number',
    // Requires separators or a leading 1/+1. A bare ten digits is far more
    // often an account number or a date read out than a phone number.
    re: /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g,
  },
  {
    kind: 'email',
    label: 'Email address',
    re: /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g,
  },
  {
    kind: 'member-id',
    label: 'Member or policy number',
    // Anchored on the word that introduces it — an unanchored alphanumeric run
    // matches every dosage, code and street address in the call.
    re: /\b(?:member|policy|group|subscriber|claim|authorization|auth|reference|confirmation)\s*(?:id|number|no\.?|#)?\s*(?:is\s+)?[:#]?\s*([A-Z0-9][A-Z0-9-]{4,})\b/gi,
  },
  {
    kind: 'date',
    label: 'Date mentioned',
    re: /\b(?:Mon|Tues?|Wed(?:nes)?|Thurs?|Fri|Sat(?:ur)?|Sun)(?:day)?\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
  },
  {
    kind: 'money',
    label: 'Amount',
    re: /\$\s?\d[\d,]*(?:\.\d{2})?\b/g,
  },
];

export function findDetails(segments: Segment[]): Detail[] {
  const sentences = toSentences(segments);
  const out: Detail[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    for (const rule of DETAIL_RULES) {
      // `matchAll` clones the pattern and leaves `lastIndex` alone, so a shared
      // global regex is safe to reuse here. (`test`/`exec` would not be — those
      // advance the cursor and would skip every second sentence.)
      for (const match of sentence.text.matchAll(rule.re)) {
        const value = (match[1] ?? match[0]).trim();
        if (!value) continue;

        const key = `${rule.kind}:${value.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          id: `${rule.kind}-${out.length}`,
          kind: rule.kind,
          label: rule.label,
          value,
          excerpt: sentence.text,
          atSec: sentence.atSec,
        });
      }
    }
  }

  return out;
}

/* ----------------------------------------------------------- suggestions */

/**
 * Which email this call probably needs.
 *
 * Weights are deliberately coarse. This picks the template the VA opens next;
 * it does not decide anything, and a wrong guess costs one click on "Change".
 * The `reason` is shown alongside so a wrong guess reads as a wrong guess
 * rather than as the tool malfunctioning.
 */
interface Intent {
  templateId: string;
  label: string;
  terms: RegExp;
  weight: number;
}

const INTENTS: Intent[] = [
  { templateId: 'sch-reschedule', label: 'Reschedule offer', weight: 3, terms: /\breschedul|\bmove\s+(?:my|the|that)\s+appoint|\bdifferent\s+(?:day|time)|\bpush\s+(?:it|that)\s+back\b/gi },
  { templateId: 'sch-cancellation', label: 'Cancellation acknowledgement', weight: 3, terms: /\bcancel(?:l(?:ing|ed|ation))?\b/gi },
  { templateId: 'sch-confirmation', label: 'Appointment confirmation', weight: 2, terms: /\bconfirm(?:ing|ed)?\s+(?:your|the|my)\s+appoint|\bbooked\s+you\s+(?:in|for)|\bsee\s+you\s+on\b/gi },
  { templateId: 'sch-waitlist', label: 'Waitlist opening', weight: 3, terms: /\bwait[\s-]?list|\bif\s+(?:anything|something)\s+opens\s+up|\bcancellation\s+list\b/gi },
  { templateId: 'sch-noshow', label: 'Missed appointment follow-up', weight: 3, terms: /\bmissed\s+(?:your|the|his|her)\s+appoint|\bno[\s-]?show|\bdidn'?t\s+make\s+it\s+in\b/gi },

  { templateId: 'sch-request', label: 'Appointment request received', weight: 3, terms: /\b(?:book|make|schedule|set\s+up|request)\s+(?:an\s+|the\s+)?appointment|\b(?:can|could|would)\s+(?:I|we)\s+get\s+(?:an\s+)?appointment|\b(?:need|wanted|like|hoping)\s+to\s+(?:be\s+seen|see\s+(?:a\s+)?(?:provider|doctor|clinician))|\b(?:when\s+is|what\s+is)\s+(?:the\s+)?(?:next|earliest|first)\s+appointment\b/gi },
  { templateId: 'sch-missed-call', label: 'We tried to reach you', weight: 2, terms: /\bmissed\s+(?:your\s+)?call|\b(?:didn'?t|couldn'?t|unable\s+to|no\s+one)\s+(?:answer|pick\s+up)|\bvoicemail\b|\bleft\s+(?:you\s+)?a\s+(?:voicemail|message)|\bcall\s+you\s+back\s+(?:later|tomorrow|this\s+afternoon)\b/gi },

  { templateId: 'int-welcome', label: 'New patient welcome', weight: 2, terms: /\bnew\s+patient|\bfirst\s+(?:visit|appointment)|\bnever\s+been\s+(?:seen|here)\s+before\b/gi },
  { templateId: 'int-forms', label: 'Intake packet delivery', weight: 3, terms: /\bintake\s+(?:forms?|packet|paperwork)|\bsend\s+(?:you\s+)?the\s+(?:forms?|paperwork|packet)\b/gi },
  { templateId: 'int-missing-forms', label: 'Missing paperwork nudge', weight: 3, terms: /\bhaven'?t\s+(?:received|got(?:ten)?)\s+(?:your|the)\s+(?:forms?|paperwork)|\bstill\s+(?:missing|waiting\s+on)\s+(?:the\s+)?(?:forms?|paperwork)\b/gi },
  { templateId: 'int-insurance-card', label: 'Insurance card request', weight: 3, terms: /\binsurance\s+card|\bfront\s+and\s+back\s+of\s+(?:your|the)\s+card|\bphoto\s+of\s+(?:your|the)\s+card\b/gi },
  { templateId: 'int-telehealth', label: 'Telehealth visit instructions', weight: 3, terms: /\btelehealth|\bvirtual\s+(?:visit|appointment)|\bvideo\s+(?:visit|call|link)|\bzoom\s+link\b/gi },

  { templateId: 'care-lab-results', label: 'Lab results ready', weight: 4, terms: /\b(?:lab|laboratory|blood)\s+work\b|\b(?:lab|laboratory|blood)\s+results?|\bresults?\s+(?:are|were|is|come|came|coming|got)\s+back\b|\bbloodwork\b/gi },
  { templateId: 'care-refill', label: 'Refill request update', weight: 4, terms: /\brefill(?:s|ing)?\b|\bprescription\s+(?:ran|run|running)\s+out\b|\b(?:I'?m|am|are)\s+(?:almost\s+|just\s+)?out\s+of\s+(?:my\s+|the\s+)?(?:medication|medicine|meds|pills)\b|\bmedications?\s+(?:is|are)\s+(?:almost\s+)?(?:gone|low|running\s+low)\b/gi },
  { templateId: 'care-question', label: 'Question relayed to the care team', weight: 3, terms: /\b(?:can|could|would)\s+you\s+(?:please\s+)?ask\b|\bask\s+(?:the\s+)?(?:doctor|provider|nurse)\s+(?:about|if|whether)\b|\b(?:is|was)\s+it\s+normal\b|\bshould\s+I\s+be\s+concerned\b|\bwhat\s+should\s+I\s+do\s+about\b/gi },
  { templateId: 'care-referral-status', label: 'Referral status update', weight: 4, terms: /\b(?:my|the|that|this)\s+referral\b|\breferral\s+(?:status|update|went\s+through|sent|approved)\b|\breferral\s+to\s+(?:a\s+)?(?:specialist|clinic|doctor)\b/gi },
  { templateId: 'care-work-note', label: 'Work or school note', weight: 3, terms: /\b(?:work|school|doctor'?s|sick|excuse)\s+notes?\b|\b(?:need|wanted)\s+(?:a\s+)?(?:note|letter)\s+(?:for|from)\b|\b(?:back\s+to\s+work|back\s+to\s+school)\s+(?:on|after)\b|\bFMLA\b/gi },

  { templateId: 'bil-benefits', label: 'Benefits verification result', weight: 3, terms: /\bbenefits?\b|\beligibilit|\bverify\s+(?:your|the)\s+coverage|\bin[\s-]network|\bdeductible\b/gi },
  { templateId: 'bil-prior-auth', label: 'Prior authorization update', weight: 4, terms: /\bprior\s+auth|\bpre[\s-]?auth|\bauthoriz(?:ation|ed|ing)\b/gi },
  { templateId: 'bil-statement', label: 'Statement reminder', weight: 3, terms: /\bbalance\b|\bstatement\b|\boutstanding|\bpast\s+due|\bpay(?:ment)?\s+(?:plan|owed)\b/gi },
  { templateId: 'bil-superbill', label: 'Superbill delivery', weight: 4, terms: /\bsuperbill|\bout[\s-]of[\s-]network\s+claim|\bsubmit\s+(?:it|this)\s+to\s+(?:my|your)\s+insurance\b/gi },

  { templateId: 'crd-records-request', label: 'Records request', weight: 3, terms: /\bmedical\s+records?|\brelease\s+of\s+information|\bsend\s+(?:my|the|his|her)\s+(?:records?|chart)\b/gi },
  { templateId: 'crd-referral-ack', label: 'Referral acknowledgement', weight: 3, terms: /\brefer(?:ral|red|ring)\b/gi },

  { templateId: 'ann-hours', label: 'Holiday or changed hours', weight: 2, terms: /\bholiday\s+(?:hours|schedule)|\bclosed\s+(?:on|for)\s+(?:the\s+)?(?:holiday|monday|friday)\b/gi },
  { templateId: 'ann-closure', label: 'Unplanned closure', weight: 2, terms: /\boffice\s+is\s+closed|\bclosing\s+early|\bshut\s+(?:down|the\s+office)\b/gi },
];

export function suggestTemplates(segments: Segment[], limit = 3): Suggestion[] {
  const haystack = segments.map((s) => s.text).join(' ');
  const out: Suggestion[] = [];

  for (const intent of INTENTS) {
    const matches = [...haystack.matchAll(intent.terms)];
    if (!matches.length) continue;

    // Diminishing returns past the second mention: a word repeated eleven times
    // is one topic, not eleven reasons, and without the cap a filler term would
    // outrank a decisive one said once.
    const hits = Math.min(matches.length, 2);
    const words = [...new Set(matches.map((m) => m[0].trim().toLowerCase()))].slice(0, 3);

    out.push({
      templateId: intent.templateId,
      label: intent.label,
      reason: `Heard ${words.map((w) => `“${w}”`).join(', ')}`,
      score: intent.weight * hits,
    });
  }

  return out.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, limit);
}

/* ------------------------------------------------------------------ all */

export function readCall(transcript: Transcript): CallNotes {
  return {
    actions: findActions(transcript.segments),
    details: findDetails(transcript.segments),
    suggestions: suggestTemplates(transcript.segments),
  };
}

/**
 * The notes as pasteable text.
 *
 * Written to be dropped into a chart note or a handover message, which means it
 * has to carry its own caveat — a list of machine-guessed action items pasted
 * into a patient record with no provenance is exactly the artefact this tool
 * should not be producing.
 */
export function notesToText(transcript: Transcript, notes: CallNotes): string {
  const lines: string[] = [
    `Call notes — ${transcript.name}`,
    new Date(transcript.createdAt).toLocaleString(),
    `Length ${duration(transcript.durationSec)}`,
    '',
  ];

  if (notes.actions.length) {
    lines.push('Follow-ups:');
    for (const action of notes.actions) lines.push(`  [ ] ${action.label}`);
    lines.push('');
  }

  if (notes.details.length) {
    lines.push('Details mentioned:');
    for (const detail of notes.details) lines.push(`  ${detail.label}: ${detail.value}`);
    lines.push('');
  }

  lines.push('Drafted from an automatic transcript. Check against the recording before filing.');
  return lines.join('\n');
}

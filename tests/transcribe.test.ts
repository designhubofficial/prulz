import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter, type StorageAdapter } from '../src/store/adapter.js';
import { TEMPLATES } from '../src/library/index.js';
import {
  TIERS, DEFAULT_TIER, LANGUAGES, TURN_GAP_SEC, FORMATS,
  assignSpeakers, clock, countTranscripts, cueTime, defaultSpeakerNames,
  deleteTranscript, downmix, duration, editText, findActions, findDetails,
  formatBytes, formatById, listTranscripts, loadTranscript, mergeWithPrevious,
  normalizeTranscript, notesToText, readCall, removeSegment, renameSpeaker,
  safeFilename, saveTranscript, searchSegments, setSpeaker, setSpeakerFrom,
  suggestTemplates, isTierId, normalizeTier, tierById, toFormat, toMarkdown, toSegments, toSrt, toText,
  toTurns, toVtt, wordCount, isWav, parseWav, WavParseError,
  encodePcmWav,
  IMA_ADPCM, MS_ADPCM, imaSamplesPerBlock, msSamplesPerBlock,
  type Segment, type Transcript,
} from '../src/transcribe/index.js';

/* --------------------------------------------------------------- helpers */

function segment(id: number, start: number, end: number, text: string, speaker = 0): Segment {
  return { id, start, end, text, speaker };
}

function transcript(segments: Segment[], speakers = ['Speaker 1', 'Speaker 2']): Transcript {
  return {
    id: 't1',
    name: 'call.m4a',
    createdAt: Date.UTC(2026, 0, 15, 12, 0, 0),
    durationSec: 120,
    language: 'en',
    modelId: 'onnx-community/whisper-base',
    segments,
    speakers,
  };
}

/* ========================================================== catalogue ==== */

describe('model catalogue', () => {
  it('uses Balanced as the quality-first default', () => {
    expect(DEFAULT_TIER).toBe('balanced');
  });

  it('normalises saved tier preferences safely', () => {
    expect(isTierId('balanced')).toBe(true);
    expect(isTierId('not-a-tier')).toBe(false);
    expect(normalizeTier('fast')).toBe('fast');
    expect(normalizeTier('not-a-tier')).toBe(DEFAULT_TIER);
  });

  it('has a tier for every id the picker can produce', () => {
    for (const tier of TIERS) expect(tierById(tier.id)).toBe(tier);
  });

  it('falls back to the default rather than returning undefined', () => {
    expect(tierById('nonsense').id).toBe(DEFAULT_TIER);
  });

  it('quotes a download size for both backends of every tier', () => {
    // The picker shows one or the other depending on what the machine has; a
    // missing figure would render "≈undefined MB".
    for (const tier of TIERS) {
      expect(tier.megabytes).toBeGreaterThan(0);
      expect(tier.megabytesCpu).toBeGreaterThan(0);
    }
  });

  it('keeps the high-accuracy tier practical to load', () => {
    const accurate = tierById('accurate');
    expect(accurate.repo).toBe('onnx-community/whisper-small');
    expect(accurate.megabytes).toBeLessThan(400);
    expect(accurate.megabytesCpu).toBeLessThan(400);
  });

  it('keeps the tiers ordered by size on the GPU path', () => {
    const sizes = TIERS.map((t) => t.megabytes);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
  });

  it('offers automatic detection first', () => {
    expect(LANGUAGES[0].code).toBe('auto');
  });
});

/* ============================================================ assembly ==== */

describe('toSegments', () => {
  it('drops empty and whitespace-only chunks', () => {
    const segments = toSegments([
      { timestamp: [0, 1], text: 'Hello' },
      { timestamp: [1, 2], text: '   ' },
      { timestamp: [2, 3], text: '' },
      { timestamp: [3, 4], text: 'there' },
    ], 4);

    expect(segments.map((s) => s.text)).toEqual(['Hello', 'there']);
  });

  it('gives the final chunk the clip duration when its end is null', () => {
    const segments = toSegments([{ timestamp: [0, null], text: 'Only line' }], 12.5);
    expect(segments[0].end).toBe(12.5);
  });

  it('falls back to the start when the duration is unknown too', () => {
    const segments = toSegments([{ timestamp: [4, null], text: 'Only line' }], 0);
    expect(segments[0].end).toBe(4);
  });

  it('clamps a start that runs backwards, so the list stays sortable', () => {
    const segments = toSegments([
      { timestamp: [0, 5], text: 'first' },
      { timestamp: [3, 8], text: 'second' },
    ], 8);

    expect(segments[1].start).toBe(5);
    expect(segments[1].end).toBe(8);
  });

  it('numbers segments from zero after the drops, not before', () => {
    const segments = toSegments([
      { timestamp: [0, 1], text: '  ' },
      { timestamp: [1, 2], text: 'kept' },
    ], 2);

    expect(segments[0].id).toBe(0);
  });

  it('trims chunk text', () => {
    const segments = toSegments([{ timestamp: [0, 1], text: '  spaced  ' }], 1);
    expect(segments[0].text).toBe('spaced');
  });
});

/* ============================================================ speakers ==== */

describe('assignSpeakers', () => {
  it('keeps one speaker across short gaps', () => {
    const segments = assignSpeakers([
      segment(0, 0, 2, 'a'),
      segment(1, 2.2, 4, 'b'),
      segment(2, 4.1, 6, 'c'),
    ]);

    expect(segments.map((s) => s.speaker)).toEqual([0, 0, 0]);
  });

  it('switches speaker after a gap at or past the threshold', () => {
    const segments = assignSpeakers([
      segment(0, 0, 2, 'a'),
      segment(1, 2 + TURN_GAP_SEC, 4, 'b'),
    ]);

    expect(segments.map((s) => s.speaker)).toEqual([0, 1]);
  });

  it('alternates back on the next gap rather than inventing a third voice', () => {
    const segments = assignSpeakers([
      segment(0, 0, 2, 'a'),
      segment(1, 5, 6, 'b'),
      segment(2, 9, 10, 'c'),
    ]);

    expect(segments.map((s) => s.speaker)).toEqual([0, 1, 0]);
  });

  it('does not mutate its input', () => {
    const input = [segment(0, 0, 2, 'a'), segment(1, 9, 10, 'b')];
    assignSpeakers(input);
    expect(input[1].speaker).toBe(0);
  });

  it('is idempotent for a given threshold', () => {
    const input = [segment(0, 0, 2, 'a'), segment(1, 9, 10, 'b'), segment(2, 20, 21, 'c')];
    expect(assignSpeakers(assignSpeakers(input))).toEqual(assignSpeakers(input));
  });

  it('names one speaker per index it actually used', () => {
    expect(defaultSpeakerNames([segment(0, 0, 1, 'a'), { ...segment(1, 2, 3, 'b'), speaker: 1 }]))
      .toEqual(['Speaker 1', 'Speaker 2']);
  });
});

/* ============================================================= editing ==== */

describe('editing', () => {
  const base = () => transcript([
    segment(0, 0, 2, 'one'),
    { ...segment(1, 3, 5, 'two'), speaker: 1 },
    { ...segment(2, 6, 8, 'three'), speaker: 1 },
  ]);

  it('replaces one segment’s text and leaves the rest alone', () => {
    const next = editText(base(), 1, 'edited');
    expect(next.segments.map((s) => s.text)).toEqual(['one', 'edited', 'three']);
  });

  it('reassigns a single segment', () => {
    expect(setSpeaker(base(), 2, 0).segments[2].speaker).toBe(0);
  });

  it('cascades a reassignment to the end of the run', () => {
    const next = setSpeakerFrom(base(), 1, 0);
    expect(next.segments.map((s) => s.speaker)).toEqual([0, 0, 0]);
  });

  it('leaves the cascade alone when the speaker already matches', () => {
    const before = base();
    expect(setSpeakerFrom(before, 1, 1)).toBe(before);
  });

  it('does not cascade backwards past the segment it started from', () => {
    const before = transcript([
      { ...segment(0, 0, 2, 'one'), speaker: 1 },
      { ...segment(1, 3, 5, 'two'), speaker: 1 },
    ]);
    expect(setSpeakerFrom(before, 1, 0).segments.map((s) => s.speaker)).toEqual([1, 0]);
  });

  it('grows the speaker list when reassigning to an index that has no name yet', () => {
    expect(setSpeaker(base(), 0, 3).speakers).toHaveLength(4);
  });

  it('renames a speaker', () => {
    expect(renameSpeaker(base(), 1, 'Dr. Reyes').speakers[1]).toBe('Dr. Reyes');
  });

  it('falls back to the positional name when a rename is blanked', () => {
    expect(renameSpeaker(base(), 1, '   ').speakers[1]).toBe('Speaker 2');
  });

  it('removes a segment', () => {
    expect(removeSegment(base(), 1).segments.map((s) => s.id)).toEqual([0, 2]);
  });

  it('merges a segment into the previous one, keeping the outer timings', () => {
    const next = mergeWithPrevious(base(), 2);
    expect(next.segments).toHaveLength(2);
    expect(next.segments[1]).toMatchObject({ start: 3, end: 8, text: 'two three' });
  });

  it('refuses to merge the first segment into nothing', () => {
    const before = base();
    expect(mergeWithPrevious(before, 0)).toBe(before);
  });
});

/* =============================================================== turns ==== */

describe('toTurns', () => {
  it('groups consecutive segments by speaker', () => {
    const turns = toTurns([
      segment(0, 0, 2, 'a'),
      segment(1, 2, 4, 'b'),
      { ...segment(2, 4, 6, 'c'), speaker: 1 },
      segment(3, 6, 8, 'd'),
    ]);

    expect(turns.map((t) => t.segments.length)).toEqual([2, 1, 1]);
    expect(turns.map((t) => t.speaker)).toEqual([0, 1, 0]);
  });

  it('spans a turn from its first start to its last end', () => {
    const [turn] = toTurns([segment(0, 1, 3, 'a'), segment(1, 3, 9, 'b')]);
    expect(turn).toMatchObject({ start: 1, end: 9 });
  });

  it('returns nothing for an empty transcript', () => {
    expect(toTurns([])).toEqual([]);
  });
});

/* ============================================================== search ==== */

describe('searchSegments', () => {
  const segments = [
    segment(0, 0, 2, 'Take 2.5 mg twice daily'),
    segment(1, 3, 5, 'Billing code 99213 (established patient)'),
    segment(2, 6, 8, 'Nothing relevant'),
  ];

  it('matches case-insensitively', () => {
    expect(searchSegments(segments, 'NOTHING')).toHaveLength(1);
  });

  it('treats a dosage with a dot as literal text, not a wildcard', () => {
    expect(searchSegments(segments, '2.5 mg')).toHaveLength(1);
    expect(searchSegments(segments, '2X5 mg')).toHaveLength(0);
  });

  it('does not throw on an unbalanced bracket', () => {
    expect(() => searchSegments(segments, '99213 (')).not.toThrow();
    expect(searchSegments(segments, '99213 (')).toHaveLength(1);
  });

  it('returns nothing for a blank query rather than everything', () => {
    expect(searchSegments(segments, '   ')).toEqual([]);
  });

  it('counts words across segments', () => {
    expect(wordCount([segment(0, 0, 1, 'one two'), segment(1, 1, 2, 'three')])).toBe(3);
    expect(wordCount([segment(0, 0, 1, '   ')])).toBe(0);
  });
});

/* ========================================================= timestamps ==== */

describe('timestamps', () => {
  it('reads minutes and seconds under an hour', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(62)).toBe('1:02');
    expect(clock(599)).toBe('9:59');
  });

  it('adds an hour field and pads the minutes past an hour', () => {
    expect(clock(3661)).toBe('1:01:01');
  });

  it('writes SRT cue times with a comma and VTT with a period', () => {
    expect(cueTime(3661.5, ',')).toBe('01:01:01,500');
    expect(cueTime(3661.5, '.')).toBe('01:01:01.500');
  });

  it('floors milliseconds, so a cue end cannot round past the next start', () => {
    expect(cueTime(1.9999, ',')).toBe('00:00:01,999');
  });

  it('clamps a negative time rather than emitting a malformed cue', () => {
    expect(cueTime(-5, ',')).toBe('00:00:00,000');
  });

  it('describes a duration in the units a person would use', () => {
    expect(duration(45)).toBe('45 sec');
    expect(duration(60)).toBe('1 min');
    expect(duration(252)).toBe('4 min 12 sec');
  });

  it('formats byte counts', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(250 * 1024 * 1024)).toBe('250 MB');
  });
});

/* ============================================================ exports ==== */

describe('exports', () => {
  const sample = () => transcript([
    segment(0, 0, 2.5, 'Good morning, this is the front desk.'),
    { ...segment(1, 3.5, 6, 'Hi, I need to reschedule.'), speaker: 1 },
    { ...segment(2, 6, 7, 'For next week.'), speaker: 1 },
  ]);

  it('groups plain text into speaker turns, not one line per segment', () => {
    expect(toText(sample())).toBe(
      'Speaker 1: Good morning, this is the front desk.\n\n' +
      'Speaker 2: Hi, I need to reschedule. For next week.',
    );
  });

  it('uses the renamed speaker throughout', () => {
    const named = renameSpeaker(sample(), 1, 'Patient');
    expect(toText(named)).toContain('Patient: Hi, I need to reschedule.');
  });

  it('carries the speaker-label caveat into Markdown', () => {
    expect(toMarkdown(sample())).toContain('not voice recognition');
  });

  it('heads Markdown with the recording name and length', () => {
    const md = toMarkdown(sample());
    expect(md.startsWith('# call.m4a')).toBe(true);
    expect(md).toContain('**Length** 2 min');
  });

  it('numbers SRT cues from one', () => {
    const srt = toSrt(sample().segments);
    expect(srt.startsWith('1\n00:00:00,000 --> 00:00:02,500\n')).toBe(true);
    expect(srt).toContain('\n2\n');
  });

  it('gives a zero-length utterance a playable cue', () => {
    const srt = toSrt([segment(0, 4, 4, 'Mm-hm')]);
    expect(srt).toContain('00:00:04,000 --> 00:00:04,200');
  });

  it('writes the VTT header exactly once', () => {
    const vtt = toVtt(sample().segments);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt.match(/WEBVTT/g)).toHaveLength(1);
  });

  it('does not number VTT cues, which SRT alone requires', () => {
    expect(toVtt([segment(0, 0, 1, 'x')])).toBe('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nx\n');
  });

  it('round-trips through JSON with a version stamp', () => {
    const parsed = JSON.parse(toFormat(sample(), 'json'));
    expect(parsed.version).toBe(1);
    expect(parsed.segments).toHaveLength(3);
  });

  it('produces output for every format the picker offers', () => {
    for (const format of FORMATS) {
      expect(toFormat(sample(), format.id).length).toBeGreaterThan(0);
      expect(formatById(format.id)).toBe(format);
    }
  });

  it('falls back to the first format for an unknown id', () => {
    expect(formatById('nope')).toBe(FORMATS[0]);
  });
});

describe('safeFilename', () => {
  it('strips characters Windows refuses', () => {
    expect(safeFilename('Call 3/14 — Mrs. R.m4a', 'txt')).toBe('Call 3-14 — Mrs. R.txt');
  });

  it('drops the original extension rather than stacking two', () => {
    expect(safeFilename('recording.mp3', 'srt')).toBe('recording.srt');
  });

  it('trims trailing dots and spaces, which Windows silently mangles', () => {
    expect(safeFilename('notes... ', 'txt')).toBe('notes.txt');
  });

  it('never produces a bare extension', () => {
    expect(safeFilename('///', 'vtt')).toBe('transcript.vtt');
  });

  it('caps a very long name', () => {
    expect(safeFilename('x'.repeat(300), 'txt').length).toBeLessThanOrEqual(84);
  });
});

/* ============================================================== audio ==== */

describe('downmix', () => {
  it('returns a single channel untouched', () => {
    const mono = new Float32Array([0.1, 0.2]);
    expect(downmix([mono], 2)).toBe(mono);
  });

  it('averages channels rather than keeping the left one', () => {
    const left = new Float32Array([1, 0]);
    const right = new Float32Array([0, 1]);
    expect(Array.from(downmix([left, right], 2))).toEqual([0.5, 0.5]);
  });

  it('keeps a caller-supplied side of a two-party recording audible', () => {
    // The failure this guards: one party on each channel, and taking only the
    // left transcribes half the call with no sign that it did.
    const staff = new Float32Array([0.8, 0.8, 0]);
    const patient = new Float32Array([0, 0, 0.8]);
    const mixed = downmix([staff, patient], 3);
    expect(mixed[2]).toBeGreaterThan(0);
  });
});

describe('encodePcmWav', () => {
  it('writes a browser-compatible mono PCM WAV', () => {
    const parsed = parseWav(encodePcmWav(new Float32Array([-1, 0, 1]), 8_000));

    expect(parsed.sampleRate).toBe(8_000);
    expect(parsed.length).toBe(3);
    expect(parsed.channels).toHaveLength(1);
    expect(parsed.channels[0][0]).toBe(-1);
    expect(parsed.channels[0][1]).toBe(0);
    expect(parsed.channels[0][2]).toBeCloseTo(1, 4);
  });
});

/* ======================================================== call notes ==== */

describe('findActions', () => {
  const actionsIn = (text: string) => findActions([segment(0, 0, 5, text)]);

  it('catches a first-person commitment to call back', () => {
    expect(actionsIn("Okay, I'll call you back this afternoon.")[0].label).toBe('Call back');
  });

  it('names what a send commitment was about', () => {
    expect(actionsIn("I'll send you the superbill today.")[0].label).toBe('Send the superbill');
  });

  it('falls back when the sentence names no object', () => {
    expect(actionsIn("I'll send it over.")[0].label).toBe('Send what was promised');
  });

  it('ignores a past-tense report, which is not a commitment', () => {
    expect(actionsIn('We sent the forms last Tuesday.')).toEqual([]);
  });

  it('ignores an instruction aimed at someone else', () => {
    expect(actionsIn('You should send that to billing.')).toEqual([]);
  });

  it('picks up an explicit request as a request, not a commitment', () => {
    const [action] = actionsIn('Could you send me the receipt?');
    expect(action.kind).toBe('request');
    expect(action.label).toBe('Requested: send the receipt');
  });

  it('records a reschedule request', () => {
    expect(actionsIn('I need to reschedule my appointment.')[0].label)
      .toBe('Requested: reschedule');
  });

  it('collapses the same commitment restated', () => {
    const actions = findActions([
      segment(0, 0, 3, "I'll call you back."),
      segment(1, 10, 13, "I'll call you back this afternoon."),
    ]);
    expect(actions).toHaveLength(1);
  });

  it('keeps the timestamp of the sentence it came from', () => {
    const actions = findActions([segment(0, 42, 45, "I'll call you back.")]);
    expect(actions[0].atSec).toBe(42);
  });

  it('names the clinician when one was said', () => {
    expect(actionsIn("I'll ask Dr. Iyer about your results.")[0].label)
      .toBe('Follow up with Dr. Iyer');
  });

  it('still falls back to the role when no name was said', () => {
    expect(actionsIn("I'll check with the billing office.")[0].label)
      .toBe('Follow up with billing');
  });

  it('finds nothing in small talk', () => {
    expect(actionsIn('Thanks so much, you too, bye now.')).toEqual([]);
  });
});

describe('findDetails', () => {
  const detailsIn = (text: string) => findDetails([segment(0, 0, 5, text)]);

  it('picks up a separated phone number', () => {
    expect(detailsIn('Reach me at 415-555-0134.')[0].value).toBe('415-555-0134');
  });

  it('ignores a bare run of ten digits', () => {
    // Far more often an account number read aloud than a phone number.
    expect(detailsIn('The account is 4155550134.').filter((d) => d.kind === 'phone')).toEqual([]);
  });

  it('requires an introducing word before a member number', () => {
    expect(detailsIn('Member ID is XZ4409123')[0].value).toBe('XZ4409123');
    expect(detailsIn('Take one XZ4409123 tablet').filter((d) => d.kind === 'member-id')).toEqual([]);
  });

  it('finds a dollar amount', () => {
    expect(detailsIn('The balance is $142.50 after insurance.')[0].value).toBe('$142.50');
  });

  it('scans every sentence, not every other one', () => {
    // The detail patterns are shared global regexes reused across sentences.
    // `matchAll` clones them and leaves `lastIndex` alone, so this holds — but
    // switching any rule to `test`/`exec` would advance the shared cursor and
    // silently drop every second sentence, which is what this guards.
    const details = findDetails([
      segment(0, 0, 3, 'Call 415-555-0134.'),
      segment(1, 4, 7, 'Or try 415-555-0199.'),
    ]);
    expect(details.filter((d) => d.kind === 'phone')).toHaveLength(2);
  });

  it('reports a repeated value once', () => {
    const details = findDetails([
      segment(0, 0, 3, 'Call 415-555-0134.'),
      segment(1, 4, 7, 'Again, that is 415-555-0134.'),
    ]);
    expect(details.filter((d) => d.kind === 'phone')).toHaveLength(1);
  });
});

describe('suggestTemplates', () => {
  it('points a reschedule call at the reschedule template', () => {
    const [top] = suggestTemplates([segment(0, 0, 5, 'I need to reschedule my appointment.')]);
    expect(top.templateId).toBe('sch-reschedule');
  });

  it('points a refill call at the refill update template', () => {
    const [top] = suggestTemplates([
      segment(0, 0, 5, "I'm almost out of my blood pressure medication — can I get a refill?"),
    ]);
    expect(top.templateId).toBe('care-refill');
  });

  it('points a results call at the lab results template', () => {
    const [top] = suggestTemplates([segment(0, 0, 5, 'Have my lab results come back yet?')]);
    expect(top.templateId).toBe('care-lab-results');
  });

  it('points a request to be seen at the appointment request template', () => {
    const [top] = suggestTemplates([
      segment(0, 0, 5, "I'd like to book an appointment to see a provider."),
    ]);
    expect(top.templateId).toBe('sch-request');
  });

  it('points a referral question at the patient referral update, not the provider ack', () => {
    const ids = suggestTemplates([segment(0, 0, 5, 'Did my referral go through yet?')]).map((s) => s.templateId);
    expect(ids[0]).toBe('care-referral-status');
    expect(ids).toContain('crd-referral-ack');
  });

  it('points a note request at the work or school note template', () => {
    const [top] = suggestTemplates([segment(0, 0, 5, 'I need a work note for three days off.')]);
    expect(top.templateId).toBe('care-work-note');
  });

  it('picks prior authorization over the generic billing templates', () => {
    const [top] = suggestTemplates([
      segment(0, 0, 5, 'We are still waiting on the prior auth from the insurer.'),
    ]);
    expect(top.templateId).toBe('bil-prior-auth');
  });

  it('explains itself with the words it heard', () => {
    const [top] = suggestTemplates([segment(0, 0, 5, 'Can you resend the intake forms?')]);
    expect(top.reason).toMatch(/Heard/);
  });

  it('suggests nothing for a call with no discernible subject', () => {
    expect(suggestTemplates([segment(0, 0, 5, 'Hello? Yes. Okay. Thank you.')])).toEqual([]);
  });

  it('caps the list', () => {
    const busy = segment(0, 0, 30,
      'I need to reschedule, and cancel the other one, and the prior auth, ' +
      'and the superbill, and the intake forms, and the telehealth link.');
    expect(suggestTemplates([busy]).length).toBeLessThanOrEqual(3);
  });

  it('only ever names a template that exists', () => {
    // A suggestion pointing at a deleted template renders a dead "Open" button.
    const everything = segment(0, 0, 60, [
      'reschedule', 'cancel', 'waitlist', 'no-show', 'new patient', 'intake forms',
      "haven't received your forms", 'insurance card', 'telehealth', 'benefits',
      'prior auth', 'balance', 'superbill', 'medical records', 'referral',
      'holiday hours', 'office is closed', 'confirming your appointment',
    ].join('. '));

    const ids = new Set(TEMPLATES.map((t) => t.id));
    for (const suggestion of suggestTemplates([everything], 100)) {
      expect(ids.has(suggestion.templateId)).toBe(true);
    }
  });
});

describe('readCall and notesToText', () => {
  const called = () => transcript([
    segment(0, 0, 4, "I'll send you the intake forms today."),
    { ...segment(1, 5, 9, 'My number is 415-555-0134.'), speaker: 1 },
  ]);

  it('produces all three passes at once', () => {
    const notes = readCall(called());
    expect(notes.actions.length).toBeGreaterThan(0);
    expect(notes.details.length).toBeGreaterThan(0);
    expect(notes.suggestions.length).toBeGreaterThan(0);
  });

  it('writes notes as a checklist', () => {
    const text = notesToText(called(), readCall(called()));
    expect(text).toContain('[ ] Send the intake forms');
    expect(text).toContain('415-555-0134');
  });

  it('carries its own provenance caveat, since it gets pasted elsewhere', () => {
    expect(notesToText(called(), readCall(called())))
      .toContain('Check against the recording before filing');
  });

  it('states the length the way a person reads it, not in raw seconds', () => {
    const long = { ...called(), durationSec: 252 };
    expect(notesToText(long, readCall(long))).toContain('Length 4 min 12 sec');
  });
});

/* ============================================================== store ==== */

describe('transcript store', () => {
  let store: StorageAdapter;
  beforeEach(() => { store = new MemoryAdapter(); });

  const saved = (id: string, createdAt: number): Transcript =>
    ({ ...transcript([segment(0, 0, 1, 'x')]), id, createdAt });

  it('round-trips a transcript', async () => {
    const one = saved('a', 1000);
    await saveTranscript(store, one);
    expect(await loadTranscript(store, 'a')).toEqual(one);
  });

  it('returns undefined for a transcript that is not there', async () => {
    expect(await loadTranscript(store, 'missing')).toBeUndefined();
  });

  it('lists newest first', async () => {
    await saveTranscript(store, saved('old', 1000));
    await saveTranscript(store, saved('new', 2000));
    expect((await listTranscripts(store)).map((t) => t.id)).toEqual(['new', 'old']);
  });

  it('deletes one without touching the others', async () => {
    await saveTranscript(store, saved('a', 1));
    await saveTranscript(store, saved('b', 2));
    await deleteTranscript(store, 'a');
    expect(await countTranscripts(store)).toBe(1);
  });

  it('ignores keys belonging to the other tools', async () => {
    await store.set('draft:sch-reminder', { anything: true });
    await store.set('brand-profile', { anything: true });
    await saveTranscript(store, saved('a', 1));
    expect(await countTranscripts(store)).toBe(1);
  });
});

describe('normalizeTranscript', () => {
  it('rejects something that is not a transcript', () => {
    expect(normalizeTranscript(undefined)).toBeNull();
    expect(normalizeTranscript({ id: 'a' })).toBeNull();
  });

  it('fills in fields a older build did not write', () => {
    const result = normalizeTranscript({
      id: 'a',
      segments: [{ id: 0, start: 0, end: 1, text: 'hi', speaker: 0 }],
    });

    expect(result).toMatchObject({ name: 'Untitled recording', language: 'auto', durationSec: 0 });
    expect(result?.speakers).toEqual(['Speaker 1']);
  });

  it('grows the speaker list to cover the highest index actually used', () => {
    const result = normalizeTranscript({
      id: 'a',
      speakers: ['Only one'],
      segments: [{ id: 0, start: 0, end: 1, text: 'hi', speaker: 2 }],
    });

    expect(result?.speakers).toHaveLength(3);
  });

  it('renumbers segments that arrived without ids', () => {
    const result = normalizeTranscript({
      id: 'a',
      segments: [
        { start: 0, end: 1, text: 'a' },
        { start: 1, end: 2, text: 'b' },
      ] as never,
    });

    expect(result?.segments.map((s) => s.id)).toEqual([0, 1]);
  });
});

/* ================================================================ wav ==== */

/**
 * Build a WAV by hand so each shape the browser rejects can be reproduced
 * exactly — including the ones a real recorder produces.
 */
function wavFile(options: {
  format?: number;
  channels?: number;
  sampleRate?: number;
  bits?: number;
  data: number[];
  /** Override the declared `data` size, as a truncated recording does. */
  declaredDataSize?: number;
  /** Extra chunks placed between `fmt ` and `data`, as `LIST`/`INFO` are. */
  extraChunk?: { id: string; body: number[] };
  fmtExtension?: number[];
  riffId?: string;
}): ArrayBuffer {
  const {
    format = 1, channels = 1, sampleRate = 16000, bits = 16, data,
    declaredDataSize, extraChunk, fmtExtension, riffId = 'RIFF',
  } = options;

  const fmtBody = 16 + (fmtExtension ? 2 + fmtExtension.length : 0);
  const extraBytes = extraChunk ? 8 + extraChunk.body.length : 0;
  const total = 12 + 8 + fmtBody + extraBytes + 8 + data.length;

  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  let at = 0;

  const putAscii = (text: string) => {
    for (const char of text) view.setUint8(at++, char.charCodeAt(0));
  };
  const putU32 = (value: number) => { view.setUint32(at, value, true); at += 4; };
  const putU16 = (value: number) => { view.setUint16(at, value, true); at += 2; };

  putAscii(riffId);
  putU32(total - 8);
  putAscii('WAVE');

  putAscii('fmt ');
  putU32(fmtBody);
  putU16(format);
  putU16(channels);
  putU32(sampleRate);
  putU32(sampleRate * channels * (bits / 8));
  putU16(channels * (bits / 8));
  putU16(bits);
  if (fmtExtension) {
    putU16(fmtExtension.length);
    for (const byte of fmtExtension) view.setUint8(at++, byte);
  }

  if (extraChunk) {
    putAscii(extraChunk.id);
    putU32(extraChunk.body.length);
    for (const byte of extraChunk.body) view.setUint8(at++, byte);
  }

  putAscii('data');
  putU32(declaredDataSize ?? data.length);
  for (const byte of data) view.setUint8(at++, byte);

  return buffer;
}

/** Little-endian 16-bit samples as raw bytes. */
function pcm16(values: number[]): number[] {
  return values.flatMap((v) => [v & 0xff, (v >> 8) & 0xff]);
}

function rounded(samples: Float32Array): number[] {
  return Array.from(samples).map((v) => Number(v.toFixed(3)));
}

describe('isWav', () => {
  it('recognises a RIFF/WAVE file', () => {
    expect(isWav(wavFile({ data: pcm16([0]) }))).toBe(true);
  });

  it('recognises the RF64 variant field recorders write', () => {
    expect(isWav(wavFile({ data: pcm16([0]), riffId: 'RF64' }))).toBe(true);
  });

  it('rejects anything else, including a buffer too short to hold a header', () => {
    expect(isWav(new ArrayBuffer(4))).toBe(false);
    expect(isWav(new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]).buffer))
      .toBe(false);
  });
});

describe('parseWav', () => {
  it('reads 16-bit mono PCM at full scale', () => {
    const parsed = parseWav(wavFile({ data: pcm16([0, 16384, -16384, 32767]) }));

    expect(parsed.sampleRate).toBe(16000);
    expect(parsed.length).toBe(4);
    expect(parsed.channels).toHaveLength(1);
    expect(rounded(parsed.channels[0])).toEqual([0, 0.5, -0.5, 1]);
  });

  it('de-interleaves stereo into a channel each', () => {
    // Frame-interleaved: L0 R0 L1 R1.
    const parsed = parseWav(wavFile({
      channels: 2,
      data: pcm16([16384, -16384, 32767, 0]),
    }));

    expect(parsed.length).toBe(2);
    expect(rounded(parsed.channels[0])).toEqual([0.5, 1]);
    expect(rounded(parsed.channels[1])).toEqual([-0.5, 0]);
  });

  /**
   * The failure the whole fallback exists for: a recording cut short leaves
   * `data` claiming more bytes than the file holds, and the browser refuses it.
   */
  it('decodes a truncated recording whose data chunk overstates its length', () => {
    const parsed = parseWav(wavFile({
      data: pcm16([16384, 32767]),
      declaredDataSize: 999_999,
    }));

    expect(parsed.length).toBe(2);
    expect(rounded(parsed.channels[0])).toEqual([0.5, 1]);
  });

  it('decodes RF64, where 0xFFFFFFFF is the declared size by design', () => {
    const parsed = parseWav(wavFile({
      riffId: 'RF64',
      data: pcm16([32767]),
      declaredDataSize: 0xffffffff,
    }));

    expect(parsed.length).toBe(1);
  });

  it('skips metadata chunks sitting between the header and the audio', () => {
    const parsed = parseWav(wavFile({
      data: pcm16([32767, 0]),
      extraChunk: { id: 'LIST', body: [0x49, 0x4e, 0x46, 0x4f] },
    }));

    expect(parsed.length).toBe(2);
    expect(rounded(parsed.channels[0])).toEqual([1, 0]);
  });

  it('reads the real format code out of a WAVE_FORMAT_EXTENSIBLE header', () => {
    // 22-byte extension: valid bits, channel mask, then a GUID opening with the
    // actual format code — 1, plain PCM.
    const extension = [
      16, 0, 0x04, 0, 0, 0,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00,
      0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71,
    ];
    const parsed = parseWav(wavFile({
      format: 0xfffe,
      data: pcm16([32767]),
      fmtExtension: extension,
    }));

    expect(rounded(parsed.channels[0])).toEqual([1]);
  });

  it('reads 8-bit PCM, which is unsigned around 128', () => {
    const parsed = parseWav(wavFile({ bits: 8, data: [128, 255, 0] }));

    expect(Array.from(parsed.channels[0])).toEqual([0, 127 / 128, -1]);
  });

  it('reads 24-bit PCM with the sign bit extended', () => {
    // 0x000000 silence, 0x7FFFFF positive full scale, 0x800000 negative.
    const parsed = parseWav(wavFile({
      bits: 24,
      data: [0x00, 0x00, 0x00, 0xff, 0xff, 0x7f, 0x00, 0x00, 0x80],
    }));

    expect(rounded(parsed.channels[0])).toEqual([0, 1, -1]);
  });

  it('reads 32-bit float samples', () => {
    const bytes = new Uint8Array(8);
    const writer = new DataView(bytes.buffer);
    writer.setFloat32(0, 0.25, true);
    writer.setFloat32(4, -0.75, true);

    const parsed = parseWav(wavFile({ format: 3, bits: 32, data: Array.from(bytes) }));

    expect(Array.from(parsed.channels[0])).toEqual([0.25, -0.75]);
  });

  /** Call recorders hand over G.711 in a .wav container constantly. */
  it('reads mu-law, the codec of a recorded phone call', () => {
    // 0xFF is mu-law silence; 0x80 and 0x00 are the two full-scale extremes.
    const parsed = parseWav(wavFile({ format: 7, bits: 8, data: [0xff, 0x80, 0x00] }));

    expect(parsed.length).toBe(3);
    expect(parsed.channels[0][0]).toBeCloseTo(0, 4);
    expect(parsed.channels[0][1]).toBeCloseTo(0.98, 2);
    expect(parsed.channels[0][2]).toBeCloseTo(-0.98, 2);
  });

  it('reads A-law', () => {
    // 0xD5 is A-law silence; 0x2A is positive full scale.
    const parsed = parseWav(wavFile({ format: 6, bits: 8, data: [0xd5, 0x55, 0x2a] }));

    expect(parsed.channels[0][0]).toBeCloseTo(-0.0002, 4);
    expect(parsed.channels[0][1]).toBeCloseTo(0.0002, 4);
    expect(parsed.channels[0][2]).toBeCloseTo(0.984, 3);
  });

  it('names the codec when the payload is compressed, so the browser can try', () => {
    // Format 0x11 is IMA ADPCM — a real WAV, just not one we can read.
    const adpcm = () => parseWav(wavFile({ format: 0x11, data: pcm16([0]) }));

    expect(adpcm).toThrow(WavParseError);
    expect(adpcm).toThrow(/compressed/);
  });

  /**
   * A recorder that streams to disk writes the `data` size last, and never
   * gets to it if the session ends badly. The bytes are all there.
   */
  it('reads to the end of the file when the data chunk declares zero length', () => {
    const parsed = parseWav(wavFile({
      data: pcm16([16384, -16384, 32767]),
      declaredDataSize: 0,
    }));

    expect(parsed.length).toBe(3);
    expect(rounded(parsed.channels[0])).toEqual([0.5, -0.5, 1]);
  });

  it('reports a file with no audio rather than returning empty samples', () => {
    expect(() => parseWav(wavFile({ data: [] }))).toThrow(/no audio/);
  });

  it('refuses a file that is not RIFF/WAVE at all', () => {
    expect(() => parseWav(new ArrayBuffer(64))).toThrow(WavParseError);
  });
});

/* ============================================================== adpcm ==== */

/**
 * A WAV holding block-compressed audio.
 *
 * Separate from `wavFile` because the block codecs size their data by block
 * rather than by frame, and carry extra `fmt ` fields describing the blocks.
 */
function blockWav(options: {
  format: number;
  channels?: number;
  sampleRate?: number;
  blockAlign: number;
  samplesPerBlock?: number;
  coefficients?: Array<[number, number]>;
  data: number[];
}): ArrayBuffer {
  const {
    format, channels = 1, sampleRate = 16000, blockAlign,
    samplesPerBlock, coefficients, data,
  } = options;

  const extension: number[] = [];
  const pushU16 = (value: number) => {
    extension.push(value & 0xff, (value >> 8) & 0xff);
  };
  if (samplesPerBlock !== undefined) pushU16(samplesPerBlock);
  if (coefficients) {
    pushU16(coefficients.length);
    for (const [a, b] of coefficients) { pushU16(a); pushU16(b); }
  }

  const fmtBody = 18 + extension.length;
  const total = 12 + 8 + fmtBody + 8 + data.length;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  let at = 0;

  const putAscii = (text: string) => {
    for (const char of text) view.setUint8(at++, char.charCodeAt(0));
  };
  const putU32 = (value: number) => { view.setUint32(at, value, true); at += 4; };
  const putU16 = (value: number) => { view.setUint16(at, value, true); at += 2; };

  putAscii('RIFF'); putU32(total - 8); putAscii('WAVE');
  putAscii('fmt '); putU32(fmtBody);
  putU16(format); putU16(channels); putU32(sampleRate);
  putU32(Math.round((sampleRate * blockAlign) / 8)); putU16(blockAlign); putU16(4);
  putU16(extension.length);
  for (const byte of extension) view.setUint8(at++, byte);

  putAscii('data'); putU32(data.length);
  for (const byte of data) view.setUint8(at++, byte);

  return buffer;
}

/** Samples back as the 16-bit integers the codecs actually reconstruct. */
function asInts(samples: Float32Array): number[] {
  return Array.from(samples).map((v) => Math.round(v * 32768));
}

/** An IMA block header: initial predictor, then step index. */
function imaHeader(predictor: number, index = 0): number[] {
  return [predictor & 0xff, (predictor >> 8) & 0xff, index, 0];
}

describe('imaSamplesPerBlock / msSamplesPerBlock', () => {
  it('derives the frame count from the block size', () => {
    // A 256-byte IMA block: 4 header bytes, then two samples per remaining byte.
    expect(imaSamplesPerBlock(256, 1)).toBe(505);
    // Stereo splits the block, so each channel still gets 252 data bytes.
    expect(imaSamplesPerBlock(512, 2)).toBe(505);
    expect(msSamplesPerBlock(256, 1)).toBe(500);
    expect(msSamplesPerBlock(512, 2)).toBe(500);
  });
});

describe('parseWav — IMA ADPCM (format 17)', () => {
  /**
   * Worked through the IMA state machine by hand: from a zero predictor at step
   * index 0, nibble 4 adds a whole step of 7, and each following zero nibble
   * adds an eighth of the (shrinking) step before the index bottoms out.
   */
  it('reconstructs samples from nibbles and the block header', () => {
    const parsed = parseWav(blockWav({
      format: IMA_ADPCM,
      blockAlign: 8,
      samplesPerBlock: 9,
      data: [...imaHeader(0), 0x04, 0x00, 0x00, 0x00],
    }));

    expect(parsed.length).toBe(9);
    expect(asInts(parsed.channels[0])).toEqual([0, 7, 8, 9, 9, 9, 9, 9, 9]);
  });

  it('starts each block from the predictor in its own header', () => {
    const block = (predictor: number) => [...imaHeader(predictor), 0x00, 0x00, 0x00, 0x00];
    const parsed = parseWav(blockWav({
      format: IMA_ADPCM,
      blockAlign: 8,
      samplesPerBlock: 9,
      data: [...block(0), ...block(-1000)],
    }));

    expect(parsed.length).toBe(18);
    expect(asInts(parsed.channels[0])[0]).toBe(0);
    // The second block resets rather than continuing from the first.
    expect(asInts(parsed.channels[0])[9]).toBe(-1000);
  });

  /**
   * Stereo interleaves four bytes at a time — eight nibbles of the left channel,
   * then eight of the right — not one sample at a time.
   */
  it('de-interleaves stereo in four-byte groups', () => {
    const parsed = parseWav(blockWav({
      format: IMA_ADPCM,
      channels: 2,
      blockAlign: 16,
      samplesPerBlock: 9,
      data: [
        ...imaHeader(0), ...imaHeader(100),
        0x04, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
      ],
    }));

    expect(parsed.channels).toHaveLength(2);
    expect(asInts(parsed.channels[0])).toEqual([0, 7, 8, 9, 9, 9, 9, 9, 9]);
    expect(asInts(parsed.channels[1])).toEqual(Array(9).fill(100));
  });

  it('decodes what survived when the last block is cut short', () => {
    const full = [...imaHeader(0), 0x04, 0x00, 0x00, 0x00];
    const parsed = parseWav(blockWav({
      format: IMA_ADPCM,
      blockAlign: 8,
      samplesPerBlock: 9,
      // Second block keeps its header but loses two of its four data bytes.
      data: [...full, ...imaHeader(500), 0x00, 0x00],
    }));

    expect(parsed.length).toBeGreaterThan(9);
    expect(asInts(parsed.channels[0])[9]).toBe(500);
  });

  /** A header that claims more frames than the block can hold loses to arithmetic. */
  it('ignores a declared frame count the block size cannot support', () => {
    const parsed = parseWav(blockWav({
      format: IMA_ADPCM,
      blockAlign: 8,
      samplesPerBlock: 9999,
      data: [...imaHeader(0), 0x04, 0x00, 0x00, 0x00],
    }));

    expect(parsed.length).toBe(9);
  });

  it('rejects a block too small to hold even its own header', () => {
    expect(() => parseWav(blockWav({
      format: IMA_ADPCM,
      blockAlign: 4,
      data: [...imaHeader(0)],
    }))).toThrow(/block size/);
  });
});

describe('parseWav — Microsoft ADPCM (format 2)', () => {
  /**
   * Predictor set 0 is (256, 0), which predicts each sample as simply the
   * previous one; with a delta of 16 the first nibble of 1 steps up by 16 and
   * the zero nibbles then hold.
   */
  it('reconstructs samples from the two-tap predictor', () => {
    const parsed = parseWav(blockWav({
      format: MS_ADPCM,
      blockAlign: 9,
      samplesPerBlock: 6,
      data: [
        0x00,        // predictor set 0
        0x10, 0x00,  // delta 16
        0x00, 0x00,  // sample1 0
        0x00, 0x00,  // sample2 0
        0x10, 0x00,  // nibbles: 1, 0, 0, 0
      ],
    }));

    expect(parsed.length).toBe(6);
    expect(asInts(parsed.channels[0])).toEqual([0, 0, 16, 16, 16, 16]);
  });

  it('emits the two header samples oldest first', () => {
    const parsed = parseWav(blockWav({
      format: MS_ADPCM,
      blockAlign: 9,
      samplesPerBlock: 6,
      data: [
        0x00,
        0x10, 0x00,
        0xd0, 0x07,  // sample1 = 2000
        0xe8, 0x03,  // sample2 = 1000
        0x00, 0x00,
      ],
    }));

    // sample2 is the older of the pair and so comes out first.
    expect(asInts(parsed.channels[0]).slice(0, 2)).toEqual([1000, 2000]);
  });

  it('uses a coefficient table the file supplies instead of the defaults', () => {
    const custom: Array<[number, number]> = [[0, 0], [256, 0]];
    const parsed = parseWav(blockWav({
      format: MS_ADPCM,
      blockAlign: 9,
      samplesPerBlock: 6,
      coefficients: custom,
      data: [
        0x00,        // predictor set 0 — here (0, 0), so it predicts silence
        0x10, 0x00,
        0xd0, 0x07,
        0xe8, 0x03,
        0x10, 0x00,  // nibbles: 1, 0, 0, 0
      ],
    }));

    // With both coefficients zero the prediction is 0, so the first coded
    // sample is just the residual: 1 x delta 16.
    expect(asInts(parsed.channels[0])[2]).toBe(16);
  });
});

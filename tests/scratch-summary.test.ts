import { it } from 'vitest';
import { summarize } from '../src/transcribe/summary.js';
import type { Segment, Transcript } from '../src/transcribe/types.js';

function make(lines: [number, string][], speakers: string[]): Transcript {
  const segments: Segment[] = lines.map(([speaker, text], i) => ({
    id: i, start: i * 8, end: i * 8 + 7, text, speaker,
  }));
  return {
    id: 't1',
    name: 'call-2026-09-09.wav',
    createdAt: Date.UTC(2026, 8, 9, 14, 30),
    durationSec: lines.length * 8,
    language: 'en',
    modelId: 'onnx-community/whisper-base',
    segments,
    speakers,
  };
}

it('prints a summary to look at', () => {
  const refill = make([
    [0, 'Good morning, Lakeside Family Practice, this is Alex speaking.'],
    [1, 'Hi Alex, this is Maria Delgado. I am almost out of my blood pressure medication and I need a refill.'],
    [0, 'Okay.'],
    [0, 'Let me pull up your chart. Can you confirm your date of birth for me?'],
    [1, 'Sure, it is March 14th, 1978.'],
    [0, 'Got it. I see the prescription here. I will send the refill request over to Dr. Iyer this afternoon.'],
    [1, 'Thank you. Also, I was wondering about my referral to the cardiologist. Has that gone through?'],
    [0, 'Let me check on that. I will look into the referral and call you back before Friday.'],
    [1, 'That would be great. My number is 555-208-4471.'],
    [0, 'Perfect. And your member ID is BCB-4471902, is that right?'],
    [1, 'Yes, that is correct.'],
    [0, 'Great. I will call you back on Friday with an update on both.'],
    [1, 'Thanks so much.'],
  ], ['Alex', 'Maria']);

  const anonymous = make([
    [0, 'Hi, I am calling because I missed my appointment yesterday and I want to reschedule.'],
    [1, 'No problem at all. We can move that to a different day.'],
    [0, 'Is there anything on October 6th?'],
    [1, 'There is a two-fifteen slot. I can book you in for that.'],
    [0, 'That works.'],
  ], ['Speaker 1', 'Speaker 2']);

  const thin = make([
    [0, 'Okay.'],
    [1, 'Yeah.'],
  ], ['Speaker 1', 'Speaker 2']);

  const empty = make([], []);

  for (const [name, t] of [['REFILL', refill], ['RESCHEDULE', anonymous], ['THIN', thin], ['EMPTY', empty]] as const) {
    const text = summarize(t);
    console.log(`\n===== ${name} (${text.trim().split(/\s+/).length} words) =====\n${text}`);
  }
});

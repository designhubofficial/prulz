import { TEMPLATES as CORE_TEMPLATES } from './index.js';
import type { Template, Category } from './types.js';
export { fieldsFor, render, sampleValues } from './index.js';
export type { Template, Category } from './types.js';

export const CATEGORY_LABELS: Record<Category, string> = {
  coordination: 'Referrals & handoffs', outreach: 'Provider relationships', care: 'Care collaboration',
  announcements: 'Practice updates', scheduling: 'Appointments', intake: 'New patient intake', billing: 'Billing & insurance',
  marketing: 'Patient outreach', newsletter: 'Newsletters',
};
export const CATEGORY_GROUPS = [
  { key: 'patients', label: 'Patient messages', hint: 'Appointments, intake, billing, and care follow-up', categories: ['scheduling', 'intake', 'billing'] as Category[] },
  { key: 'growth', label: 'Outreach & newsletters', hint: 'Patient education, campaigns, and provider relationships', categories: ['marketing', 'newsletter', 'outreach'] as Category[] },
  { key: 'clinical', label: 'Practice & clinical', hint: 'Coordinate with patients, colleagues, and the wider team', categories: ['coordination', 'care', 'announcements'] as Category[] },
];
const field = (key: string, label: string, sample: string) => ({ key, label, sample, type: 'text' as const, required: true });
function template(id: string, name: string, category: Category, description: string, subject: string, content: string, fields: Template['fields']): Template {
  const design = {
    coordination: { theme: 'signal', palette: 'ocean' },
    care: { theme: 'ledger', palette: 'forest' },
    outreach: { theme: 'beacon', palette: 'midnight' },
    announcements: { theme: 'stack', palette: 'graphite' },
    scheduling: { theme: 'plain', palette: 'ocean' },
    intake: { theme: 'plain', palette: 'forest' },
    billing: { theme: 'ledger', palette: 'graphite' },
    marketing: { theme: 'beacon', palette: 'plum' },
    newsletter: { theme: 'pulse', palette: 'ocean' },
  } as const;
  const selectedDesign = design[category];
  return {
    id: 'provider-' + id, name, category, description, bulk: false,
    ...selectedDesign, preheader: description,
    fields: [field('recipient_name', 'Provider name / title', 'Dr. Morgan'),
      { ...field('sender_title', 'Your title', 'Provider Relations Coordinator'), fromBrand: true }, ...fields],
    body: 'Subject: ' + subject + '\n# ' + name + '\n\nDear {{recipient_name}},\n\n' + content
      + '\n\nBest regards,\n\n@ {{sender_name}} | {{sender_title}} | {{practice_name}}\n\n{{practice_email}} · {{practice_phone}}\n\n> Please share patient-specific information through your approved secure channel.',
  };
}
export const PROVIDER_TEMPLATES: Template[] = [
  template('introduction', 'Provider introduction', 'outreach', 'Start a thoughtful conversation with a fellow provider.', 'An introduction from {{practice_name}}',
    'I am reaching out on behalf of {{practice_name}} to introduce our team and explore how we might support your practice.\n\nOur focus is {{specialty_focus}}. We would welcome the opportunity to learn about your referral needs and share our approach to care.\n\nWould you be available for {{meeting_request}}?',
    [field('specialty_focus', 'Our clinical focus', 'outpatient psychiatry and collaborative behavioral health care'), field('meeting_request', 'Suggested next step', 'a brief introductory call next week')]),
  template('referral-received', 'Referral acknowledgment', 'coordination', 'Confirm receipt and keep the referring team informed.', 'Referral received — {{practice_name}}',
    'Thank you for your referral. Our team has received the referral through {{secure_channel}} and is reviewing it.\n\n{{next_step}}\n\nWe appreciate your trust in our team and will keep your office informed of the next steps.',
    [field('secure_channel', 'Referral channel', 'our secure referral portal'), field('next_step', 'Next step and timeframe', 'Our intake coordinator will update your office within two business days.')]),
  template('referral-followup', 'Referral status follow-up', 'coordination', 'Request an update from a receiving provider.', 'Following up on a referral from {{practice_name}}',
    'I am following up on the referral submitted through {{secure_channel}} on {{referral_date}}.\n\nCould your team confirm receipt and advise on {{update_requested}}? Any patient identifiers are available in the secure referral record.\n\nThank you for helping us keep the handoff moving.',
    [field('secure_channel', 'Secure channel', 'your referral portal'), { key: 'referral_date', label: 'Referral date', type: 'date', required: true, sample: '2026-09-09' }, field('update_requested', 'Update needed', 'the anticipated review timeline and any outstanding documents')]),
  template('records', 'Secure records request', 'coordination', 'Coordinate a records transfer with another practice.', 'Records coordination — {{practice_name}}',
    'Our team is coordinating care with your office and would like to arrange a secure transfer of {{record_scope}}.\n\n{{authorization_status}}\n\nPlease use {{transfer_method}} for the documents and patient details. Let us know if your office needs a different request form.',
    [field('record_scope', 'Records requested', 'the relevant consultation notes'), field('authorization_status', 'Authorization status', 'We will confirm the required authorization before requesting release.'), field('transfer_method', 'Approved transfer method', 'our agreed secure records channel')]),
  template('handoff', 'Provider handoff', 'coordination', 'Arrange a clear transition between clinical teams.', 'Care transition coordination',
    'We are coordinating a transition to your team effective {{transition_date}}.\n\n{{coordination_request}}\n\nThe clinical summary and supporting documents will follow through {{secure_channel}}. Please confirm the best contact in your office for this handoff.',
    [{ key: 'transition_date', label: 'Transition date', type: 'date', required: true, sample: '2026-10-06' }, field('coordination_request', 'Coordination request', 'Could we arrange a brief clinician-to-clinician discussion before the transition?'), field('secure_channel', 'Secure channel', 'the approved secure portal')]),
  template('consult', 'Consultation request', 'care', 'Ask a colleague for a professional consultation.', 'Consultation availability — {{specialty}}',
    'Our team would appreciate the opportunity to consult with you regarding {{specialty}}.\n\nWould you have availability {{availability}}? We can share the relevant clinical context through an approved secure channel before the discussion.\n\nPlease let us know your preferred coordination process.',
    [field('specialty', 'Consultation area', 'collaborative medication management'), field('availability', 'Preferred timeframe', 'during the coming week')]),
  template('case-conference', 'Case conference invitation', 'care', 'Bring the care team together for a focused discussion.', 'Care team meeting — {{meeting_date}}',
    'We would like to invite you to a care coordination discussion on {{meeting_date}}.\n\n## Proposed agenda\n\n{{agenda}}\n\nPlease reply with your availability. We will share the meeting details and clinical information through {{secure_channel}}.',
    [{ key: 'meeting_date', label: 'Proposed date', type: 'date', required: true, sample: '2026-10-06' }, field('agenda', 'Agenda', 'Review shared care responsibilities and agree on next steps.'), field('secure_channel', 'Secure meeting channel', 'our approved clinical collaboration platform')]),
  template('availability', 'Referral availability update', 'announcements', 'Let a referring office know about current capacity.', 'Referral availability at {{practice_name}}',
    'A quick update for your referral team: {{availability_update}}\n\nOur current service focus is {{service_focus}}. Your office can coordinate referrals through {{referral_process}}.\n\nPlease contact us if you would like to discuss fit before submitting a referral.',
    [field('availability_update', 'Current capacity', 'We are accepting new referrals for initial consultations.'), field('service_focus', 'Services available', 'adult outpatient psychiatric care'), field('referral_process', 'Referral process', 'our secure referral portal')]),
  template('thank-you', 'Referral thank-you', 'outreach', 'Recognize a colleague’s trust in your practice.', 'Thank you for your collaboration',
    'Thank you for considering {{practice_name}} as a care partner. We appreciate the trust you place in our team.\n\n{{personal_note}}\n\nIf there is anything we can do to make referral coordination easier for your office, please let us know.',
    [field('personal_note', 'Personal note', 'Your team’s clear communication makes a meaningful difference in continuity of care.')]),
  template('partnership', 'Referral partnership', 'outreach', 'Explore a practical referral relationship.', 'Exploring a referral partnership',
    'I would like to connect about a potential referral relationship between our practices. Our team at {{practice_name}} provides {{services}}.\n\nWe would be interested in discussing referral criteria, coordination contacts, and how to keep both teams informed.\n\nWould {{next_step}} work for you?',
    [field('services', 'Services', 'outpatient psychiatric assessment and ongoing care'), field('next_step', 'Proposed next step', 'a 15-minute introductory conversation next week')]),
  template('office-update', 'Practice contact update', 'announcements', 'Keep partner practices up to date.', 'An update from {{practice_name}}',
    'We are writing to share an update for your team, effective {{effective_date}}.\n\n{{update_details}}\n\nPlease update your practice directory as appropriate. If you need assistance coordinating a referral, our team is available at {{practice_phone}}.',
    [{ key: 'effective_date', label: 'Effective date', type: 'date', required: true, sample: '2026-10-06' }, field('update_details', 'What is changing', 'Our referral coordination team is now the first point of contact for new referral inquiries.')]),
  template('meeting-recap', 'Meeting recap & next steps', 'care', 'Close the loop after a provider conversation.', 'Next steps from our conversation',
    'Thank you for taking the time to connect. Below are the coordination steps we agreed on.\n\n## Next steps\n\n{{next_steps}}\n\nWe plan to reconnect {{followup_window}}. Please reply if anything needs to be corrected or clarified. Clinical details will remain in the agreed secure channel.',
    [field('next_steps', 'Agreed actions', 'Our coordinator will confirm the referral process and share the appropriate contact details.'), field('followup_window', 'Follow-up timing', 'next week')]),
  template('coverage-question', 'Coverage coordination question', 'coordination', 'Ask a payer-facing team for the information needed to move care forward.', 'Coverage coordination question',
    'We are coordinating a referral and would appreciate your guidance on {{coverage_question}}.\n\nOur team is working from the approved secure record. Could you confirm {{requested_confirmation}} and let us know if any additional documentation is required?\n\nThank you for helping us avoid delays in care.',
    [field('coverage_question', 'Question for the team', 'the current benefit or authorization pathway'), field('requested_confirmation', 'Confirmation needed', 'the correct form and submission channel')]),
  template('consult-response', 'Consultation response', 'care', 'Reply to a colleague who requested clinical consultation.', 'Re: Consultation request',
    'Thank you for reaching out about {{specialty}}. We can support the consultation through {{consultation_format}}.\n\n{{availability_response}}\n\nPlease send any patient-specific information through the approved secure channel before our conversation.',
    [field('specialty', 'Consultation area', 'collaborative medication management'), field('consultation_format', 'Format', 'a brief clinician-to-clinician call'), field('availability_response', 'Availability response', 'I am available Tuesday afternoon or Thursday morning.')]),
  template('records-received', 'Records received confirmation', 'coordination', 'Confirm that another practice’s records arrived safely.', 'Records received — thank you',
    'This is a quick confirmation that we received {{record_scope}} through {{secure_channel}}.\n\nOur team will route the documents for review and reach out if anything else is needed. Thank you for the timely coordination.',
    [field('record_scope', 'Records received', 'the consultation note and medication list'), field('secure_channel', 'Secure channel', 'the approved records portal')]),
  template('records-missing', 'Missing records follow-up', 'coordination', 'Clarify what is still needed for a complete care handoff.', 'Follow-up on records for care coordination',
    'Thank you for the records sent on {{received_date}}. To complete the handoff, could you please send {{missing_items}} through {{secure_channel}}?\n\nIf those documents are not available, a brief note confirming that would also help our team close the request.',
    [{ key: 'received_date', label: 'Date received', type: 'date', required: true, sample: '2026-09-09' }, field('missing_items', 'Still needed', 'the latest treatment summary and current medication list'), field('secure_channel', 'Secure channel', 'the approved records portal')]),
  template('care-plan-update', 'Shared care plan update', 'care', 'Share a concise coordination update with a partner clinician.', 'Shared care plan update',
    'I am writing with a coordination update regarding {{care_area}}.\n\n{{care_update}}\n\nOur proposed next step is {{next_step}}. Please let us know if this aligns with your team’s plan so we can keep the record current.',
    [field('care_area', 'Care area', 'the shared behavioral health plan'), field('care_update', 'Update', 'The patient is engaging consistently with the agreed treatment plan.'), field('next_step', 'Proposed next step', 'a brief check-in after the next scheduled visit')]),
  template('discharge', 'Transition or discharge notice', 'care', 'Close the loop when a shared episode of care changes.', 'Care transition update',
    'We are writing to let you know that our team’s involvement in {{care_area}} will change on {{effective_date}}.\n\n{{transition_note}}\n\nPlease contact us through {{secure_channel}} if your team needs to coordinate the transition.',
    [field('care_area', 'Care area', 'the current episode of outpatient care'), { key: 'effective_date', label: 'Effective date', type: 'date', required: true, sample: '2026-10-06' }, field('transition_note', 'Transition note', 'The next phase of care will be coordinated with your office.'), field('secure_channel', 'Secure channel', 'the approved clinical channel')]),
  template('team-intro', 'New team member introduction', 'announcements', 'Introduce a new clinical or administrative contact to partner offices.', 'Please meet {{team_member}}',
    'We are pleased to introduce {{team_member}}, who is joining our team as {{team_role}}.\n\nThey will be helping with {{responsibilities}} and may reach out to your office as part of routine care coordination. Please update your contact list and let us know if you have any questions.',
    [field('team_member', 'Team member', 'Dr. Sam Rivera'), field('team_role', 'Role', 'a consulting psychiatrist'), field('responsibilities', 'Responsibilities', 'provider consultations and referral coordination')]),
  template('provider-onboarding', 'Provider onboarding checklist', 'outreach', 'Make the first operational handoff with a new referral partner easy.', 'Welcome — provider coordination details',
    'Welcome to our referral network. To make coordination straightforward, here are the details for {{practice_name}}.\n\n## Helpful details\n\n{{coordination_details}}\n\nFor patient-specific information, please use {{secure_channel}}. We look forward to working together.',
    [field('coordination_details', 'Coordination details', 'Our referral team responds within two business days and can help with fit, availability, and next steps.'), field('secure_channel', 'Secure channel', 'the approved referral portal')]),
  template('directory-update', 'Provider directory update request', 'announcements', 'Keep your practice directory accurate across partner offices.', 'Please update our practice details',
    'Could you please update your directory with the following information for {{practice_name}}?\n\n{{directory_changes}}\n\nIf your office maintains a separate referral list, we would appreciate the same update there. Thank you for helping colleagues reach the right team.',
    [field('directory_changes', 'Details to update', 'Our referral coordination email and current intake phone number')]),
  template('consult-thank-you', 'Consultation thank-you', 'outreach', 'Close a collegial consultation with a thoughtful note.', 'Thank you for your consultation',
    'Thank you for making time to discuss {{consultation_topic}}. Your perspective on {{specific_appreciation}} was especially helpful.\n\nWe appreciate the collaboration and will follow up through the secure record if any additional coordination is needed.',
    [field('consultation_topic', 'Topic', 'the shared care question'), field('specific_appreciation', 'What you appreciated', 'the practical recommendations for next steps')]),
  template('provider-roundtable', 'Provider roundtable invitation', 'outreach', 'Invite local clinicians to a small professional conversation.', 'Invitation: {{roundtable_topic}}',
    'We are hosting a small provider conversation about {{roundtable_topic}} on {{event_date}}.\n\nThe goal is {{event_goal}}. This is a professional discussion for colleagues, with no patient-specific information shared.\n\nPlease let us know by {{rsvp_date}} if you would like to join.',
    [{ key: 'event_date', label: 'Event date', type: 'date', required: true, sample: '2026-10-06' }, field('roundtable_topic', 'Discussion topic', 'practical approaches to collaborative care'), field('event_goal', 'Goal', 'to share approaches and build stronger referral relationships'), { key: 'rsvp_date', label: 'RSVP date', type: 'date', required: true, sample: '2026-09-26' }]),
  template('referral-triage', 'Referral fit confirmation', 'coordination', 'Clarify whether a referral is a fit before the formal handoff.', 'Referral fit confirmation request',
    'Thank you for considering our team for this referral. Before we proceed, could you confirm {{fit_question}}?\n\nOur current referral criteria include {{referral_criteria}}. If the referral is a fit, please use {{secure_channel}} for the next step. We are happy to coordinate with your team if another service would be a better match.',
    [field('fit_question', 'Question to confirm', 'the primary care need and preferred service'), field('referral_criteria', 'Current criteria', 'adult outpatient care with a need for ongoing psychiatric support'), field('secure_channel', 'Secure channel', 'the approved referral portal')]),
  template('referral-next-step', 'Referral next-step request', 'coordination', 'Ask for one clear action so a referral does not stall in someone’s inbox.', 'One next step for this referral',
    'Thank you for helping us coordinate this referral. To keep things moving, could your team {{next_action}} by {{requested_by}}?\n\n## What we have ready\n\n+ Referral context is in {{secure_channel}}\n+ Our coordinator is available for questions\n+ We will confirm the next handoff once this step is complete\n\nIf another person on your team owns this step, please point us in the right direction.',
    [{ key: 'next_action', label: 'Action requested', type: 'text', required: true, sample: 'confirm the receiving clinician and preferred appointment window' }, { key: 'requested_by', label: 'Requested by', type: 'date', required: true, sample: '2026-09-16' }, field('secure_channel', 'Secure channel', 'the approved referral portal')]),
  template('records-receipt', 'Records receipt confirmation', 'coordination', 'Confirm that a records transfer arrived and explain what happens next.', 'Records received — next steps',
    'This is a quick confirmation that we received {{record_scope}} through {{received_via}}.\n\n## Next steps\n\n1. Our team will route the documents for review\n2. We will add any follow-up questions to the secure record\n3. We will contact your office if anything else is needed\n\n{{followup_note}}',
    [field('record_scope', 'Records received', 'the consultation note and current medication list'), field('received_via', 'Received via', 'the approved records portal'), field('followup_note', 'Additional note', 'Thank you for sending these promptly; it helps us avoid delays in care.')]),
  template('referral-outcome', 'Referral outcome update', 'coordination', 'Close the loop with a referring office after the first outreach attempts.', 'Closing the loop on a referral',
    'We are writing with a brief status update on the referral received through {{secure_channel}}.\n\n> This message intentionally excludes patient-specific information. The current status is available in the secure referral record.\n\n{{outcome_summary}}\n\nPlease let us know if your team would like us to coordinate a different next step.',
    [field('secure_channel', 'Secure channel', 'the approved referral portal'), field('outcome_summary', 'Status summary', 'Our intake team connected with the patient and is coordinating the next available appointment.')]),
  template('consult-scheduling', 'Consultation scheduling options', 'care', 'Offer a few concrete times for a clinician-to-clinician conversation.', 'Consultation scheduling options',
    'Thank you for being open to a consultation about {{consultation_topic}}. Here are a few options for a {{duration}} conversation.\n\n| Option 1 | {{option_one}}\n| Option 2 | {{option_two}}\n| Option 3 | {{option_three}}\n\nPlease reply with the option that works best, or suggest another time. We will use {{secure_channel}} for any patient-specific context.',
    [field('consultation_topic', 'Consultation topic', 'collaborative medication management'), field('duration', 'Length', '20-minute'), field('option_one', 'Option 1', 'Tuesday at 2:00 PM'), field('option_two', 'Option 2', 'Wednesday at 11:30 AM'), field('option_three', 'Option 3', 'Thursday at 4:00 PM'), field('secure_channel', 'Secure channel', 'the approved clinical channel')]),
  template('care-team-update', 'Care team update', 'care', 'Share a concise update with the people responsible for the next phase of care.', 'A care coordination update',
    'I am writing with an update regarding {{care_area}}.\n\n{{care_update}}\n\n## Proposed next step\n\n+ {{next_step}}\n+ Please confirm who will own the follow-up\n+ We will revisit the plan on {{review_date}}\n\nPlease reply if this does not match your team’s understanding.',
    [field('care_area', 'Care area', 'the shared behavioral health plan'), field('care_update', 'Update', 'The patient is engaging consistently with the agreed treatment plan.'), field('next_step', 'Next step', 'a brief check-in after the next scheduled visit'), { key: 'review_date', label: 'Review date', type: 'date', required: true, sample: '2026-10-20' }]),
  template('shared-plan-confirmation', 'Shared plan confirmation', 'care', 'Document the agreed handoff in a clear, collegial note.', 'Confirming our shared care plan',
    'Thank you for the thoughtful conversation about {{care_topic}}. To make sure our teams are aligned, I have captured the plan below.\n\n+ {{agreed_plan}}\n+ Our team will handle {{our_role}}\n+ Your team will handle {{their_role}}\n\n> If any part of this summary is off, please reply and we will correct it. Patient-specific details should stay in {{secure_channel}}.',
    [field('care_topic', 'Care topic', 'the next phase of collaborative care'), field('agreed_plan', 'Agreed plan', 'Continue the current approach and share an update after the next visit.'), field('our_role', 'Our team will', 'send the coordination note through the secure record'), field('their_role', 'Their team will', 'confirm the follow-up appointment'), field('secure_channel', 'Secure channel', 'the approved clinical record')]),
  template('collaboration-checkin', 'Provider collaboration check-in', 'outreach', 'Reopen a useful professional relationship with a specific, low-pressure prompt.', 'Checking in from {{practice_name}}',
    'I wanted to check in after our previous conversation about {{shared_interest}}. We have since {{recent_update}} and thought it might be useful to reconnect.\n\nWould {{next_step}} be a reasonable way to continue the conversation? No pressure if the timing is not right.',
    [field('shared_interest', 'Shared interest', 'making behavioral health referrals easier for primary care teams'), field('recent_update', 'Recent update', 'refined our referral criteria and added a dedicated coordination contact'), field('next_step', 'Suggested next step', 'a short conversation sometime this month')]),
  template('holiday-hours', 'Holiday hours notice', 'announcements', 'Give partner offices a clean, forwardable notice about holiday coverage.', 'Holiday hours and referral coverage',
    'A quick scheduling note for your team: {{practice_name}} will have adjusted hours from {{start_date}} through {{end_date}}.\n\n| Office hours | {{office_hours}}\n| Referral coverage | {{coverage_plan}}\n| Urgent coordination | {{urgent_contact}}\n\nPlease share this with anyone in your office who coordinates referrals. We will return to our regular schedule on {{return_date}}.',
    [{ key: 'start_date', label: 'Starts', type: 'date', required: true, sample: '2026-12-24' }, { key: 'end_date', label: 'Ends', type: 'date', required: true, sample: '2026-12-26' }, field('office_hours', 'Office hours', 'Closed December 25; limited phone coverage on December 24 and 26'), field('coverage_plan', 'Referral coverage', 'New referrals will be reviewed on the next business day'), field('urgent_contact', 'Urgent coordination', 'Use the established secure channel'), { key: 'return_date', label: 'Regular schedule resumes', type: 'date', required: true, sample: '2026-12-29' }]),
  template('directory-refresh', 'Practice directory refresh', 'announcements', 'Make it easy for partner offices to update the details they rely on.', 'Please refresh our referral details',
    'Could you please confirm that your directory has the following current details for {{practice_name}}?\n\n+ Referral contact: {{referral_contact}}\n+ Phone: {{practice_phone}}\n+ Secure channel: {{secure_channel}}\n\nIf anything is out of date, please let us know what needs correcting and we will reply with the current information.',
    [field('referral_contact', 'Referral contact', 'Jordan Lee, Provider Relations Coordinator'), field('secure_channel', 'Secure channel', 'the approved referral portal')]),
];
/** The original provider-only export remains stable for focused consumers and tests. */
export const TEMPLATES: Template[] = PROVIDER_TEMPLATES;

/** The workspace combines the provider set with the patient and outreach catalogue. */
export const ALL_TEMPLATES: Template[] = [...CORE_TEMPLATES, ...PROVIDER_TEMPLATES];

/**
 * Keep the audience label honest when one category contains more than one
 * kind of message. In particular, the core care set is patient-facing while
 * provider care templates use the same category for clinical collaboration.
 */
export function audienceForTemplate(template: Pick<Template, 'id' | 'category' | 'bulk'>): string {
  if (template.bulk || template.category === 'marketing' || template.category === 'newsletter' || template.id === 'out-newsletter-invite') {
    return 'Patient outreach';
  }
  if (template.category === 'scheduling' || template.category === 'intake' || template.category === 'billing' || template.id.startsWith('care-')) {
    return 'Patient message';
  }
  if (template.category === 'outreach') return 'Provider relationship';
  if (template.category === 'care') return 'Care collaboration';
  if (template.category === 'coordination') return 'Clinical coordination';
  return 'Practice update';
}

export const byCategory = (category: Category): Template[] => ALL_TEMPLATES.filter(t => t.category === category);
export const search = (query: string): Template[] => {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_TEMPLATES;
  return ALL_TEMPLATES.filter(t => [t.name, t.description, t.body].some(value => value.toLowerCase().includes(q)));
};

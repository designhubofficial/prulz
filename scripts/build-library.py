# -*- coding: utf-8 -*-
"""
Authors src/library/templates.json.

The bodies are written here rather than hand-edited as JSON so the block
syntax stays readable and the escaping stays correct. Run after editing:

    python scripts/build-library.py
"""
import json, io, os
from collections import Counter

T = []


def t(id, name, cat, desc, bulk, theme, pal, pre, fields, body):
    T.append(dict(id=id, name=name, category=cat, description=desc, bulk=bulk,
                  theme=theme, palette=pal, preheader=pre, fields=fields,
                  body=body.strip("\n")))


def f(k, l, ty="text", req=True, sample="", options=None, help=None):
    d = {"key": k, "label": l, "type": ty, "required": req}
    if sample:
        d["sample"] = sample
    if options:
        d["options"] = options
    if help:
        d["help"] = help
    return d


# Curated stock photos (Unsplash CDN, free to use). These seed the image
# fields; the VA replaces them from the in-app stock picker or pastes any
# hosted URL. Each URL was verified to serve image/jpeg. One consistent
# 12:7 banner crop (with face detection) keeps portrait sources from
# rendering as awkwardly tall heroes.
def ux(id, faces=False):
    crop = "&crop=faces" if faces else ""
    return "https://images.unsplash.com/%s?q=80&w=1200&h=700&auto=format&fit=crop%s" % (id, crop)


PHOTO_FOREST = ux("photo-1441974231531-c6227db76b6e")
PHOTO_MISTY = ux("photo-1470071459604-3b5ec3a7fe05")
PHOTO_MOUNTAIN = ux("photo-1506905925346-21bda4d32df4")
PHOTO_BEACH = ux("photo-1507525428034-b723cf961d3e")
PHOTO_MEDITATE = ux("photo-1506126613408-eca07ce68773")
PHOTO_WOMAN = ux("photo-1494790108377-be9c29b29330")
PHOTO_PROFESSIONAL = ux("photo-1573496359142-b8d87734a5a2", True)
PHOTO_TEAM = ux("photo-1522071820081-009f0129c71c")
PHOTO_COLLEAGUES = ux("photo-1521737711867-e3b97375f902")
PHOTO_DESK = ux("photo-1499750310107-5fef28a66643")
PHOTO_JOURNAL = ux("photo-1517842645767-c639042777db")
PHOTO_GRADIENT = ux("photo-1557683316-973673baf926")


def fphoto(key, label, sample, help="Paste a hosted photo URL or pick one from the library. Recipients need internet to load it."):
    return f(key, label, "image", sample=sample, help=help)


def falt(key, label, sample):
    return f(key, label, sample=sample,
             help="Shown when images are blocked. Describe what the photo shows.")


# ------------------------------------------------------------- MARKETING
t("mkt-new-service", "New service announcement", "marketing",
  "Introduce a new service line to your existing patient list.", True, "beacon", "ocean",
  "Something new at {{practice_name}} - now booking.",
  [f("service_name", "Service name", sample="Group therapy"),
   f("service_summary", "One-line summary", sample="Weekly small-group sessions for adults managing anxiety"),
   f("benefit_1", "Benefit 1", sample="Meets weekly on Tuesday evenings"),
   f("benefit_2", "Benefit 2", sample="Covered by most major insurance plans"),
   f("benefit_3", "Benefit 3", sample="Led by a licensed clinician"),
   f("start_date", "Starts on", "date", sample="2026-10-06"),
   fphoto("photo_url", "Photo", PHOTO_TEAM),
   falt("photo_alt", "Photo description (alt text)", "A small group gathered around a table, in conversation"),
   f("quote_text", "What a patient said", sample="I was nervous about group therapy at first. It became the most validating hour of my week."),
   f("quote_name", "Who said it", sample="Current group member")],
  """
Subject: Now offering {{service_name}} at {{practice_name}}
~ New service
# {{service_name}}

Hi {{first_name}},

{{service_summary}}. Enrollment is open now, with the first session on {{start_date}}.

[Image: {{photo_url}} | {{photo_alt}}]

## What to expect

- {{benefit_1}}
- {{benefit_2}}
- {{benefit_3}}

[Quote: {{quote_text}} | {{quote_name}}]

> Not sure whether it is a fit? Reply to this email and we will talk it through, no commitment.

[Button: See availability | {{booking_url}}]

@ {{sender_name}} | {{sender_title}} | {{practice_email}}
""")

t("mkt-reengagement", "Win-back / re-engagement", "marketing",
  "Reach a patient who has not been seen in a while. Warm, not pushy.", True, "ledger", "forest",
  "It has been a while - the door is still open.",
  [f("months_since", "Months since last visit", sample="eight"),
   fphoto("photo_url", "Photo", PHOTO_FOREST),
   falt("photo_alt", "Photo description (alt text)", "Sunlight filtering through the trees of a quiet forest")],
  """
Subject: Checking in from {{practice_name}}
# It has been a while

Hi {{first_name}},

We noticed it has been about {{months_since}} months since your last visit. No pressure at all, we just wanted you to know the door is open whenever you are ready.

[Image: {{photo_url}} | {{photo_alt}}]

If anything has changed, or you would like to pick back up where you left off, booking takes about a minute.

[Button: Book a visit | {{booking_url}}]

If you would rather not hear from us, you can unsubscribe below and we will leave you be.

@ {{sender_name}} | {{sender_title}} | {{practice_phone}}
""")

t("mkt-open-slots", "Open appointment slots", "marketing",
  "Fill near-term gaps in the schedule without sounding desperate.", True, "signal", "ocean",
  "A few openings the week of {{week_of}}.",
  [f("week_of", "Week of", "date", sample="2026-09-14"),
   f("slot_summary", "Availability summary", sample="Tuesday and Thursday mornings"),
   fphoto("photo_url", "Photo", PHOTO_MISTY),
   falt("photo_alt", "Photo description (alt text)", "Soft morning light over quiet hills")],
  """
Subject: Openings the week of {{week_of}}
~ Availability
# A few spots have opened up

Hi {{first_name}},

We have {{slot_summary}} open the week of {{week_of}}. If you have been meaning to get on the calendar, this is an easy week to do it.

[Image: {{photo_url}} | {{photo_alt}}]

[Button: Grab a time | {{booking_url}}]

@ {{sender_name}} | {{practice_name}} | {{practice_phone}}
""")

t("mkt-referral-ask", "Ask for a referral or review", "marketing",
  "Invite a satisfied patient to refer someone or leave a review.", True, "plain", "graphite",
  "A small favour, if you have a minute.",
  [f("review_url", "Review link", "url", sample="https://example.com/review")],
  """
Subject: Would you tell someone about us?
# A small ask

Hi {{first_name}},

If your care with us has been helpful, the kindest thing you can do is tell someone who might need it too, or leave a short review.

It takes a minute and it genuinely helps people find care.

[Button: Leave a review | {{review_url}}]

Either way, thank you for trusting us.

@ {{sender_name}} | {{practice_name}}
""")

t("mkt-event", "Event or webinar invitation", "marketing",
  "Promote a talk, workshop, or community event.", True, "beacon", "plum",
  "{{event_name}} on {{event_date}}.",
  [f("event_name", "Event name", sample="Managing Anxiety: A Practical Workshop"),
   f("event_date", "Date", "date", sample="2026-10-15"),
   f("event_time", "Time", "time", sample="18:00"),
   f("event_location", "Location or link", sample="Online, link sent after registration"),
   f("speaker_name", "Speaker", sample="Dr. Sam Whitfield"),
   fphoto("photo_url", "Photo", PHOTO_PROFESSIONAL),
   falt("photo_alt", "Photo description (alt text)", "A speaker presenting to a small, attentive audience"),
   f("register_url", "Registration link", "url", sample="https://example.com/register")],
  """
Subject: You are invited - {{event_name}}
~ You are invited
# {{event_name}}
### With {{speaker_name}}

Hi {{first_name}},

Join us on {{event_date}} at {{event_time}}. Seats are free but limited, and we will send a reminder the day before.

[Image: {{photo_url}} | {{photo_alt}} | With {{speaker_name}}]

| When | {{event_date}} at {{event_time}}
| Where | {{event_location}}
| Cost | Free

[Button: Save your seat | {{register_url}}]

@ {{sender_name}} | {{practice_name}}
""")

t("mkt-seasonal", "Seasonal / awareness campaign", "marketing",
  "Tie a message to an awareness month or seasonal theme.", True, "pulse", "ember",
  "{{campaign_theme}} - and what it means for you.",
  [f("campaign_theme", "Campaign theme", sample="Mental Health Awareness Month"),
   f("campaign_point_1", "Point 1", sample="Screening is quick, free, and confidential"),
   f("campaign_point_2", "Point 2", sample="Most people wait years before asking for help"),
   f("campaign_point_3", "Point 3", sample="Starting is easier than people expect"),
   fphoto("photo_url", "Photo", PHOTO_FOREST),
   falt("photo_alt", "Photo description (alt text)", "A quiet path through the woods in soft morning light")],
  """
Subject: {{campaign_theme}}
~ {{campaign_theme}}
# Worth a few minutes of your time

Hi {{first_name}},

This month we are talking about something that matters to a lot of our patients.

[Image: {{photo_url}} | {{photo_alt}}]

- {{campaign_point_1}}
- {{campaign_point_2}}
- {{campaign_point_3}}

> If any of this lands close to home, reaching out is not a big step. A first conversation is just a conversation.

[Button: Talk to someone | {{booking_url}}]

@ {{sender_name}} | {{practice_name}}
""")

# ------------------------------------------------------------ NEWSLETTER
t("news-monthly", "Monthly newsletter", "newsletter",
  "The standard monthly round-up: a lead story, a few links, one call to action.", True, "ledger", "ocean",
  "{{month}} at {{practice_name}} - {{lead_headline}}.",
  [f("month", "Month", sample="September"),
   f("lead_headline", "Lead story headline", sample="Welcoming two new clinicians"),
   f("lead_body", "Lead story", sample="We have grown by two this month, which means shorter waits for new patients."),
   f("item_1", "Item 1", sample="**New evening hours** on Tuesdays and Thursdays."),
   f("item_2", "Item 2", sample="**Insurance update** - we now accept two additional plans."),
   f("item_3", "Item 3", sample="**A short read** on sleep and mood, from our blog."),
   fphoto("photo_url", "Photo", PHOTO_TEAM),
   falt("photo_alt", "Photo description (alt text)", "The care team at work together"),
   f("photo_caption", "Photo caption", sample="What changed this month, at a glance")],
  """
Subject: {{month}} at {{practice_name}}
~ {{month}} Newsletter
# {{lead_headline}}

Hi {{first_name}},

{{lead_body}}

[Image: {{photo_url}} | {{photo_alt}} | {{photo_caption}}]

## Also this month

- {{item_1}}
- {{item_2}}
- {{item_3}}

---

[Button: Book a visit | {{booking_url}}]

As always, you can reply to this email and a person will read it.

@ {{sender_name}} | {{sender_title}} | {{practice_name}}
""")

t("news-practice-update", "Practice update round-up", "newsletter",
  "Short operational round-up: hours, staffing, policies.", True, "stack", "graphite",
  "Three quick updates from {{practice_name}}.",
  [f("update_1_title", "Update 1 title", sample="Extended hours"),
   f("update_1_body", "Update 1", sample="We are open until 7pm on Tuesdays starting this month."),
   f("update_2_title", "Update 2 title", sample="New patient portal"),
   f("update_2_body", "Update 2", sample="Forms, messages, and statements now live in one place."),
   f("update_3_title", "Update 3 title", sample="Parking"),
   f("update_3_body", "Update 3", sample="The north lot is open again after construction.")],
  """
Subject: Three quick updates
~ Practice update
# What changed this month

Hi {{first_name}},

Short one this time, three things worth knowing.

## {{update_1_title}}

{{update_1_body}}

## {{update_2_title}}

{{update_2_body}}

## {{update_3_title}}

{{update_3_body}}

@ {{sender_name}} | {{practice_name}} | {{practice_phone}}
""")

t("news-provider-spotlight", "Provider spotlight", "newsletter",
  "Introduce a clinician to the patient list. Builds trust before the first visit.", True, "ledger", "forest",
  "Meet {{provider_name}}, now accepting new patients.",
  [f("provider_name", "Provider name", sample="Dr. Rosa Iyer"),
   f("provider_credentials", "Credentials", sample="MD"),
   f("provider_focus", "Clinical focus", sample="anxiety, ADHD, and perinatal mental health"),
   f("provider_bio", "Short bio", sample="Rosa joined us after eight years in community health and is happiest doing the unglamorous work of getting a plan right."),
   fphoto("photo_url", "Photo", PHOTO_PROFESSIONAL),
   falt("photo_alt", "Photo description (alt text)", "Portrait of the new clinician")],
  """
Subject: Meet {{provider_name}}
~ Provider spotlight
# Meet {{provider_name}}

Hi {{first_name}},

[Feature: {{photo_url}} | {{photo_alt}} | New to the practice | {{provider_bio}}]

Their work focuses on {{provider_focus}}.

> {{provider_name}} is accepting new patients now, with shorter waits than our established clinicians.

[Button: Book with {{provider_name}} | {{booking_url}}]

@ {{sender_name}} | {{practice_name}}
""")

t("news-education", "Patient education piece", "newsletter",
  "A short educational note. Useful, not salesy.", True, "plain", "ocean",
  "{{topic}} - the short version.",
  [f("topic", "Topic", sample="Sleep and mood"),
   f("takeaway_1", "Takeaway 1", sample="Sleep and mood move together; fixing one often helps the other."),
   f("takeaway_2", "Takeaway 2", sample="A consistent wake time matters more than a consistent bedtime."),
   f("takeaway_3", "Takeaway 3", sample="If it has been more than a month, it is worth mentioning at your next visit."),
   fphoto("photo_url", "Photo", PHOTO_FOREST),
   falt("photo_alt", "Photo description (alt text)", "Soft morning light through the trees")],
  """
Subject: {{topic}}
~ Worth knowing
# {{topic}}

Hi {{first_name}},

A short, practical read this month.

[Image: {{photo_url}} | {{photo_alt}}]

1. {{takeaway_1}}
2. {{takeaway_2}}
3. {{takeaway_3}}

> This is general information, not medical advice for your situation. Bring it up with your clinician if it applies to you.

@ {{sender_name}} | {{practice_name}}
""")

t("news-year-review", "Year in review", "newsletter",
  "Annual round-up with a few numbers and a thank-you.", True, "beacon", "plum",
  "A year of {{practice_name}}, by the numbers.",
  [f("year", "Year", sample="2026"),
   f("stat_1_value", "Stat 1 value", sample="4,200"), f("stat_1_label", "Stat 1 label", sample="Visits"),
   f("stat_2_value", "Stat 2 value", sample="12"), f("stat_2_label", "Stat 2 label", sample="Clinicians"),
   f("stat_3_value", "Stat 3 value", sample="6 days"), f("stat_3_label", "Stat 3 label", sample="Average wait"),
   fphoto("photo_url", "Photo", PHOTO_MISTY),
   falt("photo_alt", "Photo description (alt text)", "A quiet, hopeful landscape"),
   f("closing_note", "Closing note", sample="Thank you for trusting us with your care this year.")],
  """
Subject: {{year}} at {{practice_name}}
~ Year in review
# Thank you for a good year

Hi {{first_name}},

A quick look back at {{year}} - and a genuine thank you for being part of it.

[Image: {{photo_url}} | {{photo_alt}}]

## By the numbers

[Stat: {{stat_1_value}} | {{stat_1_label}}]
[Stat: {{stat_2_value}} | {{stat_2_label}}]
[Stat: {{stat_3_value}} | {{stat_3_label}}]

{{closing_note}}

---

Here is to the year ahead.

@ {{sender_name}} | {{sender_title}} | {{practice_name}}
""")

# ------------------------------------------------------------ SCHEDULING
t("sch-confirmation", "Appointment confirmation", "scheduling",
  "Sent immediately after booking. Confirms the details in writing.", False, "signal", "ocean",
  "Your appointment on {{appt_date}} is confirmed.",
  [f("appt_date", "Appointment date", "date", sample="2026-09-15"),
   f("appt_time", "Appointment time", "time", sample="14:30"),
   f("provider_name", "Provider", sample="Dr. Rosa Iyer"),
   f("visit_type", "Visit type", sample="Telehealth"),
   f("visit_location", "Location or link", sample="A join link arrives 15 minutes before")],
  """
Subject: Confirmed - {{appt_date}} at {{appt_time}}
~ Appointment confirmed
# You are on the calendar

Hi {{first_name}},

Your appointment is confirmed. Here are the details.

| When | {{appt_date}} at {{appt_time}}
| Who | {{provider_name}}
| Type | {{visit_type}}
| Where | {{visit_location}}

> Need to change it? Call {{practice_phone}} at least 24 hours ahead so we can offer the slot to someone else.

@ {{sender_name}} | {{sender_title}} | {{practice_phone}}
""")

t("sch-reminder", "Appointment reminder", "scheduling",
  "Sent 24 to 48 hours before the visit.", False, "plain", "ocean",
  "Coming up: {{appt_time}} with {{provider_name}}.",
  [f("appt_date", "Appointment date", "date", sample="2026-09-15"),
   f("appt_time", "Appointment time", "time", sample="14:30"),
   f("provider_name", "Provider", sample="Dr. Rosa Iyer"),
   f("prep_note", "Anything to bring or do", sample="Bring your insurance card and a list of current medications.")],
  """
Subject: Reminder - {{appt_date}} at {{appt_time}}
# A quick reminder

Hi {{first_name}},

You are booked with {{provider_name}} on {{appt_date}} at {{appt_time}}.

{{prep_note}}

If you cannot make it, please call {{practice_phone}} as soon as you can.

@ {{practice_name}} | {{practice_phone}}
""")

t("sch-reschedule", "Reschedule offer", "scheduling",
  "When the practice needs to move an appointment.", False, "signal", "ember",
  "We need to move your {{original_date}} appointment.",
  [f("original_date", "Original date", "date", sample="2026-09-15"),
   f("reason", "Reason", sample="your clinician is unexpectedly out that day")],
  """
Subject: Rescheduling your {{original_date}} appointment
# We need to move your appointment

Hi {{first_name}},

I am sorry for the short notice. We need to move your appointment on {{original_date}} because {{reason}}.

You can pick a new time that works for you, or call us and we will find one together.

[Button: Choose a new time | {{booking_url}}]

Apologies for the disruption.

@ {{sender_name}} | {{sender_title}} | {{practice_phone}}
""")

t("sch-cancellation", "Cancellation acknowledgement", "scheduling",
  "Confirms a cancellation and leaves the door open.", False, "plain", "graphite",
  "Your {{appt_date}} appointment is cancelled.",
  [f("appt_date", "Appointment date", "date", sample="2026-09-15")],
  """
Subject: Cancelled - {{appt_date}}
# Appointment cancelled

Hi {{first_name}},

Your appointment on {{appt_date}} has been cancelled, and there is nothing further you need to do.

Whenever you are ready to rebook, we are here.

[Button: Book another time | {{booking_url}}]

@ {{practice_name}} | {{practice_phone}}
""")

t("sch-noshow", "Missed appointment follow-up", "scheduling",
  "After a no-show. Neutral in tone; assumes good faith.", False, "plain", "ocean",
  "We missed you on {{appt_date}}.",
  [f("appt_date", "Missed date", "date", sample="2026-09-15"),
   f("policy_note", "Policy note", sample="Missed visits without 24 hours notice may carry a fee.")],
  """
Subject: We missed you on {{appt_date}}
# Sorry we missed you

Hi {{first_name}},

You were on the calendar for {{appt_date}} and we did not see you. Things come up, we would just like to get you rebooked.

{{policy_note}}

[Button: Rebook | {{booking_url}}]

@ {{sender_name}} | {{practice_name}} | {{practice_phone}}
""")

t("sch-waitlist", "Waitlist opening", "scheduling",
  "A slot has opened for someone waiting. Time-sensitive.", False, "pulse", "forest",
  "A {{slot_date}} slot just opened.",
  [f("slot_date", "Slot date", "date", sample="2026-09-11"),
   f("slot_time", "Slot time", "time", sample="09:00"),
   f("hold_hours", "Hours held", sample="24")],
  """
Subject: A spot opened on {{slot_date}}
~ Waitlist
# A slot just opened

Hi {{first_name}},

You asked to be told if something opened sooner. We have {{slot_date}} at {{slot_time}}.

> We can hold it for {{hold_hours}} hours, then it goes back to the general schedule.

[Button: Take this slot | {{booking_url}}]

@ {{sender_name}} | {{practice_phone}}
""")

t("sch-request", "Appointment request received", "scheduling",
  "Confirms a booking request from a call or message, and sets a deadline for hearing back.",
  False, "plain", "ocean",
  "We received your request for an appointment.",
  [f("visit_reason", "What the visit is for", sample="a medication check-in"),
   f("hear_back", "When to expect a confirmed time", sample="within one business day")],
  """
Subject: We received your appointment request
~ Appointment request
# Thanks — we are on it

Hi {{first_name}},

We received your request for an appointment for {{visit_reason}}. The calendar is being checked now, and we will send you a confirmed time {{hear_back}}.

If you have not heard from us by then, call {{practice_phone}} — that usually means a message went astray, not that we are ignoring it.

@ {{sender_name}} | {{sender_title}} | {{practice_phone}}
""")

t("sch-missed-call", "We tried to reach you", "scheduling",
  "Follows a missed call or an unanswered return call. One ask: a good time to ring back.",
  False, "signal", "graphite",
  "We tried to reach you about {{callback_topic}}.",
  [f("callback_topic", "What it was about", sample="your upcoming appointment"),
   f("best_time", "A good time to call back", sample="any weekday before 3 pm")],
  """
Subject: We tried to reach you
~ Missed call
# We tried to reach you

Hi {{first_name}},

We called about {{callback_topic}} and could not get through. Nothing is wrong — we would rather ask you directly than leave it at a voicemail.

You can call us back at {{practice_phone}}, or reply to this email with a time that suits you and we will ring then. {{best_time}} works well for us.

If you have already sorted it out, no need to call back at all.

@ {{sender_name}} | {{sender_title}} | {{practice_phone}}
""")

# ---------------------------------------------------------------- INTAKE
t("int-welcome", "New patient welcome", "intake",
  "First email after a new patient books. Sets expectations.", False, "beacon", "ocean",
  "Welcome to {{practice_name}} - here is what happens next.",
  [f("first_visit_date", "First visit", "date", sample="2026-09-22"),
   f("provider_name", "Provider", sample="Dr. Rosa Iyer"),
   f("forms_url", "Intake forms link", "url", sample="https://example.com/forms")],
  """
Subject: Welcome to {{practice_name}}
~ Welcome
# We are glad you are here

Hi {{first_name}},

You are booked with {{provider_name}} on {{first_visit_date}}. Here is what happens between now and then.

1. Complete your intake forms, about 15 minutes
2. We verify your insurance and let you know what to expect for cost
3. You come in, and the first visit is mostly conversation

[Button: Start your forms | {{forms_url}}]

> Nothing on the forms is a test. Answer what you can, and your clinician will fill in the rest with you.

@ {{sender_name}} | {{sender_title}} | {{practice_phone}}
""")

t("int-forms", "Intake packet delivery", "intake",
  "Sends the forms with a clear deadline.", False, "signal", "ocean",
  "Your intake forms, about 15 minutes.",
  [f("forms_url", "Forms link", "url", sample="https://example.com/forms"),
   f("due_date", "Complete by", "date", sample="2026-09-20")],
  """
Subject: Your intake forms
# A few forms before your first visit

Hi {{first_name}},

Please complete these before {{due_date}} so your clinician has time to read them.

[Button: Open your forms | {{forms_url}}]

It takes about 15 minutes. You can save and come back to it.

If anything is confusing, call {{practice_phone}} and we will walk through it.

@ {{sender_name}} | {{sender_title}}
""")

t("int-missing-forms", "Missing paperwork nudge", "intake",
  "Gentle follow-up when forms are incomplete.", False, "plain", "ember",
  "Still need your forms before {{appt_date}}.",
  [f("appt_date", "Appointment date", "date", sample="2026-09-22"),
   f("forms_url", "Forms link", "url", sample="https://example.com/forms")],
  """
Subject: Still need your forms
# One thing outstanding

Hi {{first_name}},

Your visit is on {{appt_date}} and we do not have your completed forms yet.

[Button: Finish your forms | {{forms_url}}]

If you have hit a snag, reply here or call {{practice_phone}}. We can take it over the phone instead.

@ {{sender_name}} | {{practice_name}}
""")

t("int-insurance-card", "Insurance card request", "intake",
  "Requests insurance details before the first visit.", False, "plain", "ocean",
  "We need your insurance details to check your benefits.",
  [f("upload_url", "Upload link", "url", sample="https://example.com/upload")],
  """
Subject: Your insurance details
# One more thing before your visit

Hi {{first_name}},

To check your benefits ahead of time, we need a photo of the front and back of your insurance card.

[Button: Upload your card | {{upload_url}}]

Once we have it we will confirm your expected cost before you come in, so there are no surprises.

@ {{sender_name}} | {{sender_title}} | {{practice_phone}}
""")

t("int-telehealth", "Telehealth visit instructions", "intake",
  "How to join, what to check, what to do if it fails.", False, "stack", "forest",
  "How to join your {{appt_date}} video visit.",
  [f("appt_date", "Appointment date", "date", sample="2026-09-22"),
   f("appt_time", "Appointment time", "time", sample="14:30"),
   f("join_url", "Join link", "url", sample="https://example.com/visit/abc")],
  """
Subject: Joining your video visit on {{appt_date}}
~ Telehealth
# How to join

Hi {{first_name}},

Your video visit is {{appt_date}} at {{appt_time}}.

[Button: Join your visit | {{join_url}}]

## Before you start

+ Use Chrome, Safari, or Edge on a device with a camera
+ Find a private spot with a steady connection
+ Join a few minutes early so we can sort out any audio trouble

> If the video will not connect, call {{practice_phone}} and we will switch to phone. You will not lose your appointment.

@ {{sender_name}} | {{practice_name}}
""")

# ---------------------------------------------------------- CARE FOLLOW-UP
t("care-lab-results", "Lab results ready", "care",
  "Tells a patient their results are ready and how they will be shared. Carries no results in the email itself.",
  False, "signal", "forest",
  "Your lab results are in — we will walk you through them.",
  [f("sample_date", "When the sample was taken", "date", sample="2026-09-04"),
   f("share_method", "How results will be shared", "choice", sample="phone",
     options=["secure message", "phone", "the patient portal"])],
  """
Subject: Your lab results are ready
~ Lab results
# Your results are in

Hi {{first_name}},

The results from your lab work on {{sample_date}} are back. This email deliberately does not include them — we will go over them with you by {{share_method}}.

If anything needs attention, a member of your care team will reach out to you directly. Otherwise, questions can go to {{practice_phone}}.

@ {{sender_name}} | {{sender_title}} | {{practice_phone}}
""")

t("care-refill", "Refill request update", "care",
  "Confirms a refill request from a call or message, and states exactly where it stands.",
  False, "plain", "ocean",
  "Where your refill stands.",
  [f("med_name", "Medication", sample="your blood pressure medication"),
   f("refill_status", "Where it stands", "choice", sample="with your pharmacy",
     options=["with your pharmacy", "with your provider for approval",
              "on hold — the prescription needs renewing"]),
   f("ready_by", "When it should be ready", sample="by the end of the day")],
  """
Subject: Your refill request
~ Refill update
# About your refill

Hi {{first_name}},

Your request for {{med_name}} is {{refill_status}}. It should be ready {{ready_by}}.

If the pharmacy cannot fill it, they will call us — you do not have to chase anything. If you have not heard from either of us by then, call {{practice_phone}} and we will find out what happened.

@ {{sender_name}} | {{sender_title}} | {{practice_name}}
""")

t("care-question", "Question relayed to the care team", "care",
  "Confirms that a clinical question from a call or message is with the right person, and when to expect an answer.",
  False, "ledger", "forest",
  "Your question has been passed along.",
  [f("question_summary", "The question, in one line", sample="whether a new symptom needs an earlier visit"),
   f("answer_window", "When to expect an answer", sample="by the end of the day")],
  """
Subject: Your question has been passed along
~ We heard you
# Your question is with the care team

Hi {{first_name}},

Thanks for asking about {{question_summary}}. I have passed it to the care team, and someone will get back to you {{answer_window}} by phone or secure message.

If you need an answer sooner, call {{practice_phone}} and ask for the front desk.

@ {{sender_name}} | {{sender_title}} | {{practice_name}}
""")

t("care-referral-status", "Referral status update", "care",
  "Tells a patient where their referral stands and what happens next.",
  False, "ledger", "ocean",
  "Where your referral stands.",
  [f("specialty", "Referred to", sample="the gastroenterology clinic"),
   f("referral_status", "Where it stands", "choice", sample="has been sent",
     options=["has been sent", "has been accepted", "is booked"]),
   f("next_step", "What happens next", sample="the clinic will call to schedule your visit")],
  """
Subject: Update on your referral
~ Referral update
# Your referral

Hi {{first_name}},

Here is where your referral to {{specialty}} stands: it {{referral_status}}.

{{next_step}}

If you would like us to check on it, call {{practice_phone}} — happy to chase it for you.

@ {{sender_name}} | {{sender_title}} | {{practice_name}}
""")

t("care-work-note", "Work or school note", "care",
  "Confirms a work or school note request from a call or message, and how it will be delivered.",
  False, "plain", "forest",
  "We are on it — your note is in progress.",
  [f("note_for", "For", "choice", sample="work", options=["work", "school"]),
   f("dates_needed", "Dates it should cover", sample="Monday through Wednesday"),
   f("deliver_to", "Where to send it", sample="a fax number or address you provide"),
   f("ready_by", "When it will be sent", sample="within one business day")],
  """
Subject: Your {{note_for}} note
~ Note request
# Your {{note_for}} note

Hi {{first_name}},

We received your request for a note for {{note_for}} covering {{dates_needed}}. A member of the care team is preparing it now.

We will send it to {{deliver_to}} {{ready_by}}. If those dates change, call {{practice_phone}} and we will adjust it.

@ {{sender_name}} | {{sender_title}} | {{practice_name}}
""")

# --------------------------------------------------------------- BILLING
t("bil-benefits", "Benefits verification result", "billing",
  "Explains what insurance will and will not cover, in plain language.", False, "ledger", "graphite",
  "What your plan covers for your visit.",
  [f("plan_name", "Insurance plan", sample="Example Health PPO"),
   f("copay_amount", "Copay", "money", sample="35"),
   f("deductible_remaining", "Deductible remaining", "money", sample="450"),
   f("coverage_note", "Note", sample="Your plan covers visits at 80% once the deductible is met.")],
  """
Subject: What your plan covers
~ Benefits check
# We checked your coverage

Hi {{first_name}},

We heard back from {{plan_name}}. Here is what to expect.

| Plan | {{plan_name}}
| Copay per visit | {{copay_amount}}
| Deductible remaining | {{deductible_remaining}}

{{coverage_note}}

> This is an estimate from your insurer, not a guarantee. Final cost depends on how the claim processes.

Questions? Call {{practice_phone}}.

@ {{sender_name}} | {{sender_title}}
""")

t("bil-prior-auth", "Prior authorization update", "billing",
  "Status update on a pending prior authorization.", False, "plain", "ocean",
  "An update on your prior authorization.",
  [f("auth_status", "Status", "choice", options=["submitted", "approved", "denied"], sample="submitted"),
   f("submitted_date", "Submitted on", "date", sample="2026-09-08"),
   f("next_step", "Next step", sample="We expect a decision within 5 business days and will call you as soon as we hear.")],
  """
Subject: Prior authorization - {{auth_status}}
# Where things stand

Hi {{first_name}},

Your prior authorization was {{auth_status}} as of {{submitted_date}}.

{{next_step}}

You do not need to do anything right now. We are tracking it.

@ {{sender_name}} | {{sender_title}} | {{practice_phone}}
""")

t("bil-statement", "Statement reminder", "billing",
  "Balance reminder. Firm but not aggressive.", False, "plain", "graphite",
  "A balance of {{balance_amount}} on your account.",
  [f("balance_amount", "Balance", "money", sample="120"),
   f("due_date", "Due by", "date", sample="2026-09-30"),
   f("pay_url", "Payment link", "url", sample="https://example.com/pay")],
  """
Subject: A balance on your account
# Account balance

Hi {{first_name}},

Your account shows a balance of {{balance_amount}}, due {{due_date}}.

[Button: Pay online | {{pay_url}}]

> If the timing is difficult, call {{practice_phone}} and ask about a payment plan. We would rather set one up than have you avoid care.

@ {{practice_name}} | {{practice_phone}}
""")

t("bil-superbill", "Superbill delivery", "billing",
  "Sends a superbill for out-of-network reimbursement.", False, "plain", "ocean",
  "Your superbill for {{service_period}}.",
  [f("service_period", "Service period", sample="August 2026")],
  """
Subject: Your superbill for {{service_period}}
# Superbill attached

Hi {{first_name}},

Attached is your superbill for {{service_period}}. Submit it to your insurer for out-of-network reimbursement.

## How to submit

1. Sign in to your insurer's member portal
2. Find "submit a claim" or "out-of-network reimbursement"
3. Upload this document and follow the prompts

Reimbursement timing is up to your plan, usually a few weeks.

@ {{sender_name}} | {{sender_title}} | {{practice_phone}}
""")

# ---------------------------------------------------------- COORDINATION
t("crd-referral-ack", "Referral acknowledgement", "coordination",
  "Confirms receipt of a referral to the referring provider. Colleague to colleague.", False, "ledger", "ocean",
  "We received your referral and have started outreach.",
  [f("referring_provider", "Referring provider", sample="Dr. Ana Petrov"),
   f("referral_date", "Referral received", "date", sample="2026-09-08"),
   f("attempts", "Outreach attempts", sample="three")],
  """
Subject: Referral received - thank you
~ Referral received
# Thank you for the referral

Dear {{referring_provider}},

We received your referral on {{referral_date}} and have started outreach.

## What happens next

Our team will attempt contact by phone and email, up to {{attempts}} times. We will write back with one of three outcomes.

1. Scheduled
2. Unable to reach after our attempts
3. Declined services

> On provider matching, we will do our best to honour your preferred clinician. If their wait is long, we will offer someone with comparable training and tell you who.

@ {{sender_name}} | {{sender_title}} | {{practice_email}}
""")

t("crd-records-request", "Records request", "coordination",
  "Requests records from another practice, with the authorization attached.", False, "plain", "graphite",
  "Records request with signed authorization attached.",
  [f("other_practice", "Practice name", sample="Riverside Family Medicine"),
   f("records_needed", "Records needed", sample="visit notes and medication history from the past two years"),
   f("fax_number", "Return fax", "phone", sample="555-555-0199")],
  """
Subject: Records request - signed authorization attached
# Records request

To the records team at {{other_practice}},

We are requesting {{records_needed}} for a shared patient. A signed authorization is attached.

| Return by | Secure fax to {{fax_number}}
| Or | Reply to {{practice_email}}
| Questions | {{practice_phone}}

Thank you for your help.

@ {{sender_name}} | {{sender_title}} | {{practice_name}}
""")

t("crd-handoff", "Provider-to-provider handoff", "coordination",
  "Transition summary when care moves to another clinician.", False, "ledger", "forest",
  "Care transition summary.",
  [f("receiving_provider", "Receiving provider", sample="Dr. Ana Petrov"),
   f("transition_date", "Transition date", "date", sample="2026-10-01"),
   f("summary_note", "Summary", sample="Stable on the current plan, next review due in three months.")],
  """
Subject: Care transition, effective {{transition_date}}
# Care transition

Dear {{receiving_provider}},

Care transitions to your service on {{transition_date}}.

{{summary_note}}

Records follow under separate cover. If you would like to talk it through before the handover, call {{practice_phone}} and ask for {{sender_name}}.

@ {{sender_name}} | {{sender_title}} | {{practice_email}}
""")

# --------------------------------------------------------- ANNOUNCEMENTS
t("ann-hours", "Holiday or changed hours", "announcements",
  "Tells patients about a schedule change.", True, "signal", "ember",
  "Our hours are changing {{change_date}}.",
  [f("change_date", "Effective date", "date", sample="2026-11-26"),
   f("new_hours", "New hours", sample="Closed Thursday and Friday, reopening Monday at 8am")],
  """
Subject: Hours change on {{change_date}}
~ Hours
# A change to our schedule

Hi {{first_name}},

Starting {{change_date}}: {{new_hours}}.

> For anything urgent, call {{practice_phone}} and follow the prompts. If it is an emergency, call 911. For a mental health crisis, call or text 988.

@ {{practice_name}} | {{practice_phone}}
""")

t("ann-closure", "Unplanned closure", "announcements",
  "Weather or emergency closure. Short and clear.", True, "pulse", "ember",
  "We are closed today, {{closure_date}}.",
  [f("closure_date", "Closure date", "date", sample="2026-01-14"),
   f("closure_reason", "Reason", sample="snow and unsafe road conditions"),
   f("rebook_note", "Rebooking", sample="We will call everyone affected to rebook.")],
  """
Subject: Closed today, {{closure_date}}
~ Closure notice
# We are closed today

Hi {{first_name}},

We are closed {{closure_date}} due to {{closure_reason}}.

{{rebook_note}}

> If it is an emergency, call 911. For a mental health crisis, call or text 988.

@ {{practice_name}} | {{practice_phone}}
""")

t("ann-policy", "Policy change notice", "announcements",
  "Announces a policy change with a clear effective date.", True, "ledger", "graphite",
  "A policy change effective {{effective_date}}.",
  [f("policy_name", "Policy", sample="Late cancellation policy"),
   f("effective_date", "Effective date", "date", sample="2026-10-01"),
   f("policy_detail", "What changes", sample="cancellations inside 24 hours will carry a $50 fee"),
   f("policy_reason", "Why", sample="Late cancellations leave slots empty that someone on the waitlist could have used.")],
  """
Subject: {{policy_name}} changes {{effective_date}}
# {{policy_name}}

Hi {{first_name}},

Starting {{effective_date}}, {{policy_detail}}.

## Why

{{policy_reason}}

If this creates a hardship, call {{practice_phone}}. We would rather talk about it than lose you as a patient.

@ {{sender_name}} | {{sender_title}} | {{practice_name}}
""")

# -------------------------------------------------------------- OUTREACH
t("out-referral-intro", "Referral partnership introduction", "outreach",
  "Cold introduction to a practice you would like referrals from. One to one, not bulk.", False, "ledger", "ocean",
  "An introduction from {{practice_name}}.",
  [f("recipient_name", "Their name", sample="Dr. Ana Petrov"),
   f("our_specialty", "What we do", sample="outpatient psychiatry for adults and adolescents"),
   f("current_wait", "Current wait", sample="under two weeks"),
   fphoto("photo_url", "Photo", PHOTO_TEAM),
   falt("photo_alt", "Photo description (alt text)", "The care team together at the practice")],
  """
Subject: Introduction from {{practice_name}}
# Hello from {{practice_name}}

Dear {{recipient_name}},

I am {{sender_name}}, {{sender_title}} at {{practice_name}}. We provide {{our_specialty}}, and we are currently at {{current_wait}} for new patients.

[Feature: {{photo_url}} | {{photo_alt}} | Why patients come to us | Short waits, clear communication, and a team that actually follows up - the things your patients already expect from you.]

I am writing in case your patients ever need somewhere to go.

## What referring to us looks like

+ We acknowledge every referral in writing within one business day
+ We tell you the outcome, including when we could not reach the patient
+ We honour your preferred clinician where we can

If it would help, I am glad to set up a short call.

@ {{sender_name}} | {{sender_title}} | {{practice_email}}
""")

t("out-recruiting", "Provider recruiting outreach", "outreach",
  "Approach a clinician about a role. Individual and personal, never bulk.", False, "plain", "forest",
  "A role at {{practice_name}} that might interest you.",
  [f("recipient_name", "Their name", sample="Dr. Sam Whitfield"),
   f("role_title", "Role", sample="Psychiatric Nurse Practitioner"),
   f("role_detail", "What makes it good", sample="Four-day week, no call, admin support for prior authorizations."),
   f("why_them", "Why them", sample="Your background in perinatal care is exactly the gap on our team.")],
  """
Subject: A {{role_title}} role at {{practice_name}}
# Hello, {{recipient_name}}

I am {{sender_name}} at {{practice_name}}. We are hiring a {{role_title}}, and I wanted to reach out directly rather than send you to a job board.

{{why_them}}

## About the role

{{role_detail}}

If the timing is wrong, no problem at all. I would still welcome a conversation for later.

@ {{sender_name}} | {{sender_title}} | {{practice_email}}
""")

t("out-newsletter-invite", "Newsletter invitation", "outreach",
  "Invites someone to opt in themselves. Never use this to add anyone to a list yourself.", False, "plain", "ocean",
  "An invitation to our newsletter, if you would like it.",
  [f("signup_url", "Signup form link", "url", sample="https://example.com/newsletter"),
   f("cadence", "How often", sample="once a month"),
   f("content_summary", "What is in it", sample="practice updates, new clinicians, and the occasional short read")],
  """
Subject: Would you like our newsletter?
# An invitation, not a subscription

Hi {{first_name}},

We send a newsletter {{cadence}} with {{content_summary}}.

If that sounds useful, you can add yourself here. If not, no action needed and you will not hear from us about it again.

[Button: Sign me up | {{signup_url}}]

@ {{sender_name}} | {{practice_name}}
""")

# `first_name` appears in most bodies; declare it once wherever it is used.
for tpl in T:
    keys = {fd["key"] for fd in tpl["fields"]}
    if "{{first_name}}" in tpl["body"] and "first_name" not in keys:
        tpl["fields"].insert(0, f("first_name", "Recipient first name", sample="Alex"))

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(here, "src", "library", "templates.json")
with io.open(out, "w", encoding="utf-8") as fh:
    fh.write(json.dumps({"version": 1, "templates": T}, indent=2, ensure_ascii=False) + "\n")

ids = [x["id"] for x in T]
assert len(ids) == len(set(ids)), "duplicate template id"
print("templates: %d" % len(T))
for k, v in sorted(Counter(x["category"] for x in T).items()):
    print("   %-14s %d" % (k, v))

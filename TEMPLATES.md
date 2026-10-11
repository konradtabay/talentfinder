# Default message templates

Editable in the app per event. Variables are replaced at send time.

## Attendee follow-up (LinkedIn DM)

**Audience:** Everyone who attended (connected on LinkedIn). One click: open profile, copy message to clipboard, host pastes in DM.

**Default body:**

```text
Hey {first_name}, it was great to have you at {event_name}. {note_line}
We're hiring a {role_title}, take a look. We have everyone who came on a priority list.
```

| Variable | Source |
| --- | --- |
| `{first_name}` | Guest name from Luma CSV |
| `{event_name}` | Event title |
| `{note_line}` | One sentence from pasted notes for this person. If empty, omit the sentence (including trailing space after the period on line 1). |
| `{role_title}` | Best-matching open role from fit check, or host override |

**Optional append (host setting):** `{apply_link}` or `{chat_link}` on its own line if you want a URL in the DM.

---

## Sponsor outreach

**Audience:** Prospected sponsors (often email or LinkedIn, host choice in app).

**Default body:**

```text
Hi {first_name},

I'm {host_name}, {host_title} at {host_company}. We're hosting {event_name} on {event_date} in {city}, with {audience_count} {audience_descriptor} coming.

{why_you_line}

We're looking for a {package_name} partner: {package_benefits}.

Saw you've worked with similar events in the past, let us know

{host_name}
```

| Variable | Source |
| --- | --- |
| `{first_name}` | Sponsor contact first name |
| `{host_name}`, `{host_title}`, `{host_company}` | Host profile in app |
| `{event_name}`, `{event_date}`, `{city}` | Event settings |
| `{audience_count}` | Accepted or registered count (host chooses) |
| `{audience_descriptor}` | e.g. "ML engineers and founders at Series A–C startups" — from curated guest breakdown or host text |
| `{why_you_line}` | One line: co-hosted similar event, recent launch, relevance to event type (filled by sponsor finder or host) |
| `{package_name}` | e.g. "venue", "title", "food & drinks" |
| `{package_benefits}` | Bullet or short sentence: logo, stage time, attendee list, etc. |

**Note:** The line "Saw you've worked with similar events in the past" is static in the default; `{why_you_line}` above should carry the specific proof (which event, when). Host can merge or edit in app.

# TalentFinder

Host a Luma event and hire from the guest list. Find companies that already sponsor similar events, score guests against open roles, and copy LinkedIn notes and follow-ups.

API keys and event data stay in the browser. The server only forwards TypeSafe and TinyFish requests with the key sent on that request.

## Requirements

- Node.js 20.9 or newer
- npm
- A [TypeSafe](https://console.typesafe.ai/) API key (fit check)
- A [TinyFish](https://agent.tinyfish.ai/api-keys) API key (guest lookup and sponsor search)

## Run locally

```bash
git clone https://github.com/konradtabay/talentfinder.git
cd talentfinder/web
npm install
npm run dev
```

Open http://localhost:3000.

No environment variables. On first visit, enter your name and paste both keys.

## First-time setup

1. **You.** Full name, title, and company. These are filled into sponsor pitches and messages.
2. **TypeSafe.** Paste a key from https://console.typesafe.ai/. Used by the fit check (Jev).
3. **TinyFish.** Paste a key from https://agent.tinyfish.ai/api-keys. Used to look up public profiles and to search Luma for sponsors. Search and fetch are free up to the daily allowance.

The setup screen checks each key before you continue.

## Use an event

Create an event with a name, city, date, and capacity. City is used in sponsor search.

1. **Roles.** Add each job you are hiring for. You can also paste a public careers URL and pull titles from that page.
2. **Sponsors.** Search reads Luma events in that city, opens the event pages, and lists companies that sponsored them, with a pitch you can copy. Requires at least one role.
3. **Guests.** In Luma, export the guest list as CSV and upload it. Rows need an email. Name, LinkedIn, company, approval status, and check-in time are used when those columns are present. Importing again merges on email.
4. **Fit.** Scores each guest against your roles. Set each person to accept, decline, waitlist, or review. Download a Luma bulk-status CSV if you want to apply those decisions back in Luma.
5. **Connect.** For accepted guests who have not been contacted, copies a short note and opens their LinkedIn profile. There is a daily cap in the browser.
6. **Notes.** Paste a note per guest. A note becomes `{note_line}` in the follow-up. Leave it blank and that sentence is omitted.
7. **Follow-up.** After the event, export the Luma guest CSV again and upload it so check-ins are recorded. Copies a DM for each person who checked in and opens LinkedIn.
8. **Pipeline.** Download one CSV of guests, fit, company, title, school, and notes for an ATS.

Message templates are editable on the event. Variables are in [TEMPLATES.md](TEMPLATES.md).

## Data

Everything is stored in `localStorage` in the browser you set up:

| Key | Contents |
| --- | --- |
| Host profile | Name, title, company |
| API keys | TypeSafe and TinyFish |
| Events | Roles, guests, decisions, notes, sponsor list, templates |

Clearing site data for this origin deletes it. A different browser or device starts empty.

## Scripts

From `web/`:

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Deploy

The Next.js app is in `web/`.

On Vercel, import this repository, set the root directory to `web`, and deploy. Leave environment variables empty. The production site does not hold user keys.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4. Papa Parse reads Luma CSVs. TypeSafe runs fit checks. TinyFish Search and Fetch look up profiles and sponsor events.

## License

[MIT](LICENSE)

# EventHire

Turn a Luma event into a hiring pipeline. You host the event, EventHire finds sponsors, scores the guest list against your open roles, and gives you a LinkedIn note for each person worth meeting.

[Open the app](https://talentfinder-ashen.vercel.app)

## Demo

Walkthrough GIF goes here.

## What it does

1. **Sponsors.** Finds companies that already sponsor similar events in your city, with a link to the event they sponsored and a pitch you can copy.
2. **Roles.** The jobs you are hiring for. Paste a careers page and pull the titles from it.
3. **Guests.** Upload the Luma guest CSV. A later export merges on email and picks up who checked in.
4. **Fit.** Scores each guest against your roles. Mark them accept, decline, waitlist, or review, and download a Luma status CSV if you want those decisions back in Luma.
5. **Connect.** Before the event, copy a short note and open that guest's LinkedIn profile.
6. **Follow up.** After the event, copy a DM for everyone who checked in. A note you pasted for them is included in the message.
7. **Pipeline.** Download one CSV of name, email, LinkedIn, company, title, fit, school, and notes for an ATS.

Your name, keys, events, and guest lists stay in the browser. The server only forwards each request with the key you pasted.

Message variables are in [TEMPLATES.md](TEMPLATES.md).

## Stack

Next.js 16, React 19, TypeScript, and Tailwind CSS 4. Papa Parse reads the Luma CSVs. TypeSafe (Jev) scores guests against roles. The app is hosted on Vercel. Host profile, keys, and events live in `localStorage`.

## How TinyFish helped

TinyFish is how the app reads the public web.

- **Search** finds Luma events in your city that list sponsors, past the first page of results.
- **Fetch** opens those event pages and reads the full sponsor list from the page.
- **Fetch** reads a careers page when you want role titles pulled in.
- **Search** looks up a guest's public profile so the fit check has a title and company alongside the CSV row.

Keys come from [TinyFish](https://agent.tinyfish.ai/api-keys) and [TypeSafe](https://console.typesafe.ai/). Search and fetch are free up to the daily allowance.

## Run it

Node.js 20.9 or newer.

```bash
git clone https://github.com/konradtabay/talentfinder.git
cd talentfinder/web
npm install
npm run dev
```

Open http://localhost:3000. Enter your name, then paste a TypeSafe key and a TinyFish key. No environment variables.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

The Next.js app is in `web/`. On Vercel, set the root directory to `web` and leave environment variables empty.

Production: https://talentfinder-ashen.vercel.app

## License

[MIT](LICENSE)

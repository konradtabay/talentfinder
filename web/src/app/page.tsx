import { DotImage } from "@/components/DotImage";
import { StartButton } from "@/components/StartButton";
import { Header } from "@/components/ui";

const STEPS = [
  ["01", "Sponsors", "Find companies that already sponsor events like yours, and pitch them from the same workspace."],
  ["02", "Curate", "Drop in your Luma CSV. We check every guest against your open roles."],
  ["03", "Connect", "One click per guest to connect on LinkedIn before the event."],
  ["04", "Follow up", "A short DM to everyone who came. Candidates land in your pipeline."],
  ["05", "Export", "Pull guests, fit, and pipeline into a CSV your ATS can import."],
];

export default function Home() {
  return (
    <>
      <Header right={<StartButton />} />
      <main className="flex-1">
        <section className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] border-b border-line">
          <div className="flex flex-col justify-end gap-6 p-6 lg:p-10 dot-grid">
            <h1 className="font-dot text-5xl lg:text-7xl font-black leading-[0.9]">
              events
              <br />
              that hire.
            </h1>
            <p className="max-w-md text-muted">
              Host a Luma event, fill your open roles. TalentFinder curates the guest list, gets you
              connected, and follows up with everyone who came.
            </p>
            <div>
              <StartButton />
            </div>
          </div>
          <div className="border-t lg:border-t-0 lg:border-l border-line">
            <DotImage src="/hero.jpg" alt="Two people shaking hands" />
          </div>
        </section>

        <section className="grid sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map(([n, title, body]) => (
            <div key={n} className="p-6 border-b sm:border-r border-line">
              <div className="text-muted">{n}</div>
              <div className="mt-6 text-lg font-semibold">{title}</div>
              <p className="mt-2 text-muted">{body}</p>
            </div>
          ))}
        </section>

        <footer className="px-6 py-5 text-muted">
          Your API keys and event data stay in your browser.
        </footer>
      </main>
    </>
  );
}

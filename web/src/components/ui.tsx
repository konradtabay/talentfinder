import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const base =
  "inline-flex items-center justify-center gap-2 h-10 px-4 border text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none";
const variants = {
  primary: "bg-accent text-fg border-accent hover:bg-fg hover:text-bg hover:border-fg",
  ghost: "border-line text-fg hover:border-accent",
};

type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Wordmark() {
  return (
    <Link href="/" className="font-dot text-2xl font-black tracking-tight">
      talentfinder
    </Link>
  );
}

export function Header({ right }: { right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between px-6 py-5 border-b border-line">
      <Wordmark />
      <div className="flex items-center gap-4 text-muted">{right}</div>
    </header>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`border border-line bg-panel p-6 ${className}`}>{children}</section>;
}

export function ErrorText({ message }: { message: string }) {
  if (!message) return null;
  const parts = message.split(/(https?:\/\/[^\s]+)/g);
  return (
    <p className="mt-2 text-sm text-red-600">
      {parts.map((part, i) =>
        part.startsWith("http") ? (
          <a key={i} className="underline" href={part} target="_blank" rel="noreferrer">
            {part.includes("agent.tinyfish.ai") ? "raise the limit" : part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

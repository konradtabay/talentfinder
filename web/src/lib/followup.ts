import type { Guest } from "./guests";

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, value);
  }
  out = out.replace(/\{note_line\}\s*/g, vars.note_line ? `${vars.note_line} ` : "");
  if (!vars.why_you_line?.trim()) {
    out = out.replace(/\n*\{why_you_line\}\n*/g, "\n");
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function followupForGuest(
  template: string,
  guest: Guest,
  eventName: string,
  defaultRole: string,
): string {
  const note = guest.noteLine.trim();
  return renderTemplate(template, {
    first_name: guest.firstName || guest.fullName.split(" ")[0] || "there",
    event_name: eventName,
    role_title: guest.fit?.bestRole && guest.fit.bestRole !== "none" ? guest.fit.bestRole : defaultRole,
    note_line: note ? note : "",
  });
}

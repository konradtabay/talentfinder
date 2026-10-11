export const WORKSPACE_STEPS = [
  { id: "roles", label: "Roles", n: "01" },
  { id: "sponsors", label: "Sponsors", n: "02" },
  { id: "guests", label: "Guests", n: "03" },
  { id: "fit", label: "Fit", n: "04" },
  { id: "connect", label: "Connect", n: "05" },
  { id: "notes", label: "Notes", n: "06" },
  { id: "followup", label: "Follow-up", n: "07" },
  { id: "pipeline", label: "Pipeline", n: "08" },
] as const;

export type WorkspaceStep = (typeof WORKSPACE_STEPS)[number]["id"];

const STORAGE_KEY = "tf.step.v1";

export function isWorkspaceStep(value: string | null): value is WorkspaceStep {
  return WORKSPACE_STEPS.some((step) => step.id === value);
}

export function readWorkspaceStep(eventId: string): WorkspaceStep | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, unknown>;
    const value = map[eventId];
    return typeof value === "string" && isWorkspaceStep(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeWorkspaceStep(eventId: string, step: WorkspaceStep) {
  let map: Record<string, string> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) map = JSON.parse(raw) as Record<string, string>;
  } catch {
    map = {};
  }
  map[eventId] = step;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function workspacePath(eventId: string, step: WorkspaceStep) {
  return `/app/${eventId}?step=${step}`;
}

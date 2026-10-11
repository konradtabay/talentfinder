const STORAGE_KEY = "tf.connect.v1";
const WEEKLY_CAP = 100;

function weekKey(d = new Date()) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

type Store = { week: string; count: number };

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { week: weekKey(), count: 0 };
    const parsed = JSON.parse(raw) as Store;
    if (parsed.week !== weekKey()) return { week: weekKey(), count: 0 };
    return parsed;
  } catch {
    return { week: weekKey(), count: 0 };
  }
}

function write(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function connectUsage() {
  const s = read();
  return { count: s.count, cap: WEEKLY_CAP, remaining: Math.max(0, WEEKLY_CAP - s.count) };
}

export function recordConnectSent() {
  const s = read();
  write({ week: s.week, count: s.count + 1 });
}

export { WEEKLY_CAP };

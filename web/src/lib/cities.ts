/** Common event cities — searchable labels with extra match terms. */
export const CITY_OPTIONS: { label: string; terms: string }[] = [
  { label: "San Francisco, CA", terms: "san francisco sf bay area" },
  { label: "New York, NY", terms: "new york nyc manhattan brooklyn" },
  { label: "Los Angeles, CA", terms: "los angeles la socal" },
  { label: "Seattle, WA", terms: "seattle" },
  { label: "Austin, TX", terms: "austin" },
  { label: "Boston, MA", terms: "boston" },
  { label: "Chicago, IL", terms: "chicago" },
  { label: "Denver, CO", terms: "denver" },
  { label: "Miami, FL", terms: "miami" },
  { label: "Atlanta, GA", terms: "atlanta" },
  { label: "Washington, DC", terms: "washington dc district columbia" },
  { label: "Portland, OR", terms: "portland" },
  { label: "San Diego, CA", terms: "san diego" },
  { label: "San Jose, CA", terms: "san jose silicon valley" },
  { label: "Palo Alto, CA", terms: "palo alto" },
  { label: "Mountain View, CA", terms: "mountain view" },
  { label: "Oakland, CA", terms: "oakland east bay" },
  { label: "Berkeley, CA", terms: "berkeley" },
  { label: "Brooklyn, NY", terms: "brooklyn" },
  { label: "Philadelphia, PA", terms: "philadelphia philly" },
  { label: "Dallas, TX", terms: "dallas" },
  { label: "Houston, TX", terms: "houston" },
  { label: "Phoenix, AZ", terms: "phoenix" },
  { label: "Las Vegas, NV", terms: "las vegas" },
  { label: "Nashville, TN", terms: "nashville" },
  { label: "Raleigh, NC", terms: "raleigh research triangle" },
  { label: "Durham, NC", terms: "durham" },
  { label: "Charlotte, NC", terms: "charlotte" },
  { label: "Detroit, MI", terms: "detroit" },
  { label: "Minneapolis, MN", terms: "minneapolis twin cities" },
  { label: "Salt Lake City, UT", terms: "salt lake city slc" },
  { label: "Toronto, ON", terms: "toronto canada" },
  { label: "Vancouver, BC", terms: "vancouver canada" },
  { label: "Montreal, QC", terms: "montreal canada" },
  { label: "London, UK", terms: "london united kingdom england" },
  { label: "Paris, France", terms: "paris france" },
  { label: "Berlin, Germany", terms: "berlin germany" },
  { label: "Amsterdam, Netherlands", terms: "amsterdam netherlands" },
  { label: "Dublin, Ireland", terms: "dublin ireland" },
  { label: "Tel Aviv, Israel", terms: "tel aviv israel" },
  { label: "Singapore", terms: "singapore" },
  { label: "Hong Kong", terms: "hong kong" },
  { label: "Tokyo, Japan", terms: "tokyo japan" },
  { label: "Sydney, Australia", terms: "sydney australia" },
  { label: "Melbourne, Australia", terms: "melbourne australia" },
  { label: "Bangalore, India", terms: "bangalore bengaluru india" },
  { label: "Mumbai, India", terms: "mumbai india" },
  { label: "São Paulo, Brazil", terms: "sao paulo brazil" },
  { label: "Mexico City, Mexico", terms: "mexico city mexico" },
];

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchCities(query: string, limit = 8): string[] {
  const q = norm(query);
  if (!q) return CITY_OPTIONS.slice(0, limit).map((c) => c.label);

  const scored = CITY_OPTIONS.map((c) => {
    const hay = norm(`${c.label} ${c.terms}`);
    if (hay === q) return { label: c.label, score: 100 };
    if (hay.startsWith(q)) return { label: c.label, score: 90 };
    if (c.label.toLowerCase().includes(query.toLowerCase())) return { label: c.label, score: 80 };
    const tokens = q.split(" ").filter(Boolean);
    const allTokens = tokens.every((t) => hay.includes(t));
    if (allTokens) return { label: c.label, score: 70 - tokens.length };
    if (hay.includes(q)) return { label: c.label, score: 50 };
    return { label: c.label, score: 0 };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((x) => x.label);
}

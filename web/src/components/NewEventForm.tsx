"use client";

import { useState } from "react";
import { createEvent } from "@/lib/events";
import { CityCombobox } from "./CityCombobox";
import { Button } from "./ui";

export function NewEventForm() {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [capacity, setCapacity] = useState(80);

  return (
    <form
      className="flex flex-col gap-3 w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const event = createEvent({
          name: name.trim(),
          city: city.trim(),
          date,
          capacity: Math.max(1, Number(capacity) || 80),
        });
        window.location.assign(`/app/${event.id}`);
      }}
    >
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Event name"
        className="h-10 bg-bg border border-line px-3 outline-none focus:border-fg"
      />
      <div className="grid grid-cols-2 gap-2">
        <CityCombobox
          value={city}
          onChange={setCity}
          className="h-10 w-full bg-bg border border-line px-3 outline-none focus:border-fg"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 bg-bg border border-line px-3 outline-none focus:border-fg"
        />
      </div>
      <label className="text-muted flex items-center justify-between gap-4">
        Capacity
        <input
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
          className="h-10 w-24 bg-bg border border-line px-3 outline-none focus:border-fg"
        />
      </label>
      <Button type="submit" disabled={!name.trim()}>
        Create event →
      </Button>
    </form>
  );
}

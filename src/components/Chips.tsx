import type { PersonRef } from "../lib/overlap";

export function PersonChips({ people }: { people: PersonRef[] }) {
  if (people.length === 0) return null;
  return (
    <ul className="chips">
      {people.map((person) => (
        <li key={person.id} className={person.example ? "chip chip-example" : "chip"}>
          <span>{person.name}</span>
          {person.example && <span className="badge">Example</span>}
        </li>
      ))}
    </ul>
  );
}

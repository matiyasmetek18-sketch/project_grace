import type { Area, Gathering, Heft, Task, TimeRange, Volunteer } from "../types";

const SEEDED_AT = "2026-11-01T15:00:00.000Z";

function task(id: string, areaId: string, title: string, heft: Heft = "either"): Task {
  return { id, areaId, title, heft };
}

function example(
  id: string,
  name: string,
  note: string,
  ranges: TimeRange[],
  taskIds: string[],
): Volunteer {
  return {
    id,
    name,
    note,
    ranges,
    taskIds,
    flexible: false,
    example: true,
    createdAt: SEEDED_AT,
  };
}

const workAreas: Area[] = [
  {
    id: "north",
    name: "North greenbelt",
    blurb: "Trees, weeds, and new plantings along the north edge.",
    place: "north",
  },
  {
    id: "nyard",
    name: "North yard",
    blurb: "The front yard and the wider north side.",
    place: "nyard",
  },
  {
    id: "rental",
    name: "Rental house",
    blurb: "Porch railing and the back-porch pavers.",
    place: "rental",
  },
  {
    id: "park",
    name: "Rental parking",
    blurb: "Dirt to move out, then paving.",
    place: "park",
  },
  {
    id: "tools",
    name: "Tools",
    blurb: "The small job that lets the trimming happen.",
    place: "tools",
  },
  {
    id: "plat",
    name: "Platforms",
    blurb: "String-trim along the platforms.",
    place: "plat",
  },
  {
    id: "orchard",
    name: "Orchard",
    blurb: "The -86 orchard and its northwest bed.",
    place: "orchard",
  },
  {
    id: "mid",
    name: "Mid greenbelt",
    blurb: "A couple of trees to come down.",
    place: "mid",
  },
  {
    id: "carport",
    name: "Carport",
    blurb: "Shelving, and crops that rotate with the yard.",
    place: "carport",
  },
  {
    id: "berry",
    name: "Berry beds",
    blurb: "Marion berries, black raspberries, and blueberries.",
    place: "berry",
  },
  {
    id: "pots",
    name: "Pots and rescued trees",
    blurb: "Repotting, and saving trees that are failing.",
    place: "pots",
  },
  {
    id: "south",
    name: "South grounds",
    blurb: "Weeding on the south side.",
    place: "south",
  },
  {
    id: "sgreen",
    name: "South greenbelt",
    blurb: "The oak that needs to come down.",
    place: "sgreen",
  },
];

const workTasks: Task[] = [
  task("rail", "rental", "Repair railing on rental porch", "heavier"),
  task("pavers", "rental", "Quick cement pavers at rental back porch", "heavier"),
  task("hazelnut", "north", "Cut down hazelnut tree in north greenbelt", "heavier"),
  task("oak", "sgreen", "Cut down oak in south greenbelt", "heavier"),
  task("midtrees", "mid", "Cut down a couple trees in mid greenbelt", "heavier"),
  task("weed-ng", "north", "Complete weeding in north greenbelt"),
  task("plant-ng", "north", "Plant about 4 trees in north greenbelt"),
  task("weed-nfy", "nyard", "Weed north front yard"),
  task("dirt", "park", "Move dirt from rental parking to north front yard", "heavier"),
  task("pave", "park", "Pave rental parking", "heavier"),
  task("ww-north", "nyard", "Weed wack north"),
  task("ww-plat", "plat", "Weed wack platforms"),
  task("ww-orch", "orchard", "Weed wack -86 orchard"),
  task("shelves", "carport", "Renovate carport shelving", "heavier"),
  task("rotate-nw", "orchard", "Weed and rotate -86 northwest"),
  task("weed-south", "south", "Weed south"),
  task("weed-north", "nyard", "Weed north"),
  task("trellis", "berry", "Trellis Marion berries and black raspberries"),
  task("rotate-crops", "carport", "Rotate crops between yard and carport"),
  task("repot", "pots", "Repotting and saving dying trees"),
  task("blueberries", "berry", "Weeding and planting more blueberries"),
  task("line", "tools", "Finish adding line to the weed wacker"),
];

const workDay: Gathering = {
  id: "before-the-frost",
  title: "Before the ground freezes",
  kicker: "Featured · outdoor work day",
  summary:
    "Outdoor jobs while the weather still allows — trees, weeds, porch, parking, and the beds.",
  story: [
    "The work is outdoors, before the ground freezes. Trees need to come down, beds need weeding and planting, a rental porch needs repair, parking needs paving, and the berries need a trellis.",
    "The open list is grouped by where the job sits on the grounds. Pick the hours you can give and the tasks you can take.",
  ],
  notes: [
    "The list moves. Finished jobs come off, and weather can set a task aside until another season. What is marked open is the work still waiting.",
    "The weed wacker still needs line put on. Until that small job is done, the trimming is harder to finish.",
    "Tasks marked “Heavier lift” are the larger outdoor jobs: trees, the porch railing, pavers, paving, moving dirt, and the carport shelves.",
  ],
  featured: true,
  sample: false,
  mode: "work",
  sketch: "grounds",
  season: "autumn",
  windowStart: "2026-11-14",
  windowEnd: "2026-12-06",
  dayStart: "08:00",
  dayEnd: "16:00",
  areas: workAreas,
  tasks: workTasks,
  volunteers: [
    example(
      "ex-sam",
      "Sam",
      "I can bring a saw and give the mornings.",
      [
        { date: "2026-11-14", start: "08:00", end: "13:00" },
        { date: "2026-11-20", start: "09:00", end: "12:00" },
        { date: "2026-11-21", start: "08:00", end: "13:00" },
      ],
      ["hazelnut", "oak", "midtrees", "rail"],
    ),
    example(
      "ex-elena",
      "Elena",
      "I am glad to weed. I need to leave by mid-afternoon.",
      [
        { date: "2026-11-14", start: "09:00", end: "12:00" },
        { date: "2026-11-21", start: "09:00", end: "15:00" },
        { date: "2026-11-28", start: "09:00", end: "12:00" },
      ],
      ["weed-ng", "weed-nfy", "weed-north", "blueberries", "trellis", "weed-south"],
    ),
    example(
      "ex-marcus",
      "Marcus",
      "I can run the trimmer once it has line.",
      [
        { date: "2026-11-18", start: "15:00", end: "16:00" },
        { date: "2026-11-20", start: "13:00", end: "16:00" },
        { date: "2026-11-21", start: "08:00", end: "12:00" },
      ],
      ["ww-north", "ww-plat", "ww-orch", "pavers", "line"],
    ),
    example(
      "ex-amina",
      "Amina",
      "I can plant and look after the beds.",
      [
        { date: "2026-11-21", start: "10:00", end: "16:00" },
        { date: "2026-11-28", start: "10:00", end: "14:00" },
      ],
      ["plant-ng", "repot", "blueberries", "rotate-crops", "rotate-nw"],
    ),
    example(
      "ex-chris",
      "Chris",
      "I can move dirt if a wheelbarrow is there.",
      [
        { date: "2026-11-14", start: "08:00", end: "11:00" },
        { date: "2026-11-21", start: "08:00", end: "12:00" },
        { date: "2026-12-05", start: "08:00", end: "13:00" },
      ],
      ["dirt", "pave", "shelves", "rail", "weed-south"],
    ),
  ],
};

const welcome: Gathering = {
  id: "winter-welcome",
  title: "Winter welcome planning",
  kicker: "Sample · evening planning",
  summary:
    "A sample meet-up for planning visits and shared meals. It shows a second kind of gathering: evenings, and a choice of room.",
  story: [
    "This sample is here so Grace can hold more than one gathering. It is not a real invitation.",
    "People mark the evenings they can talk through winter visits and shared meals, and the room they would rather meet in. The same overlap view does the rest.",
  ],
  notes: ["The people and rooms below are examples, so the chart is not empty on a first visit."],
  featured: false,
  sample: true,
  mode: "meet",
  sketch: "rooms",
  season: "winter",
  windowStart: "2026-12-01",
  windowEnd: "2026-12-18",
  dayStart: "17:00",
  dayEnd: "21:00",
  areas: [
    { id: "kitchen", name: "Kitchen table", blurb: "A close table for planning on paper." },
    { id: "front", name: "Front room", blurb: "Softer seats, and a little more room." },
    { id: "phone", name: "Phone or video", blurb: "For anyone who cannot come in person." },
  ],
  tasks: [
    task("meet-kitchen", "kitchen", "Kitchen table"),
    task("meet-front", "front", "Front room"),
    task("meet-phone", "phone", "Phone or video"),
  ],
  volunteers: [
    example(
      "ex-jonah",
      "Jonah",
      "Evenings after work suit me.",
      [
        { date: "2026-12-04", start: "17:00", end: "19:00" },
        { date: "2026-12-11", start: "18:00", end: "21:00" },
      ],
      ["meet-kitchen"],
    ),
    example(
      "ex-ruth",
      "Ruth",
      "I like the front room if it is quiet.",
      [
        { date: "2026-12-04", start: "17:00", end: "20:00" },
        { date: "2026-12-08", start: "17:00", end: "19:00" },
      ],
      ["meet-front"],
    ),
    example(
      "ex-luis",
      "Luis",
      "The kitchen table works for me.",
      [
        { date: "2026-12-04", start: "18:00", end: "20:00" },
        { date: "2026-12-11", start: "17:00", end: "21:00" },
      ],
      ["meet-kitchen"],
    ),
    example(
      "ex-nora",
      "Nora",
      "A phone call is easier that week.",
      [
        { date: "2026-12-08", start: "17:00", end: "19:00" },
        { date: "2026-12-15", start: "17:00", end: "20:00" },
      ],
      ["meet-phone"],
    ),
  ],
};

export const seedEvents: Gathering[] = [workDay, welcome];

export function sortEvents(events: Gathering[]): Gathering[] {
  return [...events].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.sample !== b.sample) return a.sample ? 1 : -1;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
}

import { vaccineName } from "./vaccines.ts";

export type PuppyStatus = "available" | "pending" | "placed";

export interface HealthTest {
  test: string;
  result: string;
}

export interface Vaccination {
  name: string;
  date: string;
  due?: string;
  done: boolean;
}

export interface Deworming {
  product: string;
  date: string;
}

export interface Parent {
  name: string;
  healthTests: HealthTest[];
}

export interface Puppy {
  id: string;
  slug: string;
  name: string;
  ageWeeks: number;
  sex: "male" | "female";
  dateOfBirth: string;
  temperamentTags: string[];
  status: PuppyStatus;
  photos: string[];
  temperamentNotes: string;
  vaccinations: Vaccination[];
  dewormings: Deworming[];
  parents: {
    sire: Parent;
    dam: Parent;
  };
}

// ---------------------------------------------------------------------
// Dates are relative, never hardcoded, so the sample content cannot go
// stale sitting unused. `npm run seed` regenerates seed.sql against the
// day it is run.
// ---------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * DAY));
const weeksAgo = (n: number) => daysAgo(n * 7);
const daysAhead = (n: number) => iso(new Date(Date.now() + n * DAY));

/**
 * The vaccination schedule this breeder follows.
 *
 * Yorkshire Terrier puppies are very small — often under a kilogram at
 * eight weeks — so nothing leaves here before twelve weeks regardless of
 * how the paperwork looks.
 */
function standardVaccinations(ageWeeks: number): Vaccination[] {
  // Labels come from the catalogue rather than being retyped here, so the
  // sample content, the seed and the admin picker cannot drift apart and
  // leave records that look like separate vaccines.
  const records: Vaccination[] = [];
  const ageInDays = ageWeeks * 7;

  if (ageWeeks >= 8) {
    records.push(
      { name: vaccineName("dhppi-1"), date: daysAgo(ageInDays - 56), done: true },
      { name: vaccineName("kennel-cough-intranasal"), date: daysAgo(ageInDays - 56), done: true }
    );
  }

  if (ageWeeks >= 12) {
    records.push({ name: vaccineName("dhppi-2"), date: daysAgo(ageInDays - 84), done: true });
  } else if (ageWeeks >= 8) {
    records.push({
      name: vaccineName("dhppi-2"),
      date: daysAhead(84 - ageInDays),
      due: daysAhead(84 - ageInDays),
      done: false,
    });
  }

  if (ageWeeks >= 16) {
    records.push({ name: vaccineName("rabies"), date: daysAgo(ageInDays - 112), done: true });
  }

  return records;
}

function standardDewormings(ageWeeks: number): Deworming[] {
  const ageInDays = ageWeeks * 7;
  return [21, 42, 63]
    .filter((dayOfLife) => dayOfLife <= ageInDays)
    .map((dayOfLife) => ({
      product: "Panacur 10% oral suspension",
      date: daysAgo(ageInDays - dayOfLife),
    }));
}

// ---------------------------------------------------------------------
// Parents
//
// The health panel is breed-specific: patella luxation and portosystemic
// (liver) shunt are the two conditions Yorkshire Terriers are most often
// screened for, alongside eye and cardiac clearances.
// ---------------------------------------------------------------------

const HEALTH_TESTS = (year: number, patellaYear = year): HealthTest[] => [
  { test: "Patella evaluation", result: `Normal — OFA ${patellaYear}` },
  { test: "Bile acid test (portosystemic shunt)", result: `Within normal range — ${year}` },
  { test: "Cardiac evaluation", result: `Normal — CAAB ${year}` },
  { test: "Primary lens luxation (PLL)", result: "Clear — DNA tested" },
  { test: "Progressive retinal atrophy (PRA)", result: "Clear — DNA tested" },
];

const THIS_YEAR = new Date().getFullYear();

const SIRE_BRIGHTWATER: Parent = {
  name: "Ch. Brightwater Sixpence",
  healthTests: HEALTH_TESTS(THIS_YEAR - 1),
};
const SIRE_COPPERFIELD: Parent = {
  name: "Gr. Ch. Copperfield Bold As Brass",
  healthTests: HEALTH_TESTS(THIS_YEAR),
};
const SIRE_WHARFEDALE: Parent = {
  name: "Ch. Wharfedale Little Admiral",
  healthTests: HEALTH_TESTS(THIS_YEAR, THIS_YEAR - 1),
};

const DAM_SILVERTHORN: Parent = {
  name: "Ch. Silverthorn Penny Royal",
  healthTests: HEALTH_TESTS(THIS_YEAR - 1, THIS_YEAR - 2),
};
const DAM_HARROGATE: Parent = {
  name: "Ch. Harrogate Blue Ribbon",
  healthTests: HEALTH_TESTS(THIS_YEAR - 2),
};
const DAM_MOORLAND: Parent = {
  name: "Ch. Moorland Tuppence",
  healthTests: HEALTH_TESTS(THIS_YEAR, THIS_YEAR - 1),
};

// ---------------------------------------------------------------------
// Photography — placeholder Yorkshire Terrier images from Unsplash.
//
// Every id below was opened and looked at before being added: each one is
// a Yorkshire Terrier, not a Silky, Biewer, Morkie or wire-haired terrier
// that reads as one in a thumbnail. Do not swap an id in from a filename
// or an alt-text search result alone.
//
// Two rules this list exists to enforce:
//
//   1. No photograph appears on two listings. A visitor comparing Hazel
//      and Bramble must not be shown the same dog twice — on an adoption
//      page that is the one error nobody forgives.
//   2. A listing only ever carries photographs OF THAT DOG. `pennyA` and
//      `pennyB` are two frames from one shoot, which is why Penny is the
//      only puppy here with a second image.
//
// Stock photography of Yorkshire Terriers is overwhelmingly of adult
// dogs; only four genuine young-puppy frames exist in this set, and they
// are spent on the four youngest listings. The older listings therefore
// show dogs with more coat than a ten-week-old really has. Replace the
// lot with real photographs through the dashboard (Puppies → Edit →
// Upload) before going live.
// ---------------------------------------------------------------------

const u = (id: string) =>
  `https://images.unsplash.com/${id}?w=900&h=1100&fit=crop&auto=format`;

const PHOTOS = {
  // Genuine young puppies — reserved for the youngest four listings.
  puppyTiny: u("photo-1546527762-f0234da4e9c8"),
  puppyBed: u("photo-1654101437386-9fdf9469c769"),
  puppyAutumn: u("photo-1695780963266-6225eff4f853"),
  puppyRug: u("photo-1546527868-ccb7ee7dfa6a"),

  // Juveniles — still short in the coat, tan coming through.
  juvCollar: u("photo-1618760877592-0d80e8b7bd02"),
  juvCream: u("photo-1611170078485-6c1c9ca31936"),
  juvIndoor: u("photo-1526440847959-4e38e7f00b04"),

  // Penny — two frames of the same dog, one shoot.
  pennyA: u("photo-1689009480234-e67dc23b437a"),
  pennyB: u("photo-1689009480504-6420452a7e8e"),

  // Grown coats.
  adultGrass: u("photo-1659946431902-2786bdd0b39d"),
  adultEars: u("photo-1731027683053-3a025de056c3"),
  adultCarpet: u("photo-1633291294388-3e73294ab65f"),
  adultDark: u("photo-1612830549030-bfb4b58ccd5f"),
  adultHarness: u("photo-1610389712622-73f621ff06bf"),
  adultPaving: u("photo-1574760112346-8443c3773437"),
  adultTrail: u("photo-1650132392843-cb49902dfcf1"),
} as const;

// ---------------------------------------------------------------------
// Puppies
// ---------------------------------------------------------------------

interface PuppySeed {
  slug: string;
  name: string;
  ageWeeks: number;
  sex: "male" | "female";
  tags: string[];
  status: PuppyStatus;
  photos: string[];
  notes: string;
  sire: Parent;
  dam: Parent;
}

const SEEDS: PuppySeed[] = [
  {
    slug: "sixpence",
    name: "Sixpence",
    ageWeeks: 9,
    sex: "male",
    tags: ["bold", "bright", "vocal"],
    status: "available",
    photos: [PHOTOS.puppyRug],
    notes:
      "Sixpence has decided he is a much larger dog than he is, and nothing we have done has dissuaded him. He announces visitors, supervises the garden, and escorts anyone carrying food. Underneath the bravado he is affectionate and unusually quick — he had sit and wait inside a fortnight. He will suit someone who finds a big personality in a small dog funny rather than tiring, and who will teach him that not every noise requires comment.",
    sire: SIRE_BRIGHTWATER,
    dam: DAM_SILVERTHORN,
  },
  {
    slug: "hazel",
    name: "Hazel",
    ageWeeks: 9,
    sex: "female",
    tags: ["gentle", "watchful", "steady"],
    status: "available",
    photos: [PHOTOS.juvCollar],
    notes:
      "Hazel is the quiet one of her litter and the last to make up her mind about anything. She watches first, joins second, and once she has decided you are hers she is completely devoted. She is easier company than most Yorkies of this age — less noise, less fuss — but she does not like being left, and a household where someone is usually home would suit her far better than one that is empty all day.",
    sire: SIRE_BRIGHTWATER,
    dam: DAM_SILVERTHORN,
  },
  {
    slug: "tuppence",
    name: "Tuppence",
    ageWeeks: 11,
    sex: "female",
    tags: ["busy", "clever", "mischievous"],
    status: "pending",
    photos: [PHOTOS.juvIndoor],
    notes:
      "Tuppence is a project manager. She rearranges her toys, tests every gap in the fence, and has twice let herself out of a crate we were assured was secure. She is enormously clever and needs that mind occupied — training games, puzzle feeders, something to do. In the right home she will be a joy. In a home with no plan for her, she will make her own entertainment and it will be expensive.",
    sire: SIRE_COPPERFIELD,
    dam: DAM_MOORLAND,
  },
  {
    slug: "rowan",
    name: "Rowan",
    ageWeeks: 8,
    sex: "male",
    tags: ["cuddly", "easygoing", "sociable"],
    status: "available",
    photos: [PHOTOS.puppyAutumn],
    notes:
      "Rowan is the softest puppy in this litter. He greets everyone, tolerates being carried about by children with visible patience, and falls asleep on whoever sits down first. He has none of the wariness the breed is sometimes known for. For a family who want a small dog that is genuinely easy with visitors and grandchildren, he is the obvious choice.",
    sire: SIRE_WHARFEDALE,
    dam: DAM_HARROGATE,
  },
  {
    slug: "bramble",
    name: "Bramble",
    ageWeeks: 10,
    sex: "male",
    tags: ["spirited", "loyal", "tenacious"],
    status: "available",
    photos: [PHOTOS.juvCream],
    notes:
      "Bramble is a terrier in the old sense — he will follow a scent to the end of the garden and dig where it stops. He is loyal to the point of shadowing, and he does not much care for other dogs he has not been introduced to properly. An owner who enjoys the terrier temperament rather than apologising for it will get a wonderful dog. He needs a secure garden; he will find any gap there is.",
    sire: SIRE_COPPERFIELD,
    dam: DAM_SILVERTHORN,
  },
  {
    slug: "penny",
    name: "Penny",
    ageWeeks: 12,
    sex: "female",
    tags: ["poised", "elegant", "confident"],
    status: "available",
    photos: [PHOTOS.pennyA, PHOTOS.pennyB],
    notes:
      "Penny carries herself beautifully and knows it. She stands for grooming without complaint, walks on a lead as though she invented it, and the steel-blue and tan is coming through nicely. She would do well in a show home, but she is not precious — she is equally happy muddy. Confident with strangers, unbothered by noise, and completely unafraid of larger dogs.",
    sire: SIRE_WHARFEDALE,
    dam: DAM_MOORLAND,
  },
  {
    slug: "otto",
    name: "Otto",
    ageWeeks: 13,
    sex: "male",
    tags: ["comic", "affectionate", "vocal"],
    status: "pending",
    photos: [PHOTOS.adultEars],
    notes:
      "Otto talks constantly — not barking exactly, a running commentary of grumbles and opinions. He is very funny and very affectionate, and he has no interest whatsoever in being quiet. We are being direct about this because it is the thing most likely to matter: he will not suit a flat with thin walls or a household that needs a silent dog. For everyone else he is enormous fun.",
    sire: SIRE_BRIGHTWATER,
    dam: DAM_HARROGATE,
  },
  {
    slug: "willow",
    name: "Willow",
    ageWeeks: 7,
    sex: "female",
    tags: ["delicate", "sweet", "new"],
    status: "available",
    photos: [PHOTOS.puppyBed],
    notes:
      "Willow is our smallest and will stay with her mother longer than the others. We do not let the little ones go early, and with a puppy this size we watch weight and blood sugar closely before she travels anywhere. She is sweet-natured and seeks out warmth and company. We list her now because families wanting a very young puppy usually need time to prepare.",
    sire: SIRE_WHARFEDALE,
    dam: DAM_SILVERTHORN,
  },
  {
    slug: "flint",
    name: "Flint",
    ageWeeks: 15,
    sex: "male",
    tags: ["independent", "calm", "assured"],
    status: "available",
    photos: [PHOTOS.adultDark],
    notes:
      "We held Flint back a few weeks to watch how his coat and temperament settled, and both have come along well. He is more self-contained than most of the breed — affectionate when he chooses, content alone in a room, unfussed by an ordinary working morning. If the separation anxiety Yorkies are prone to has put you off the breed, Flint is the one to ask about.",
    sire: SIRE_COPPERFIELD,
    dam: DAM_MOORLAND,
  },
  {
    slug: "marigold",
    name: "Marigold",
    ageWeeks: 11,
    sex: "female",
    tags: ["playful", "brave", "affectionate"],
    status: "available",
    photos: [PHOTOS.adultGrass],
    notes:
      "Marigold plays until she falls over, sleeps hard, and starts again. She is brave with new things and recovers quickly when something startles her, which is a temperament we like very much in this breed. She is affectionate without being clingy. A busy household with children old enough to handle a small dog carefully would suit her perfectly.",
    sire: SIRE_BRIGHTWATER,
    dam: DAM_MOORLAND,
  },
  {
    slug: "jasper",
    name: "Jasper",
    ageWeeks: 14,
    sex: "male",
    tags: ["devoted", "quiet", "sensitive"],
    status: "pending",
    photos: [PHOTOS.adultCarpet],
    notes:
      "Jasper is sensitive in the good sense — he reads a room accurately and adjusts. He is quiet for a Yorkie and forms an intense attachment to one person in particular. He would be miserable in a chaotic home and wonderful in a calm one, especially with someone often at home. He does not enjoy being talked over or picked up without warning.",
    sire: SIRE_WHARFEDALE,
    dam: DAM_HARROGATE,
  },
  {
    slug: "nutmeg",
    name: "Nutmeg",
    ageWeeks: 6,
    sex: "female",
    tags: ["tiny", "curious", "new"],
    status: "available",
    photos: [PHOTOS.puppyTiny],
    notes:
      "Nutmeg is a few weeks from being ready and is not yet reserved. She is curious about everything and already climbing out of places she should not be able to reach. Too young to say much about her adult temperament, but she is confident with handling and eating well, which is what we look for at this stage.",
    sire: SIRE_COPPERFIELD,
    dam: DAM_SILVERTHORN,
  },
  {
    slug: "barnaby",
    name: "Barnaby",
    ageWeeks: 32,
    sex: "male",
    tags: ["settled", "affectionate", "characterful"],
    status: "placed",
    photos: [PHOTOS.adultHarness],
    notes:
      "Barnaby went to a couple in Edinburgh earlier this year. They send photographs regularly. He has, we are told, taken firm possession of the sunniest windowsill in the flat and defends it against all comers, including the postman, who is outside and cannot hear him.",
    sire: SIRE_BRIGHTWATER,
    dam: DAM_HARROGATE,
  },
  {
    slug: "clover",
    name: "Clover",
    ageWeeks: 38,
    sex: "female",
    tags: ["bright", "adaptable", "loving"],
    status: "placed",
    photos: [PHOTOS.adultPaving],
    notes:
      "Clover found her family in Manchester and settled in immediately, including with the resident cat, who reportedly outranks her and is not challenged on it.",
    sire: SIRE_WHARFEDALE,
    dam: DAM_MOORLAND,
  },
  {
    slug: "atticus",
    name: "Atticus",
    ageWeeks: 44,
    sex: "male",
    tags: ["confident", "loyal", "spirited"],
    status: "placed",
    photos: [PHOTOS.adultTrail],
    notes:
      "Atticus was placed with a retired couple who wanted a small companion with a large personality. By all accounts they got exactly what they asked for and have no regrets whatsoever.",
    sire: SIRE_COPPERFIELD,
    dam: DAM_HARROGATE,
  },
];

export const puppies: Puppy[] = SEEDS.map((seed, index) => ({
  id: String(index + 1),
  slug: seed.slug,
  name: seed.name,
  ageWeeks: seed.ageWeeks,
  sex: seed.sex,
  dateOfBirth: weeksAgo(seed.ageWeeks),
  temperamentTags: seed.tags,
  status: seed.status,
  photos: seed.photos,
  temperamentNotes: seed.notes,
  vaccinations: standardVaccinations(seed.ageWeeks),
  dewormings: standardDewormings(seed.ageWeeks),
  parents: { sire: seed.sire, dam: seed.dam },
}));

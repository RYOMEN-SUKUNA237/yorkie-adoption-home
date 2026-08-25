export interface Guide {
  id: string;
  slug: string;
  title: string;
  summary: string;
  readingTimeMin: number;
  publishedDate: string;
  sections: Array<{ heading?: string; body: string }>;
}

/** Published dates are relative so the sample content never looks abandoned. */
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const guides: Guide[] = [
  {
    id: "1",
    slug: "the-yorkshire-terrier-coat",
    title: "The Yorkshire Terrier coat",
    summary:
      "Silk, not fur — how to keep the steel-blue and tan coat in condition, and an honest account of what a long coat actually costs in time.",
    readingTimeMin: 8,
    publishedDate: daysAgo(46),
    sections: [
      {
        body: "A Yorkshire Terrier's coat is a single layer of fine hair with the texture of human hair rather than the double coat of most breeds. It grows continuously instead of shedding seasonally, which is why the breed suits many allergy-sensitive households — and also why it will mat within days if left alone. There is no version of this breed that is low-maintenance in the coat.",
      },
      {
        heading: "The two honest options",
        body: "You are choosing between a full-length coat and a short trim, and you should choose deliberately rather than drifting. A full coat means daily brushing, most likely wrapping, and a groomer who understands the breed. A short 'puppy cut' — an inch or so all over — means a brush two or three times a week and a groom every six to eight weeks. Most pet homes are far happier with the short trim, and there is no shame in it. The dog does not know what it is missing.",
      },
      {
        heading: "Daily brushing",
        body: "Five minutes daily beats half an hour on Sunday. Use a pin brush without balls on the tips, and mist the coat lightly with a leave-in conditioner first — brushing a Yorkshire Terrier's coat dry snaps the hair. Work in sections from the skin outward, holding the hair above the tangle with your fingers so you are not dragging against the skin. Pay particular attention behind the ears, under the collar, in the armpits and around the back end.",
      },
      {
        heading: "Bathing",
        body: "Every one to two weeks. Use a shampoo formulated for silky coats and rinse until you are certain, then rinse once more — residue is the single most common cause of a dull, quickly-matting coat. Condition, comb through while wet, and dry with a dryer on low while brushing. Letting the coat air-dry in a heap is how mats form.",
      },
      {
        heading: "The topknot",
        body: "The hair above the eyes will grow into them. Either trim it short or tie it up — both are fine, doing neither is not. Use a small latex band rather than a rubber or metal one, retie it daily so the hair is not folded under tension in the same spot, and take it out at night.",
      },
      {
        heading: "Colour changes",
        body: "Puppies are born black and tan and lighten to the adult steel-blue and gold over roughly the first two years. This is normal and gradual, and the final shade is difficult to predict from an eight-week-old puppy. Anyone guaranteeing you an exact adult colour is guessing.",
      },
    ],
  },
  {
    id: "2",
    slug: "a-small-dog-is-a-fragile-dog",
    title: "A small dog is a fragile dog",
    summary:
      "Yorkshire Terriers weigh two to three kilograms as adults. What that means for stairs, sofas, children, and the way you carry them.",
    readingTimeMin: 7,
    publishedDate: daysAgo(31),
    sections: [
      {
        body: "This is the guide we most want adopters to read. An adult Yorkshire Terrier weighs about the same as a bag of sugar. Nearly every serious injury we hear about in the breed comes from something entirely ordinary — a jump off a sofa, a missed step, a door closed too quickly, someone standing up without looking down first.",
      },
      {
        heading: "Height is the main danger",
        body: "A jump from a sofa or a bed is a long fall for a dog this size and is a common cause of fractured legs. Use ramps or pet steps from the first day so the habit is built early, and discourage jumping down even when they clearly want to. Carry them on stairs while they are young.",
      },
      {
        heading: "Carrying them properly",
        body: "Support the chest with one hand and the hindquarters with the other. Never lift by the front legs or scoop under the armpits alone — the shoulder structure is delicate. Teach children to sit on the floor and let the dog come to them rather than picking the dog up at all.",
      },
      {
        heading: "Collapsing trachea",
        body: "The breed is prone to a weakening of the windpipe that produces a distinctive honking cough, often worse with excitement or pressure on the throat. Use a harness rather than a collar for walking — this is not optional advice for this breed. If you hear a persistent honking cough, see your vet rather than waiting.",
      },
      {
        heading: "Low blood sugar in puppies",
        body: "Very young or very small Yorkshire Terriers can drop into hypoglycaemia if they go too long without eating, especially when stressed by a move or a long journey. Signs are wobbliness, glazed eyes, or unusual sleepiness. Feed small meals frequently in the first months, keep a glucose gel in the house, and ring your vet immediately if you see it. We will talk you through this before any puppy leaves.",
      },
      {
        heading: "Children",
        body: "We do place with families, and we do so happily where the children are old enough to understand that this dog is breakable. As a rough guide that tends to mean school age. This is not about how well-behaved a child is; it is about size and physics.",
      },
    ],
  },
  {
    id: "3",
    slug: "teeth-and-dental-care",
    title: "Teeth: the thing most owners underestimate",
    summary:
      "Small mouths crowd, and crowded teeth decay. Dental disease is the most common avoidable health problem in the breed.",
    readingTimeMin: 6,
    publishedDate: daysAgo(19),
    sections: [
      {
        body: "Yorkshire Terriers have the same number of teeth as a much larger dog packed into a considerably smaller jaw. The crowding traps food and plaque, and plaque becomes tartar quickly. Untreated, that means gum disease, pain, tooth loss, and in bad cases infection that affects the heart and kidneys. It is the most common serious health problem we see in the breed, and it is almost entirely preventable.",
      },
      {
        heading: "Brush daily",
        body: "Daily, with a dog-specific enzymatic toothpaste — never human toothpaste, which contains fluoride and often xylitol. A finger brush is easier than a toothbrush for a mouth this small. Start on day one with the puppy, before there is any tartar, so the routine is normal rather than a fight. Thirty seconds counts.",
      },
      {
        heading: "Retained puppy teeth",
        body: "It is common in this breed for baby teeth, particularly the canines, not to fall out as the adult teeth come through, leaving two teeth in one socket. This traps food and accelerates decay. Your vet should check for it around six months, and any retained teeth are usually removed at the same time as spaying or neutering so the dog only goes under anaesthetic once.",
      },
      {
        heading: "Professional cleaning",
        body: "Budget for a scale and polish under anaesthetic every one to two years from middle age. It is not a failure of your home care — it is the reality of the breed's mouth. Ask your vet for a quote before you need one so it is not a surprise.",
      },
      {
        heading: "What does not work",
        body: "Dental chews and water additives help a little at the margins. They do not replace brushing, and a dog whose only dental care is a daily chew will still develop disease. Be sceptical of any product marketed as a substitute for a toothbrush.",
      },
    ],
  },
  {
    id: "4",
    slug: "the-terrier-in-the-lapdog",
    title: "The terrier in the lapdog",
    summary:
      "This breed was bred to catch rats in Yorkshire mills. Barking, digging, and a great deal of opinion are features, not faults.",
    readingTimeMin: 7,
    publishedDate: daysAgo(9),
    sections: [
      {
        body: "The Yorkshire Terrier is sold as a lapdog and is genuinely affectionate, but the breed was developed in nineteenth-century Yorkshire to kill rats in textile mills. That history is still very much present. People who expect a small, decorative, quiet dog are often surprised, and the surprise is the most common reason a Yorkie ends up needing rehoming.",
      },
      {
        heading: "They bark",
        body: "This breed is vocal and was bred to be. They will announce the post, the neighbours, and a leaf. You can absolutely reduce it with training — teaching a reliable 'enough', rewarding quiet, not rewarding the bark with attention — but you will not eliminate it, and a household that needs silence should think carefully. If you live somewhere with shared walls and a strict noise policy, be honest with yourself about this before applying.",
      },
      {
        heading: "They dig and they chase",
        body: "A secure garden means secure at ground level. Yorkshire Terriers will dig under a fence and squeeze through a gap you would swear was too small. Their recall around small moving animals is unreliable in the way any terrier's is, so a lead in unfenced spaces is a sensible default rather than an insult to your training.",
      },
      {
        heading: "They have opinions about other dogs",
        body: "Many Yorkies have no idea they are small and will confront a dog ten times their size. This is dangerous for them, not the other dog. Early, careful socialisation genuinely helps. So does not letting them practise the behaviour — picking them up mid-confrontation teaches them the strategy works.",
      },
      {
        heading: "The upside",
        body: "Everything above is the same trait from a different angle: this is a bright, bold, engaged little dog with real character. They train well because they are clever and want to be involved. They are funny. They bond hard. Adopters who wanted a dog with a personality rather than an ornament are, in our experience, the ones who stay delighted for the next fifteen years.",
      },
    ],
  },
  {
    id: "5",
    slug: "settling-a-yorkshire-terrier",
    title: "The first fortnight",
    summary:
      "House-training a very small dog, crate routines, and building tolerance for being alone before it becomes a problem.",
    readingTimeMin: 6,
    publishedDate: daysAgo(3),
    sections: [
      {
        body: "The first two weeks set the pattern for years. Keep them calm and structured. Resist the urge to invite everyone round to meet the puppy — a quiet first fortnight produces a more confident adult than an exciting one.",
      },
      {
        heading: "House-training a small bladder",
        body: "Small dogs need to go out more often, and Yorkshire Terriers have a reputation for being slow to house-train that is mostly a reflection of that. Take them out every hour while awake, and immediately after sleeping, eating or playing. Reward outside, in the moment, every time. Do not punish accidents — a puppy who learns you dislike seeing them go will simply hide to do it. In cold or wet weather many owners find an indoor tray a sensible backup rather than a failure.",
      },
      {
        heading: "Being alone",
        body: "This breed is prone to separation anxiety, and the best time to prevent it is before it starts. From the first week, leave them alone for very short periods — two minutes, then five, then fifteen — while you are still in the house. Do not make departures or returns emotional. A puppy who has never once been alone until you go back to work is a puppy who will panic.",
      },
      {
        heading: "The crate",
        body: "A crate is a bedroom, not a punishment. Feed meals in it, leave it open, let them choose it. For a dog this small the crate is also a genuine safety measure — it is somewhere they cannot be trodden on or sat on while everyone is busy.",
      },
      {
        heading: "Ring us",
        body: "We would far rather answer a question in week one than hear about a problem in month six. Every puppy leaves here with our number, and there is no question too small. That is not a courtesy — it is part of the arrangement.",
      },
    ],
  },
];

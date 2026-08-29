import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "../router";
import { useSettings } from "../../lib/settings";
import { settingString } from "../../services/misc";

const FAQ = [
  {
    q: "Why do you screen applicants?",
    a: "A Yorkshire Terrier lives for thirteen to sixteen years. During that time they depend entirely on the humans who agreed to take responsibility for them. We screen applicants because we believe the match between dog and household determines the quality of that life — and because we have seen what happens when the match is wrong. The screening process is not a judgment of your character. It is how we do our job.",
  },
  {
    q: "Do you ship puppies internationally?",
    a: "We do place puppies internationally, but we complete our verification steps before any placement and we do not ship puppies unaccompanied. We work with adopters to plan a collection visit or to arrange a trusted carrier. The logistics are the adopter's responsibility; we provide all health documentation and export support.",
  },
  {
    q: "How long does the process take?",
    a: "We read applications within two weeks. If we take your application further, the additional verification usually adds about another week. Visiting day is arranged around the puppy's readiness. Nothing leaves us before twelve weeks, and with the very small ones it can be fourteen or more. From application to collection is usually six to ten weeks.",
  },
  {
    q: "Can I choose which puppy I want?",
    a: "You may express a preference, and we take that seriously. We also make a recommendation based on our assessment of your household and the individual puppy's temperament. A calm, observant puppy and an energetic, bold household are not always the right match, even if they seem appealing to each other on first meeting.",
  },
  {
    q: "What does the lifetime return policy mean exactly?",
    a: "If at any point in your dog's life — illness, bereavement, relocation, changed circumstances — you cannot keep them, you contact us. We take the dog back, no conditions, no cost to you. The dog is then assessed and placed again through our normal process. We do not charge for this. We do require it.",
  },
  {
    q: "Do you offer any health guarantee?",
    a: "We provide full health documentation including vaccination records, deworming history, and parent health-testing clearances. We do not offer a financial guarantee, but we stand behind our breeding decisions. If a puppy develops a hereditary condition that our health testing should have predicted, we want to know. We take those conversations seriously.",
  },
  {
    q: "Do Yorkshire Terriers really bark that much?",
    a: "Often, yes. They were bred to work in mills and to raise the alarm, and that instinct is still there. Training reduces it a great deal — a reliable 'enough' cue, rewarding quiet, never rewarding the bark with attention — but it will not be eliminated, and we would rather say so now than have a dog returned in six months. If you live somewhere with a strict noise policy or very thin walls, think carefully.",
  },
  {
    q: "How fragile are they, really?",
    a: "An adult weighs around two to three kilograms. Most of the serious injuries we hear about come from ordinary things: a jump off the sofa, a missed step, someone standing up without looking down. We ask every adopter to use pet steps from day one and a harness rather than a collar, because this breed is prone to tracheal collapse. None of this makes them difficult dogs — it just means the household has to adjust slightly, and we would rather you knew before applying than after.",
  },
  {
    q: "Is there a deposit or any payment involved in the application?",
    a: "There is no payment at application stage. We do not accept deposits or any form of payment until a placement decision has been made and formally communicated in writing.",
  },
];

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-foreground leading-snug">{q}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 mt-0.5 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="pb-6">
          <p className="text-sm text-muted-foreground leading-[1.8] max-w-[68ch]">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function AboutPage() {
  const { navigate } = useRouter();
  const { settings } = useSettings();
  const contactEmail = settingString(settings, "contact_email", "support@yorkieadoptionhome.com");
  const whatsappNumber = settingString(settings, "whatsapp_number", "12188332266");
  const whatsAppHref = `https://wa.me/${whatsappNumber.replace(/\D/g, "")}`;

  return (
    <main className="min-h-screen bg-background pb-24">
      {/* Story */}
      <section className="px-6 md:px-16 lg:px-24 pt-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 max-w-6xl">
          <div>
            <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-4">
              About us
            </p>
            <h1
              className="text-4xl lg:text-5xl font-light text-foreground mb-6 leading-tight"
              style={{ fontFamily: "'Newsreader', Georgia, serif" }}
            >
              A small operation<br />
              by design.
            </h1>
            <div className="flex flex-col gap-5 text-sm text-muted-foreground leading-[1.8] max-w-[60ch]">
              <p>
                Yorkshire Adoption Home grew out of twenty years of living with this breed. We are not a kennel. We have one or two litters a year, from parents we know well and have health-tested properly.
              </p>
              <p>
                Our puppies are raised in our kitchen, not a kennel block. They sleep beside our bed for the first weeks, spend their days underfoot, and are handled by everyone in the house from day one. Socialisation is not a programme we run — it is what happens when a dog grows up where people live.
              </p>
              <p>
                We are selective because we have to be. A Yorkshire Terrier is a companion animal in the fullest sense: they attach hard, they are prone to real distress when left, and they live a long time. They are also physically fragile in a way that catches people out. Every placement decision we make will define an animal's entire life, and we take that seriously.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="aspect-[4/5] bg-muted rounded-sm overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1609849538514-be556d1d8e10?w=800&h=1000&fit=crop&auto=format"
                alt="A Yorkshire Terrier puppy resting on a bench in the breeder's garden"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Where puppies are raised */}
      <section className="px-6 md:px-16 lg:px-24 pt-20">
        <div className="max-w-6xl">
          <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-4">
            Where we work
          </p>
          <h2
            className="text-3xl font-light text-foreground mb-8"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            Where the puppies grow up
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="aspect-[4/5] bg-muted rounded-sm overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1546527868-ccb7ee7dfa6a?w=600&h=750&fit=crop&auto=format"
                alt="A Yorkshire Terrier puppy in the family home environment"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="aspect-[4/5] bg-muted rounded-sm overflow-hidden sm:mt-8">
              <img
                src="https://images.unsplash.com/photo-1680782378597-e014f7449f2b?w=600&h=750&fit=crop&auto=format"
                alt="A Yorkshire Terrier puppy exploring outdoors"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="aspect-[4/5] bg-muted rounded-sm overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1713575139648-d054ca697376?w=600&h=750&fit=crop&auto=format"
                alt="A Yorkshire Terrier puppy on a bench in the garden"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-[1.8] max-w-[68ch] mt-8">
            This is a family home. The puppies eat where we eat, sleep where we sleep, and grow up surrounded by the sounds and rhythms of ordinary domestic life. We believe this is what produces a well-adjusted, confident companion.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 md:px-16 lg:px-24 pt-20">
        <div className="max-w-3xl">
          <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-4">
            Frequently asked questions
          </p>
          <h2
            className="text-3xl font-light text-foreground mb-8"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            Questions we hear often
          </h2>
          <div>
            {FAQ.map((item, i) => (
              <AccordionItem key={i} q={item.q} a={item.a} />
            ))}
            <div className="border-t border-border" />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="px-6 md:px-16 lg:px-24 pt-20">
        <div className="max-w-xl">
          <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-4">
            Contact
          </p>
          <h2
            className="text-3xl font-light text-foreground mb-4"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            Get in touch
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            We respond to WhatsApp and email. We do not operate a phone line. For application enquiries, please submit an application first — we cannot review applications through informal channels.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href={whatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 border border-border rounded-sm px-5 py-4 hover:border-foreground/40 transition-colors group"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-accent">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                WhatsApp
              </span>
            </a>
            <a
              href={`mailto:${contactEmail}`}
              className="flex items-center gap-3 border border-border rounded-sm px-5 py-4 hover:border-foreground/40 transition-colors group"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                {contactEmail}
              </span>
            </a>
          </div>
          <div className="mt-8">
            <button
              onClick={() => navigate("/apply")}
              className="inline-block bg-primary text-primary-foreground px-8 py-3 text-sm font-medium rounded-sm hover:bg-[#A0752F] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Start an application
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

import type { Puppy } from "../../lib/models";
import { useRouter } from "../router";

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  pending: "Pending review",
  placed: "Placed",
};

const STATUS_STYLES: Record<string, string> = {
  available: "bg-[#E8F0E9] text-[#2D6A35] border-[#B8D9BB]",
  pending: "bg-[#EDEFF2] text-[#3C5166] border-[#C3CEDB]",
  placed: "bg-[#F0F0F0] text-[#888888] border-[#D8D8D8]",
};

export function PuppyCard({ puppy, className = "" }: { puppy: Puppy; className?: string }) {
  const { navigate } = useRouter();
  const isPlaced = puppy.status === "placed";

  return (
    <article
      className={`group bg-card border border-border rounded-sm overflow-hidden flex flex-col transition-all duration-300 ${
        isPlaced
          ? "opacity-50 cursor-default"
          : "hover:-translate-y-1 hover:shadow-lg cursor-pointer"
      } ${className}`}
      onClick={() => !isPlaced && navigate(`/puppies/${puppy.slug}`)}
    >
      <div className="relative aspect-[4/5] bg-muted overflow-hidden">
        <img
          src={puppy.photos[0]}
          alt={`${puppy.name}, a ${puppy.sex} Yorkshire Terrier puppy`}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          style={{ display: isPlaced ? "block" : undefined }}
        />
        <div
          className={`absolute top-3 right-3 text-[11px] font-medium tracking-wide px-2 py-1 rounded-sm border ${STATUS_STYLES[puppy.status]}`}
        >
          {STATUS_LABELS[puppy.status]}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3
            className="text-xl font-medium tracking-tight"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            {puppy.name}
          </h3>
          <span className="text-sm text-muted-foreground shrink-0">
            {puppy.sex === "male" ? "M" : "F"} · {puppy.ageWeeks}w
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {puppy.temperamentTags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] tracking-wide uppercase font-medium text-accent border border-accent/30 px-2 py-0.5 rounded-sm"
            >
              {tag}
            </span>
          ))}
        </div>

        {!isPlaced && (
          <button
            className="mt-auto pt-3 w-full text-sm font-medium text-primary border border-primary/30 rounded-sm py-2.5 hover:bg-primary hover:text-primary-foreground transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/apply?puppy=${puppy.slug}`);
            }}
          >
            Apply for {puppy.name}
          </button>
        )}
      </div>
    </article>
  );
}

import { useState } from "react";
import { listPuppies } from "../../services/puppies";
import type { PuppyStatus } from "../../lib/models";
import { useAsync } from "../../hooks/useAsync";
import { PuppyCard } from "../components/PuppyCard";

type Filter = "all" | PuppyStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "pending", label: "Pending review" },
  { value: "placed", label: "Placed" },
];

export default function PuppiesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, loading, error } = useAsync(() => listPuppies(), []);

  const puppies = data ?? [];
  const visible = filter === "all" ? puppies : puppies.filter((p) => p.status === filter);

  return (
    <main className="min-h-screen bg-background">
      <div className="px-6 md:px-16 lg:px-24 pt-14 pb-6">
        <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-3">
          Our puppies
        </p>
        <h1
          className="text-4xl lg:text-5xl font-light text-foreground mb-4 leading-tight"
          style={{ fontFamily: "'Newsreader', Georgia, serif" }}
        >
          Available puppies
        </h1>
        <p className="text-base text-muted-foreground max-w-lg leading-relaxed mb-8">
          Placed puppies stay visible as a record. They cannot be applied for, but they are part of our history and we like keeping them here.
        </p>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-10" role="group" aria-label="Filter puppies by status">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`text-sm font-medium px-4 py-1.5 rounded-sm border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                }`}
                aria-pressed={active}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 md:px-16 lg:px-24 pb-24">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border border-border rounded-sm overflow-hidden animate-pulse">
                <div className="aspect-[4/5] bg-muted" />
                <div className="p-5 flex flex-col gap-3">
                  <div className="h-5 bg-muted rounded-sm w-1/2" />
                  <div className="h-4 bg-muted rounded-sm w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-muted-foreground text-sm py-12">
            We could not load the puppies just now. Please refresh the page.
          </p>
        ) : visible.length === 0 ? (
          <p className="text-muted-foreground text-sm py-12">No puppies in this category right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((puppy) => (
              <PuppyCard key={puppy.id} puppy={puppy} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

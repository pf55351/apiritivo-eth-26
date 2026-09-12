"use client";

import { useMemo, useState } from "react";
import { SERVICE_CATEGORIES, categoryLabel } from "@apiritivo/shared";
import { useMarketplace } from "@/lib/use-services";
import { useSession } from "@/lib/session";
import { ServiceCard } from "@/components/service-card";
import { Button, EmptyState, ErrorNotice, SectionTitle, ServiceCardSkeleton } from "@/components/ui";

export default function MarketplacePage() {
  const { data, loading, error, reload } = useMarketplace();
  const session = useSession();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const present = new Set((data ?? []).map((s) => s.category));
    const known = SERVICE_CATEGORIES.map((c) => c.slug).filter((slug) => present.has(slug));
    const custom = Array.from(present).filter((slug) => !SERVICE_CATEGORIES.some((c) => c.slug === slug));
    return [...known, ...custom];
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.providerName ?? "").toLowerCase().includes(q) ||
        s.serviceId.toLowerCase().includes(q) ||
        categoryLabel(s.category).toLowerCase().includes(q)
      );
    });
  }, [data, query, category]);

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Marketplace"
        title="Find your next connection."
        description="Discover APIs, inspect their manifests, and choose the access that fits your next build."
        right={
          <div className="flex items-center gap-2 text-xs text-ink-400">
            {data ? <span>{data.length} services</span> : null}
            <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search services, providers, or categories</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services, providers, categories…"
            className="field-control"
          />
        </label>
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="field-control sm:w-56"
        >
          <option value="all">All categories</option>
          {categories.map((slug) => (
            <option key={slug} value={slug}>
              {categoryLabel(slug)}
            </option>
          ))}
        </select>
      </div>

      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("all")}
            aria-pressed={category === "all"}
            className={`min-h-9 rounded-control border px-3 py-1 text-xs transition-colors ${category === "all" ? "border-spritz-400/60 bg-spritz-500/10 text-spritz-300" : "border-line text-muted hover:border-line-strong"}`}
          >
            All
          </button>
          {categories.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => setCategory(slug === category ? "all" : slug)}
              aria-pressed={category === slug}
              className={`min-h-9 rounded-control border px-3 py-1 text-xs transition-colors ${category === slug ? "border-spritz-400/60 bg-spritz-500/10 text-spritz-300" : "border-line text-muted hover:border-line-strong"}`}
            >
              {categoryLabel(slug)}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <ErrorNotice message={error.message} detail={error.detail} onRetry={reload} /> : null}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ServiceCardSkeleton key={i} />
          ))}
        </div>
      ) : !error && (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon="◌"
          title="No services published yet."
          description="Be the first provider: describe your API, upload the manifest to Swarm and publish it on Arkiv."
          action={<Button href={session.identity ? "/provider/new" : "/provider"}>Publish a service</Button>}
        />
      ) : !error && filtered.length === 0 ? (
        <EmptyState
          icon="⌕"
          title="Nothing matches your search."
          description="Try another keyword or clear the category filter."
          action={
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <ServiceCard key={s.serviceId} service={s} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { categoryLabel, SERVICE_CATEGORIES } from "@apiritivo/shared";
import { useMemo, useState } from "react";
import { ServiceCard } from "@/components/service-card";
import { Button, EmptyState, ErrorNotice, SectionTitle, ServiceCardSkeleton } from "@/components/ui";
import { useMarketplace } from "@/lib/use-services";

const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"];

export default function MarketplacePage() {
  const { data, loading, error, reload } = useMarketplace();
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
        title="Explore APIs"
        right={
          <div className="flex items-center gap-2 text-xs text-subtle">
            <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search services, providers, or categories</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search APIs or providers" className="field-control" />
        </label>
        <select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)} className="field-control sm:w-56">
          <option value="all">All categories</option>
          {categories.map((slug) => (
            <option key={slug} value={slug}>
              {categoryLabel(slug)}
            </option>
          ))}
        </select>
      </div>

      {!loading && !error ? (
        <p role="status" className="text-xs text-subtle">
          {filtered.length} {filtered.length === 1 ? "API" : "APIs"}
          {query || category !== "all" ? " found" : " available"}
        </p>
      ) : null}

      {error ? <ErrorNotice message={error.message} detail={error.detail} onRetry={reload} /> : null}

      {loading ? (
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETON_KEYS.map((k) => (
            <ServiceCardSkeleton key={k} />
          ))}
        </div>
      ) : !error && (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon="◌"
          title="No APIs yet"
          description="Published APIs will appear here."
          action={
            <Button variant="ghost" onClick={reload}>
              Refresh
            </Button>
          }
        />
      ) : !error && filtered.length === 0 ? (
        <EmptyState
          icon="⌕"
          title="No matching APIs"
          description="Try another search or clear filters."
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
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <ServiceCard key={s.serviceId} service={s} />
          ))}
        </div>
      )}
    </div>
  );
}

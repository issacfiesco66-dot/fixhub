"use client";

import { useState } from "react";
import { Library, Wrench, FolderTree, Tag, MapPin } from "lucide-react";
import type { SvcRow, CatRow, BrandRow, CityRow, StateRow } from "./types";
import { ServicesTab } from "./ServicesTab";
import { CategoriesTab } from "./CategoriesTab";
import { BrandsTab } from "./BrandsTab";
import { CitiesTab } from "./CitiesTab";

type Tab = "services" | "categories" | "brands" | "cities";

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "services", label: "Servicios", icon: Wrench },
  { id: "categories", label: "Categorías", icon: FolderTree },
  { id: "brands", label: "Marcas", icon: Tag },
  { id: "cities", label: "Ciudades", icon: MapPin },
];

export function CatalogClient({
  initialServices,
  initialCategories,
  initialBrands,
  initialCities,
  states,
}: {
  initialServices: SvcRow[];
  initialCategories: CatRow[];
  initialBrands: BrandRow[];
  initialCities: CityRow[];
  states: StateRow[];
}) {
  const [tab, setTab] = useState<Tab>("services");

  // Categorías y marcas se comparten con la tab de servicios (para los selects),
  // por eso viven en el shell y se pasan hacia abajo.
  const [categories, setCategories] = useState<CatRow[]>(initialCategories);
  const [brands, setBrands] = useState<BrandRow[]>(initialBrands);

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-zinc-900">
          <Library className="h-7 w-7 text-indigo-600" />
          Catálogo
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Servicios, categorías, marcas y ciudades. Al crear un servicio aquí, aparece
          en el buscador y entra al pipeline de SEO.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white/60 p-1">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                active
                  ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/30"
                  : "text-zinc-600 hover:bg-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      {tab === "services" && (
        <ServicesTab initial={initialServices} categories={categories} brands={brands} />
      )}
      {tab === "categories" && <CategoriesTab items={categories} onChange={setCategories} />}
      {tab === "brands" && <BrandsTab items={brands} onChange={setBrands} />}
      {tab === "cities" && <CitiesTab initial={initialCities} states={states} />}
    </div>
  );
}

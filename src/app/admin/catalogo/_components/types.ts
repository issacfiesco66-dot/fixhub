// Tipos compartidos por las pestañas del catálogo (serializados desde el server).

export type SvcRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  requiresBrand: boolean;
  basePrice: number;
  active: boolean;
  brandIds: string[];
  leadCount: number;
  technicianCount: number;
};

export type CatRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  order: number;
  active: boolean;
  serviceCount: number;
};

export type BrandRow = {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  active: boolean;
  serviceCount: number;
  leadCount: number;
};

export type CityRow = {
  id: string;
  slug: string;
  name: string;
  stateId: string;
  stateName: string;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  leadCount: number;
  zoneCount: number;
  coverageCount: number;
};

export type StateRow = { id: string; name: string; slug: string };

export type Option = { value: string; label: string };

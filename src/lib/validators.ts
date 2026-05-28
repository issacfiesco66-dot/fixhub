import { z } from "zod";

// .strict() en todos los schemas para rechazar campos extra (cierra H-5 del audit:
// previene mass assignment futuro cuando se agreguen columnas sensibles al schema)

export const createLeadSchema = z
  .object({
    clientName: z.string().min(2, "Tu nombre es requerido").max(80),
    clientPhone: z
      .string()
      .min(10, "Teléfono inválido")
      .max(20)
      .regex(/^[+\d\s\-()]+$/, "Teléfono inválido"),
    clientEmail: z.string().email().optional().or(z.literal("")),
    serviceSlug: z.string().min(1),
    brandSlug: z.string().optional(),
    citySlug: z.string().min(1),
    zoneSlug: z.string().optional(),
    addressHint: z.string().max(200).optional(),
    failure: z.string().min(10, "Cuéntanos qué pasa (mínimo 10 caracteres)").max(1000),
    urgency: z.enum(["NORMAL", "URGENT", "EMERGENCY"]).default("NORMAL"),
    source: z.string().optional(),
  })
  .strict();

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const purchaseLeadSchema = z.object({ leadId: z.string().min(1) }).strict();

export const createRechargeSchema = z.object({ packageId: z.string().min(1) }).strict();

// ─────────────────────────────────────────────────────────────────────
// CATÁLOGO (admin CRUD) — slug opcional: si no se manda, se genera del name.
// El regex del slug acepta solo [a-z0-9-] para que las URLs SEO sean limpias.
// ─────────────────────────────────────────────────────────────────────

const slugField = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Slug solo admite minúsculas, números y guiones");

export const serviceCreateSchema = z
  .object({
    name: z.string().min(2, "Nombre requerido").max(120),
    slug: slugField.optional(),
    description: z.string().max(500).optional().or(z.literal("")),
    categoryId: z.string().min(1, "Categoría requerida"),
    requiresBrand: z.boolean().default(false),
    basePrice: z.number().int().min(0).max(1_000_000).default(450),
    active: z.boolean().default(true),
    brandIds: z.array(z.string()).optional(), // marcas asociadas (pivote ServiceBrand)
  })
  .strict();
export const serviceUpdateSchema = serviceCreateSchema.partial();

export const categoryCreateSchema = z
  .object({
    name: z.string().min(2).max(120),
    slug: slugField.optional(),
    description: z.string().max(500).optional().or(z.literal("")),
    icon: z.string().max(60).optional().or(z.literal("")),
    order: z.number().int().min(0).max(9999).default(0),
    active: z.boolean().default(true),
  })
  .strict();
export const categoryUpdateSchema = categoryCreateSchema.partial();

export const brandCreateSchema = z
  .object({
    name: z.string().min(1).max(120),
    slug: slugField.optional(),
    logo: z.string().max(300).optional().or(z.literal("")),
    active: z.boolean().default(true),
  })
  .strict();
export const brandUpdateSchema = brandCreateSchema.partial();

export const cityCreateSchema = z
  .object({
    name: z.string().min(2).max(120),
    slug: slugField.optional(),
    stateId: z.string().min(1, "Estado requerido"),
    active: z.boolean().default(true),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    phone: z.string().max(20).optional().or(z.literal("")),
  })
  .strict();
export const cityUpdateSchema = cityCreateSchema.partial();

export const stateCreateSchema = z
  .object({
    name: z.string().min(2).max(120),
    slug: slugField.optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────
// USUARIOS (admin CRUD)
// ─────────────────────────────────────────────────────────────────────

export const userCreateSchema = z
  .object({
    email: z.string().email(),
    name: z.string().max(120).optional().or(z.literal("")),
    phone: z.string().max(20).optional().or(z.literal("")),
    role: z.enum(["CLIENT", "TECHNICIAN", "ADMIN"]).default("CLIENT"),
    // Requerido solo para ADMIN (login con password). Se valida en la ruta.
    password: z.string().min(8).max(100).optional(),
  })
  .strict();

export const userUpdateSchema = z
  .object({
    name: z.string().max(120).optional().or(z.literal("")),
    phone: z.string().max(20).optional().or(z.literal("")),
    role: z.enum(["CLIENT", "TECHNICIAN", "ADMIN"]).optional(),
    password: z.string().min(8).max(100).optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────
// TÉCNICOS (admin — edición ampliada)
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// INGEST de prospects (scraper externo → /api/prospectos/ingest)
// ─────────────────────────────────────────────────────────────────────

export const ingestProspectSchema = z
  .object({
    nombre: z.string().min(2).max(160),
    telefono: z.string().max(30).optional().or(z.literal("")),
    email: z.string().max(160).optional().or(z.literal("")),
    direccion: z.string().max(300).optional().or(z.literal("")),
    categoria: z.string().max(120).optional().or(z.literal("")),
    ciudad: z.string().max(120).optional().or(z.literal("")),
  })
  .strict();

export const ingestPayloadSchema = z
  .object({
    prospectos: z.array(ingestProspectSchema).min(1).max(100),
    source: z.string().max(80).optional(),
  })
  .strict();

export const technicianUpdateSchema = z
  .object({
    verified: z.boolean().optional(),
    active: z.boolean().optional(),
    displayName: z.string().min(2).max(120).optional(),
    bio: z.string().max(1000).optional().or(z.literal("")),
    yearsExp: z.number().int().min(0).max(80).optional(),
    // Ajuste de saldo: delta a sumar/restar (positivo o negativo), con motivo.
    // Acotado para evitar montos absurdos por error/abuso del admin.
    balanceAdjustment: z.number().int().min(-1_000_000).max(1_000_000).optional(),
    balanceReason: z.string().max(200).optional(),
    cityIds: z.array(z.string()).optional(),
    serviceIds: z.array(z.string()).optional(),
  })
  .strict();

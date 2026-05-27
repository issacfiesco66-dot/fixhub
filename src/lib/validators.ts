import { z } from "zod";

export const createLeadSchema = z.object({
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
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const purchaseLeadSchema = z.object({
  leadId: z.string().min(1),
});

export const createRechargeSchema = z.object({
  packageId: z.string().min(1),
});

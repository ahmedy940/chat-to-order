import { z } from "zod";

/** Zod schemas for PayPal's responses: nothing from PayPal reaches our code unchecked. */

const AmountSchema = z.object({ currency_code: z.string(), value: z.string() });

export const TokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

export const CreateOrderSchema = z.object({
  id: z.string(),
  status: z.string(),
  links: z.array(z.object({ href: z.string(), rel: z.string() })).default([]),
});

export const OrderStatusSchema = z.object({ id: z.string(), status: z.string() });

const AddressSchema = z.object({
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  admin_area_2: z.string().optional(),
  admin_area_1: z.string().optional(),
  postal_code: z.string().optional(),
  country_code: z.string().optional(),
});
export type PayPalAddress = z.infer<typeof AddressSchema>;

const ShippingSchema = z.object({
  name: z.object({ full_name: z.string().optional() }).optional(),
  address: AddressSchema.optional(),
});

const PayerSchema = z.object({
  name: z.object({ given_name: z.string().optional(), surname: z.string().optional() }).optional(),
  email_address: z.string().optional(),
});
export type PayPalPayer = z.infer<typeof PayerSchema>;

const CaptureSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount: AmountSchema,
  seller_receivable_breakdown: z
    .object({ paypal_fee: AmountSchema.optional(), net_amount: AmountSchema.optional() })
    .optional(),
});

export const CaptureResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  payer: PayerSchema.optional(),
  purchase_units: z
    .array(
      z.object({
        shipping: ShippingSchema.optional(),
        payments: z.object({ captures: z.array(CaptureSchema).default([]) }).optional(),
      }),
    )
    .min(1),
});
export type CaptureResponse = z.infer<typeof CaptureResponseSchema>;

export const RefundResponseSchema = z.object({ id: z.string(), status: z.string(), amount: AmountSchema });

export const PayPalErrorSchema = z.object({
  name: z.string().optional(),
  message: z.string().optional(),
  details: z.array(z.object({ issue: z.string().optional(), description: z.string().optional() })).optional(),
});
export type PayPalErrorBody = z.infer<typeof PayPalErrorSchema>;

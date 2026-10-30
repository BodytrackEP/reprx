import { z } from "zod";
import { idSchema } from "./catalog";

const name = (label: string) =>
  z.string().trim().min(1, `Enter a ${label}.`).max(100);

export const clientSchema = z.object({
  id: z.preprocess((value) => (value === "" ? undefined : value), idSchema.optional()),
  firstName: name("first name"),
  lastName: name("last name"),
  preferredName: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(100).optional(),
  ),
});

export const idListSchema = z.array(idSchema).max(500);

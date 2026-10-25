import { z } from 'zod';

/** Shared label for scenes, layers, and groups. */
export const displayNameSchema = z.string().trim().min(1).max(128);

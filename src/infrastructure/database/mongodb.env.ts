import { fail } from "../../shared/lib/error";

export const MONGODB_URI = process.env.MONGODB_URI || fail("MONGODB_URI is not set")();
export const MONGODB_DATABASE = process.env.MONGODB_DATABASE || fail("MONGODB_DATABASE is not set")();
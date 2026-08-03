// Re-export the root Auth.js handlers so the App Router auth endpoint and the
// rest of the app share one canonical configuration entrypoint.
import { handlers } from "../../../../../auth";

export const { GET, POST } = handlers;

// Re-export the root Auth.js entry so app code can import from one stable
// alias path instead of repeating deep relative paths to the repo root.
export { auth, handlers, signIn, signOut } from "../../../auth";

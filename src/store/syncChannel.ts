/**
 * Multi-window sync — a single BroadcastChannel shared by all store slices.
 * The message handler lives in useStore.ts (it needs the assembled store).
 */
export const syncChannel = new BroadcastChannel('slice-it-sync');

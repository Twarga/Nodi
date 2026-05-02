import { useSyncExternalStore } from "react";
import { store } from "./fileStore";

export const useFsSnapshot = () =>
  useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.entries,
    () => store.entries,
  );

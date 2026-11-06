import { useEffect, useRef } from "react";
import { subscribeToThemeChangedEvent } from "../../../events/changeTheme";

export default function useThemeEvent(handler: () => void) {
  // Keep the latest handler in a ref so we subscribe once,
  // instead of re-subscribing on every render (handlers are inline closures).
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const ctrl = new AbortController();
    subscribeToThemeChangedEvent(() => handlerRef.current(), ctrl.signal);
    return () => ctrl.abort();
  }, []);
}

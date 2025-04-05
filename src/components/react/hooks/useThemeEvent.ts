import { useEffect } from "react";
import { subscribeToThemeChangedEvent } from "../../../events/changeTheme";

export default function useThemeEvent(handler: () => void) {
  useEffect(() => {
    const ctrl = new AbortController();
    const signal = ctrl.signal;

    subscribeToThemeChangedEvent(handler, signal);
    return () => {
      ctrl.abort();
    };
  }, [handler]);
}

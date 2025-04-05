interface ThemeChangedEvent extends Event {
  type: "themeChanged";
}

declare global {
  interface WindowEventMap {
    themeChanged: ThemeChangedEvent;
  }
}

export const themeChangedEvent = new Event("themeChanged") as ThemeChangedEvent;

export const dispatchThemeChangedEvent = () => {
  window.dispatchEvent(themeChangedEvent);
};

export const subscribeToThemeChangedEvent = (
  callback: () => void,
  signal?: AbortSignal,
) => {
  window.addEventListener("themeChanged", callback, {
    signal,
  });
};

export const unsubscribeFromThemeChangedEvent = (callback: () => void) => {
  window.removeEventListener("themeChanged", callback);
};

import { dispatchThemeChangedEvent } from "./events/changeTheme";

const changeTheme = () => {
  const themeContext = document.querySelector(
    `[data-theme-context="nick"]`,
  ) as HTMLDivElement;
  if (!themeContext) return;

  const currentTheme = Number(themeContext.getAttribute("data-theme") || 0);
  const nextTheme = currentTheme === 0 ? 1 : 0;
  const randomHue = Math.floor(Math.random() * 360);

  // Avoid some weird behavior with css animations,
  // To fix those entrance animation in css some selectors are
  // pointing to the original hue, if that hue is not set as 350 again
  // all will be working fine.
  themeContext.setAttribute(
    "data-theme-hue",
    String(randomHue === 350 ? 351 : randomHue),
  );
  themeContext.style.setProperty("--_app-hue", randomHue.toString());
  themeContext.setAttribute("data-theme", String(nextTheme));

  repaintingForIOSUsers();
  dispatchThemeChangedEvent();
};

export const repaintingForIOSUsers = () => {
  // IOS re painting bug on no layout css changes
  document.body.style.translate = "0px";
  setTimeout(() => {
    document.body.style.removeProperty("translate");
  }, 0);
};

export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): T {
  let lastCall = 0;

  return function (...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  } as T;
}

export const throttleChangeTheme = throttle(changeTheme, 100);

export function modifyHSL(
  hslString: string,
  modifiers: {
    h?: (h: number) => number;
    s?: (s: number) => number;
    l?: (l: number) => number;
  },
): string {
  const themeContext = document.querySelector(`[data-theme-context="nick"]`);
  if (!themeContext) return hslString;

  const currentHue = themeContext.getAttribute("data-theme-hue") || "350";

  const hslReplacedString = hslString.replace(
    "attr(data-theme-hue type(<number>), 350)",
    currentHue,
  );
  const match = hslReplacedString.match(
    /^hsl\(\s*(\d+),\s*(\d+)%?,\s*(\d+)%?\s*\)$/i,
  );
  if (!match) {
    console.log(`Invalid HSL string: ${hslString}`);
    throw new Error("Invalid HSL format");
  }

  const [_, hRaw, sRaw, lRaw] = match;
  const h = parseInt(hRaw, 10);
  const s = parseInt(sRaw, 10);
  const l = parseInt(lRaw, 10);

  const newH = modifiers.h ? modifiers.h(h) : h;
  const newS = modifiers.s ? modifiers.s(s) : s;
  const newL = modifiers.l ? modifiers.l(l) : l;

  return `hsl(${Math.round(newH)}, ${Math.round(newS >= 100 ? 100 : newS)}%, ${Math.round(newL >= 100 ? 100 : newL)}%)`;
}

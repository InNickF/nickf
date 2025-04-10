export const getDocumentStyles = () => {
  const themeContext = document?.querySelector(
    '[data-theme-context="nick"]',
  ) as HTMLDivElement;
  const activeTheme = Number(themeContext?.getAttribute("data-theme")) || 0;
  const themeStyles = getComputedStyle(themeContext);
  const color = themeStyles.getPropertyValue("--color-primary");
  const colorOverSecondary = themeStyles.getPropertyValue(
    "--color-over-secondary",
  );
  const currentHue = themeContext?.getAttribute("data-theme-hue") || "350";
  return {
    activeTheme,
    color,
    currentHue,
    colorOverSecondary,
  };
};

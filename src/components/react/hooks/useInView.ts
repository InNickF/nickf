import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether an element is (close to) the viewport.
 * Used to pause WebGL render loops while their canvas is off-screen.
 */
export default function useInView<T extends HTMLElement>(
  rootMargin = "100px",
) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return [ref, inView] as const;
}

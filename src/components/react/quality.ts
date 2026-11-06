export type Quality = "high" | "low";

const WEAK_GPU =
  /intel|uhd|iris|mali|adreno|powervr|swiftshader|llvmpipe|basic render|software/i;

/**
 * Cheap, network-free guess of how much GPU/CPU budget the device has.
 * Force a tier for testing with `?quality=low` or `?quality=high`.
 */
export function detectQuality(): Quality {
  if (typeof window === "undefined") return "high";

  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "low" || forced === "high") return forced;

  // Note: deviceMemory isn't used. Privacy browsers (Brave) fake it, which
  // misclassified fast machines. Real slowdowns are caught by PerformanceMonitor.
  if (window.matchMedia("(pointer: coarse)").matches) return "low";
  if ((navigator.hardwareConcurrency ?? 8) <= 4) return "low";

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) return "low";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (WEAK_GPU.test(renderer)) return "low";
  } catch {
    // ignore, fall through to high and let PerformanceMonitor decide
  }

  return "high";
}

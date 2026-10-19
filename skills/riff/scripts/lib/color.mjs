// Color parsing and OKLab math shared by extract.mjs and originality.mjs.
// No dependencies. sRGB channels are 0-255, alpha is 0-1.

export const COLOR_RE =
  /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])|\b(?:rgba?|hsla?|oklch|oklab)\([^()]*\)/gi;

// Chroma below this reads as a neutral (white, grey, near-black).
export const NEUTRAL_CHROMA = 0.03;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Number or percentage; percentages are mapped onto `scale`.
function num(token, scale = 1) {
  if (token == null) return NaN;
  const t = String(token).trim();
  if (t.endsWith('%')) return (parseFloat(t) / 100) * scale;
  return parseFloat(t);
}

function hue(token) {
  const t = String(token).trim().toLowerCase();
  const v = parseFloat(t);
  if (t.endsWith('turn')) return v * 360;
  if (t.endsWith('grad')) return v * 0.9;
  if (t.endsWith('rad')) return (v * 180) / Math.PI;
  return v;
}

// Splits "a b c / d" and "a, b, c, d" into [a, b, c, d].
function args(inner) {
  const [main, alpha] = inner.split('/');
  const parts = main.split(/[\s,]+/).filter(Boolean);
  if (alpha != null) parts[3] = alpha.trim();
  return parts;
}

function srgbFromLinear(c) {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
  return clamp(Math.round(v * 255), 0, 255);
}

function linearFromSrgb(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function oklabToRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: srgbFromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: srgbFromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: srgbFromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const k = (n) => (n + h / 30) % 12;
  const f = (n) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

// Accepts both "50%" and the modern unitless "50" for HSL saturation/lightness.
function unit(token) {
  const v = num(token, 1);
  return String(token).trim().endsWith('%') ? v : v / 100;
}

export function parseColor(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(h)) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  const m = s.match(/^(rgba?|hsla?|oklch|oklab)\((.*)\)$/);
  if (!m || /var\(|calc\(|\bfrom\b|none/.test(m[2])) return null;
  const p = args(m[2]);
  if (p.length < 3) return null;
  const alpha = p[3] != null ? num(p[3], 1) : 1;
  let rgb;
  if (m[1].startsWith('rgb')) {
    rgb = { r: num(p[0], 255), g: num(p[1], 255), b: num(p[2], 255) };
  } else if (m[1].startsWith('hsl')) {
    rgb = hslToRgb(hue(p[0]), unit(p[1]), unit(p[2]));
  } else if (m[1] === 'oklch') {
    const L = num(p[0], 1), C = num(p[1], 0.4), H = (hue(p[2]) * Math.PI) / 180;
    rgb = oklabToRgb(L, C * Math.cos(H), C * Math.sin(H));
  } else {
    rgb = oklabToRgb(num(p[0], 1), num(p[1], 0.4), num(p[2], 0.4));
  }
  if ([rgb.r, rgb.g, rgb.b, alpha].some((v) => Number.isNaN(v))) return null;
  return {
    r: clamp(Math.round(rgb.r), 0, 255),
    g: clamp(Math.round(rgb.g), 0, 255),
    b: clamp(Math.round(rgb.b), 0, 255),
    a: clamp(alpha, 0, 1),
  };
}

export function toHex({ r, g, b }) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function toOklab({ r, g, b }) {
  const lr = linearFromSrgb(r), lg = linearFromSrgb(g), lb = linearFromSrgb(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function toOklch(rgb) {
  const { L, a, b } = toOklab(rgb);
  return { L, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

// Euclidean distance in OKLab, scaled so ~2 is "just noticeable".
export function deltaE(rgb1, rgb2) {
  const x = toOklab(rgb1), y = toOklab(rgb2);
  return Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b) * 100;
}

// Greys, plus the tinted near-blacks/near-whites and slate greys sites use for text
// and surfaces. These carry no brand identity.
export function isNeutral(rgb) {
  const { L, C } = toOklch(rgb);
  if (C < NEUTRAL_CHROMA) return true;
  if (C < 0.05) return true;
  return C < 0.08 && (L < 0.3 || L > 0.92);
}

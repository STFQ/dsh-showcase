import sharp from "sharp";
import type { Moment, OutputFormat, ThemeName } from "./types.js";

const WIDTH = 1280;
const HEIGHT = 720;
const SOCIAL_HEIGHT = 640;

interface Theme {
  readonly background: string;
  readonly background2: string;
  readonly panel: string;
  readonly panelBorder: string;
  readonly text: string;
  readonly muted: string;
  readonly accent: string;
  readonly accent2: string;
  readonly positive: string;
  readonly negative: string;
}

const THEMES: Record<ThemeName, Theme> = {
  deepsea: {
    background: "#06141f",
    background2: "#0a2635",
    panel: "#0d202c",
    panelBorder: "#1b4355",
    text: "#e8f7ff",
    muted: "#87aabd",
    accent: "#4de4c1",
    accent2: "#39a9ff",
    positive: "#62e6a7",
    negative: "#ff718a",
  },
  midnight: {
    background: "#0b0b16",
    background2: "#19162b",
    panel: "#171624",
    panelBorder: "#34314d",
    text: "#f5f2ff",
    muted: "#aaa3c4",
    accent: "#a78bfa",
    accent2: "#60a5fa",
    positive: "#6ee7b7",
    negative: "#fb7185",
  },
  paper: {
    background: "#f4f0e8",
    background2: "#e8dfd0",
    panel: "#fffdf8",
    panelBorder: "#d8cdbb",
    text: "#26231e",
    muted: "#746b5f",
    accent: "#087f5b",
    accent2: "#1971c2",
    positive: "#087f5b",
    negative: "#c92a2a",
  },
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function visualUnits(value: string): number {
  return [...value].reduce(
    (sum, char) => sum + ((char.codePointAt(0) ?? 0) > 0xff ? 1 : 0.55),
    0,
  );
}

function wrap(value: string, maxUnits: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\t/g, "  ").split("\n")) {
    if (lines.length >= maxLines) break;
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const tokens = /\s/.test(paragraph)
      ? paragraph.split(/(?<=\s)|(?=\s)/)
      : [...paragraph];
    let current = "";
    for (const token of tokens) {
      if (visualUnits(current + token) <= maxUnits || current.length === 0) {
        current += token;
      } else {
        lines.push(current.trimEnd());
        current = token.trimStart();
        if (lines.length >= maxLines) break;
      }
    }
    if (lines.length < maxLines && current) lines.push(current.trimEnd());
  }
  if (
    lines.length === maxLines &&
    visualUnits(lines[maxLines - 1] ?? "") >= maxUnits - 2
  ) {
    lines[maxLines - 1] = `${(lines[maxLines - 1] ?? "").slice(0, -1)}…`;
  }
  return lines;
}

function lineFill(line: string, theme: Theme, kind: Moment["kind"]): string {
  if (kind === "diff" && line.startsWith("+") && !line.startsWith("+++"))
    return theme.positive;
  if (kind === "diff" && line.startsWith("-") && !line.startsWith("---"))
    return theme.negative;
  if (kind === "diff" && (line.startsWith("@@") || line.startsWith("diff ")))
    return theme.accent2;
  return theme.text;
}

function background(theme: Theme, height = HEIGHT): string {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${theme.background}" />
        <stop offset="100%" stop-color="${theme.background2}" />
      </linearGradient>
      <radialGradient id="glow" cx="82%" cy="10%" r="70%">
        <stop offset="0%" stop-color="${theme.accent2}" stop-opacity="0.22" />
        <stop offset="100%" stop-color="${theme.accent2}" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${height}" fill="url(#bg)" />
    <rect width="${WIDTH}" height="${height}" fill="url(#glow)" />`;
}

function progress(theme: Theme, current: number, total: number): string {
  const width = 540;
  const gap = 12;
  const itemWidth = (width - gap * (total - 1)) / total;
  return Array.from({ length: total }, (_, index) => {
    const x = 650 + index * (itemWidth + gap);
    const fill = index <= current ? theme.accent : theme.panelBorder;
    return `<rect x="${x}" y="650" width="${itemWidth}" height="5" rx="2.5" fill="${fill}" />`;
  }).join("");
}

function coverSvg(
  title: string,
  theme: Theme,
  total: number,
  height = HEIGHT,
): Buffer {
  const titleLines = wrap(title, 22, 2);
  const titleSvg = titleLines
    .map(
      (line, index) =>
        `<text x="80" y="${245 + index * 68}" fill="${theme.text}" font-size="58" font-weight="760">${escapeXml(line)}</text>`,
    )
    .join("");
  return Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
    ${background(theme, height)}
    <style>text { font-family: Inter, ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif; }</style>
    <text x="80" y="75" fill="${theme.accent}" font-size="22" font-weight="750" letter-spacing="3">DSH SHOWCASE</text>
    <text x="80" y="127" fill="${theme.muted}" font-size="21">DeepSeek Harness session → README-ready demo</text>
    ${titleSvg}
    <g transform="translate(80 405)">
      <rect width="195" height="48" rx="24" fill="${theme.panel}" stroke="${theme.panelBorder}" />
      <text x="22" y="31" fill="${theme.accent}" font-size="18" font-weight="650">LOCAL ONLY</text>
      <rect x="211" width="214" height="48" rx="24" fill="${theme.panel}" stroke="${theme.panelBorder}" />
      <text x="233" y="31" fill="${theme.accent2}" font-size="18" font-weight="650">SECRET REDACTION</text>
      <rect x="441" width="196" height="48" rx="24" fill="${theme.panel}" stroke="${theme.panelBorder}" />
      <text x="463" y="31" fill="${theme.positive}" font-size="18" font-weight="650">0 MODEL CALLS</text>
    </g>
    <rect x="80" y="510" width="720" height="70" rx="16" fill="${theme.panel}" stroke="${theme.panelBorder}" />
    <circle cx="112" cy="545" r="8" fill="${theme.accent}" />
    <text x="140" y="552" fill="${theme.text}" font-size="22" font-family="ui-monospace, Consolas, monospace">dsh-showcase session.jsonl</text>
    <text x="80" y="${height - 47}" fill="${theme.muted}" font-size="17">Semantic rendering, not screen recording.</text>
    ${height === HEIGHT ? progress(theme, 0, total) : ""}
  </svg>`);
}

function momentSvg(
  moment: Moment,
  theme: Theme,
  current: number,
  total: number,
): Buffer {
  const titleLines = wrap(moment.title, 32, 2);
  const mono = moment.kind === "tool" || moment.kind === "diff";
  const bodyLines = wrap(moment.body, mono ? 80 : 47, mono ? 11 : 9);
  const titleSvg = titleLines
    .map(
      (line, index) =>
        `<text x="112" y="${205 + index * 53}" fill="${theme.text}" font-size="42" font-weight="740">${escapeXml(line)}</text>`,
    )
    .join("");
  const bodyStart = 330;
  const bodySvg = bodyLines
    .map((line, index) => {
      const fill = lineFill(line, theme, moment.kind);
      return `<text x="112" y="${bodyStart + index * (mono ? 27 : 34)}" fill="${fill}" font-size="${mono ? 19 : 24}" font-family="${mono ? "ui-monospace, Consolas, monospace" : "Inter, ui-sans-serif, system-ui, sans-serif"}">${escapeXml(line || " ")}</text>`;
    })
    .join("");
  return Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${background(theme)}
    <style>text { font-family: Inter, ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif; }</style>
    <text x="80" y="68" fill="${theme.accent}" font-size="19" font-weight="760" letter-spacing="2.6">${escapeXml(moment.eyebrow)}</text>
    <text x="1195" y="68" fill="${theme.muted}" text-anchor="end" font-size="17">${current + 1} / ${total}</text>
    <rect x="80" y="102" width="1120" height="500" rx="26" fill="${theme.panel}" stroke="${theme.panelBorder}" stroke-width="2" />
    <rect x="80" y="102" width="9" height="500" rx="4.5" fill="${theme.accent}" />
    ${titleSvg}
    <line x1="112" y1="286" x2="1164" y2="286" stroke="${theme.panelBorder}" />
    ${bodySvg}
    <text x="80" y="668" fill="${theme.muted}" font-size="17">Local • Redacted • Semantic</text>
    ${progress(theme, current, total)}
  </svg>`);
}

async function svgToRaw(svg: Buffer): Promise<Buffer> {
  return sharp(svg, { density: 144 })
    .resize(WIDTH, HEIGHT)
    .ensureAlpha()
    .raw()
    .toBuffer();
}

async function encodeAnimation(
  frames: readonly Buffer[],
  format: "webp" | "gif",
): Promise<Buffer> {
  const rawFrames = await Promise.all(frames.map(svgToRaw));
  const delay = frames.map((_, index) =>
    index === 0 ? 1900 : index === frames.length - 1 ? 2200 : 1500,
  );
  const input = sharp(Buffer.concat(rawFrames), {
    animated: true,
    raw: {
      width: WIDTH,
      height: HEIGHT * frames.length,
      channels: 4,
      pageHeight: HEIGHT,
    },
  });
  return format === "webp"
    ? input.webp({ quality: 82, effort: 5, loop: 0, delay }).toBuffer()
    : input.gif({ effort: 7, colours: 160, loop: 0, delay }).toBuffer();
}

export interface RenderedAssets {
  readonly webp?: Buffer;
  readonly gif?: Buffer;
  readonly poster: Buffer;
  readonly socialPreview: Buffer;
}

export async function renderAssets(
  moments: readonly Moment[],
  title: string,
  themeName: ThemeName,
  format: OutputFormat,
): Promise<RenderedAssets> {
  const theme = THEMES[themeName];
  const total = moments.length + 1;
  const frames = [
    coverSvg(title, theme, total),
    ...moments.map((moment, index) =>
      momentSvg(moment, theme, index + 1, total),
    ),
  ];
  const poster = await sharp(frames.at(-1) ?? frames[0])
    .png({ compressionLevel: 9 })
    .toBuffer();
  const socialPreview = await sharp(
    coverSvg(title, theme, total, SOCIAL_HEIGHT),
  )
    .png({ compressionLevel: 9 })
    .toBuffer();
  const [webp, gif] = await Promise.all([
    format === "webp" || format === "both"
      ? encodeAnimation(frames, "webp")
      : Promise.resolve(undefined),
    format === "gif" || format === "both"
      ? encodeAnimation(frames, "gif")
      : Promise.resolve(undefined),
  ]);
  return {
    ...(webp === undefined ? {} : { webp }),
    ...(gif === undefined ? {} : { gif }),
    poster,
    socialPreview,
  };
}

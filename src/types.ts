export type ThemeName = "deepsea" | "midnight" | "paper";
export type OutputFormat = "webp" | "gif" | "both";
export type RedactMode = "auto" | "strict" | "off";
export type MomentKind = "prompt" | "tool" | "diff" | "result" | "answer";

export interface SessionHeader {
  readonly type: "session";
  readonly version?: number;
  readonly id?: string;
  readonly createdAt?: number;
  readonly cwd?: string;
  readonly agentPreset?: string;
  readonly [key: string]: unknown;
}

export interface SessionEvent {
  readonly type: string;
  readonly seq?: number;
  readonly time?: number;
  readonly data?: unknown;
  readonly [key: string]: unknown;
}

export interface ParsedSession {
  readonly header?: SessionHeader;
  readonly events: SessionEvent[];
  readonly sourceFormat: "jsonl" | "jsonl.zstd" | "dsh-export.zip";
  readonly inputLabel: string;
  readonly warnings: string[];
  readonly subagentCount: number;
}

export interface Moment {
  readonly kind: MomentKind;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly seq?: number;
}

export interface RedactionSummary {
  readonly total: number;
  readonly byType: Readonly<Record<string, number>>;
}

export interface ArtifactResult {
  readonly type:
    | "animated-webp"
    | "animated-gif"
    | "poster"
    | "social-preview"
    | "readme-snippet"
    | "manifest";
  readonly path: string;
  readonly mime: string;
  readonly bytes: number;
}

export interface ShowcaseResult {
  readonly schemaVersion: 1;
  readonly success: true;
  readonly dryRun: boolean;
  readonly input: {
    readonly path: string;
    readonly format: ParsedSession["sourceFormat"];
    readonly events: number;
    readonly subagents: number;
  };
  readonly scenes: Array<Pick<Moment, "kind" | "eyebrow" | "title">>;
  readonly artifacts: ArtifactResult[];
  readonly redactions: RedactionSummary;
  readonly warnings: string[];
  readonly durationMs: number;
}

export interface ShowcaseOptions {
  readonly input: string | Uint8Array;
  readonly inputLabel?: string;
  readonly output: string;
  readonly format: OutputFormat;
  readonly theme: ThemeName;
  readonly redact: RedactMode;
  readonly title?: string;
  readonly maxScenes: number;
  readonly dryRun: boolean;
  readonly overwrite: boolean;
}

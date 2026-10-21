export interface EnvEntry {
  key: string;
  value: string;
  rawValue: string;
  sensitive: boolean;
  empty: boolean;
  line: number;
}

export interface ParseResult {
  entries: EnvEntry[];
  warnings: string[];
}

export interface CliOptions {
  file?: string;
  positionalFile?: string;
  command?: "diff" | "example" | "check";
  targetFile?: string;
  filter?: string;
  key?: string;
  strict?: boolean;
  placeholderStyle?: "bracket" | "dummy" | "empty";
  show: boolean;
  raw: boolean;
  json: boolean;
  noColor: boolean;
  quiet: boolean;
  sort: boolean;
  help: boolean;
  version: boolean;
}

export interface Summary {
  total: number;
  sensitive: number;
  visible: number;
  empty: number;
}

export interface JsonOutput {
  file: string;
  variables: Array<{
    key: string;
    value: string;
    sensitive: boolean;
    empty: boolean;
  }>;
  summary: {
    total: number;
    sensitive: number;
    empty: number;
  };
}

export interface EnvDiffChange {
  key: string;
  baseValue: string;
  targetValue: string;
  oldValue: string;
  newValue: string;
  baseEntry: EnvEntry;
  targetEntry: EnvEntry;
  base: EnvEntry;
  target: EnvEntry;
  sensitive: boolean;
}

export interface EnvDiffSummary {
  missing: number;
  extra: number;
  changed: number;
  identical: number;
  total: number;
}

export interface EnvDiffResult {
  missing: EnvEntry[];
  extra: EnvEntry[];
  changed: EnvDiffChange[];
  identical: EnvEntry[];
  summary: EnvDiffSummary;
}

export interface DiffOptions {
  noColor?: boolean;
  show?: boolean;
  quiet?: boolean;
  raw?: boolean;
}

export interface FilterOptions {
  filter?: string;
  key?: string;
  sensitiveOnly?: boolean;
}

export type PlaceholderStyle = "bracket" | "dummy" | "empty";

export interface GenerateExampleOptions {
  placeholderStyle?: PlaceholderStyle;
  preserveNonSensitive?: boolean;
}

export type ExampleOptions = GenerateExampleOptions;



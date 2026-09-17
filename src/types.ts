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

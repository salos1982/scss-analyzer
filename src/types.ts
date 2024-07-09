/*export interface FileObject {
  scssFile: string;
  tsxFiles: string[];
}*/

export interface ScssImportFile {
  tsxFile: string;
  importName: string;
}

export interface CodePosition {
  line: number;
  column: number;
}

export type CssContent = string[];

export interface ScssClass {
  name: string;
  file: string;
  position: CodePosition;
  content: CssContent;
}

export interface ClassUsage {
  class: string;
  position: CodePosition;
}

export interface TsxClass {
  tsxFile: string;
  usages: ClassUsage[];
}

export interface NonExisting {
  usage: ClassUsage;
  tsxFile: string;
  scssFile: string;
}

export interface DuplicateScssClasses {
  content: CssContent;
  classes: ScssClass[];
}
import { dirname, join, normalize } from "path";
import postcss from "postcss";
import { CodePosition, CssContent, DuplicateScssClasses, ScssClass, ScssImportFile, ScssClassUsage, ClassUsage } from "./types";
import { readFileSync, readdirSync, statSync } from "fs";
import { LinesAndColumns } from 'lines-and-columns';
import { decode as decodeSourceMap } from '@jridgewell/sourcemap-codec';

import { compileString } from "sass";

export const getAllTsxFiles = (directory: string): string[] => {
  let tsxFiles: string[] = [];

  const items = readdirSync(directory);

  items.forEach((item: string) => {
    const itemPath = join(directory, item);

    if (statSync(itemPath).isDirectory()) {
      tsxFiles = tsxFiles.concat(getAllTsxFiles(itemPath));
    } else if (item.endsWith(".tsx")) {
      tsxFiles.push(itemPath);
    }
  });

  return tsxFiles;
};

export function processTsxFiles(tsxFiles: string[]): Map<string, ScssImportFile[]> {
  const scssFilesMap = new Map<string, ScssImportFile[]>();

  tsxFiles.forEach((tsxFile: string) => {
    const fileContent = readFileSync(tsxFile, "utf-8");
    const scssImportMatch = fileContent.match(
      /import\s+([^\s]+)\s+from\s+['"](.+\.module\.scss)['"]/
    );
    if (scssImportMatch) {
      const scssName = scssImportMatch[1];
      const scssFileName = scssImportMatch[2];
      const tsxFolder = dirname(tsxFile);
      const scssFilePath = normalize(join(
        tsxFolder,
        scssFileName
      ));
      const scssImport = scssFilesMap.get(scssFilePath);
      if (scssImport) {
        scssImport.push({ tsxFile, importName: scssName });
      } else {
        scssFilesMap.set(scssFilePath, [{ tsxFile, importName: scssName }]);
      }
    }
  });

  return scssFilesMap;
};

export const getScssClasses = async (scssFile: string) => {
  const scssClasses = new Map<string, ScssClass>();

  const fileContent = readFileSync(scssFile, "utf-8");
  const processedCss = compileString(fileContent, { sourceMap: true, url: new URL(`file:///${scssFile}`) });
  const decodedMappings = decodeSourceMap(processedCss.sourceMap!.mappings);
  const positionMap = new Map<string, CodePosition>();
  for (let i = 0; i < decodedMappings.length; i++) {
    const mapping = decodedMappings[i];
    if (mapping.length !== 0) {
      const mappingValues = mapping[0];
      const sourceRow = i;
      const sourceCol = mappingValues[0];
      const processedRow = mappingValues[2];
      const processedCol = mappingValues[3];
      positionMap.set(`${sourceRow}, ${sourceCol}`, {line: processedRow! + 1, column: processedCol! + 1 })
    }
  }

  const res = await postcss().process(processedCss.css, {
    from: undefined
  });

  res.root.walkRules((rule) => {
    rule.selectors.forEach((selector) => {
      const cssPosition = rule.source?.start;
      const sourcePosition = positionMap.get(`${cssPosition!.line - 1}, ${cssPosition!.column - 1}`);
      if (!sourcePosition) {
        throw new Error(`Could not find source position for ${selector}`);
      }
      const content = rule.nodes.map((node) => node.toString());
      const selectors = selector.split(/[\s>+~:,]+/).map((s) => s.trim());
      selectors.forEach((s: string) => {
        if (s.startsWith(".") && /^[.#\[\w-]+$/.test(s)) {
          const sliced = s.slice(1);
          const classNames = sliced.split(".");
          classNames.forEach((name) => scssClasses.set(name, { name, file: scssFile, position: sourcePosition, content }));
        }
      });
    });
  });

  return scssClasses;
};

function getLineColumn(text: string, position: number): CodePosition {
  const lines = new LinesAndColumns(text);
  const location = lines.locationForIndex(position);
  return {
    line: location!.line + 1,
    column: location!.column + 1,
  }
}

export function findAllUsagesOfClassInTsx(tsxContent: string, scssFile: ScssImportFile): ClassUsage[] {
  const regExText = `(?<!(\\w|\\.))${scssFile.importName}\\.(\\w+)`;
  const regEx = new RegExp(regExText, "gm");

  const classNamesLines = Array.from(tsxContent.matchAll(regEx));
  const classUsages: ClassUsage[] = [];
  if (classNamesLines) {
    classNamesLines.forEach((regexResult: RegExpExecArray) => {
      const endOfLineIndex = tsxContent.lastIndexOf("\n", regexResult.index) + 1;
      if (!tsxContent.substring(endOfLineIndex, regexResult.index).trim().startsWith("import ")) {
        const positionInFile = regexResult.index;
      
        const className = regexResult[2];
        
        const position = getLineColumn(tsxContent, positionInFile);
        classUsages.push({ class: className, position });
      }
    });
  }
  return classUsages;
}

export const getTsxClasses = (scssFiles: ScssImportFile[]) => {
  const scssClassUsages: ScssClassUsage[] = [];

  scssFiles.forEach((scssFile: ScssImportFile) => {
    const tsxContent = readFileSync(scssFile.tsxFile, "utf-8");
    const regExText = `^(?!import\\s+).*(?<!(\\w|\\.))(${scssFile.importName}\\.\\w+)`;
    const regEx = new RegExp(regExText, "gm");

    const classNamesLines = Array.from(tsxContent.matchAll(regEx));
    const classUsages: ClassUsage[] = findAllUsagesOfClassInTsx(tsxContent, scssFile);
    
    if (classNamesLines) {
      classNamesLines.forEach((regexResult: RegExpExecArray) => {
        const className = regexResult[2];
        const positionInFile = regexResult.index + regexResult[0].indexOf(className);
        const formattedClassName = className.replace(`${scssFile.importName}.`, "");
       
        const position = getLineColumn(tsxContent, positionInFile);
        classUsages.push({ class: formattedClassName, position });
      });
    }

    if (classUsages.length) {
      const tsxFileUsage = scssClassUsages.find(
        (obj) => obj.tsxFile === scssFile.tsxFile
      );
      if (!tsxFileUsage) {
        scssClassUsages.push({
          tsxFile: scssFile.tsxFile,
          usages: classUsages,
        });
      } else {
        tsxFileUsage.usages.push(...classUsages);
      }
    }
  });

  return scssClassUsages;
};

function convertContentToString(content: CssContent): string {
  return content.sort().join(';');
}

export function getDuplicateClasses(scssClasses: ScssClass[]): DuplicateScssClasses[] {
  const contentMap = new Map<string, DuplicateScssClasses>();
  scssClasses.forEach((scssClass) => {
    const key = convertContentToString(scssClass.content);
    const duplicate = contentMap.get(key);
    if (!duplicate) {
      contentMap.set(key, { content: scssClass.content, classes: [scssClass]});
    } else {
      if (!duplicate.classes.some((existingClass) => 
        existingClass.file === scssClass.file &&
        existingClass.position.line === scssClass.position.line &&
        existingClass.position.column === existingClass.position.column)
      ) {
        duplicate.classes.push(scssClass);
      }
    }
  })


  return Array.from(contentMap.values()).filter((item) => item.classes.length > 1);
  
};

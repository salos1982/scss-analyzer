import path from "path";
import {
  getAllTsxFiles,
  getDuplicateClasses,
  getScssClasses,
  getTsxClasses,
  processTsxFiles,
} from "./utils";
import { NonExisting, ScssClass } from "./types";
import { COLOR_CODE } from "./constants";

const main = async (projectDirectory: string) => {
  const nonExistedClasses: NonExisting[] = [];
  const unusedClasses: ScssClass[] = [];

  const allTsxFiles = getAllTsxFiles(path.join(projectDirectory, "src"));
  const scssImportMap = processTsxFiles(allTsxFiles);
  const scssFiles = Array.from(scssImportMap.keys());

  const allScssClasses: ScssClass[] = [];

  await Promise.all(
    scssFiles.map(async (scssFile) => {
      const declaredClassesMap = await getScssClasses(scssFile);
      const declaredClassesList = Array.from(declaredClassesMap.values());
      allScssClasses.push(...declaredClassesList);
      const importFiles = scssImportMap.get(scssFile);
      const tsxClasses = getTsxClasses(importFiles!);

      tsxClasses.forEach((usedClass) => {
        const nonExistingClasses = usedClass.usages.filter(
          (usage) => !declaredClassesMap.has(usage.class)
        );
        if (nonExistingClasses.length) {
          nonExistedClasses.push(...nonExistingClasses.map((usage): NonExisting => ({ tsxFile: usedClass.tsxFile, usage, scssFile })));
        }
      });

      const mergedClasses = tsxClasses.reduce((acc: string[], curr) => {
        const combinedClasses = acc.concat(curr.usages.map((usage) => usage.class));
        return Array.from(new Set(combinedClasses));
      }, []);

      const notUsedClasses = declaredClassesList.filter(
        (scssClass) => !mergedClasses.includes(scssClass.name)
      );

      if (notUsedClasses.length) {
        unusedClasses.push(...notUsedClasses);
      }
    })
  );

  nonExistedClasses.forEach((nonExisting) => {
    console.error(`class '${nonExisting.usage.class}' is used in '${COLOR_CODE.YELLOW}${nonExisting.tsxFile}:${nonExisting.usage.position.line}:${nonExisting.usage.position.column}${COLOR_CODE.DEFAULT}' but does not exists in '${COLOR_CODE.YELLOW}${nonExisting.scssFile}${COLOR_CODE.DEFAULT}'\n`);
  })

  unusedClasses.forEach((unusedClass) => {
    console.error(`Possible unused class ${COLOR_CODE.YELLOW}${unusedClass.name}${COLOR_CODE.DEFAULT} at scss file '${COLOR_CODE.YELLOW}${unusedClass.file}:${unusedClass.position.line}:${unusedClass.position.column}${COLOR_CODE.DEFAULT}'\n`);
  })

  /*const duplicateClasses = getDuplicateClasses(allScssClasses);
  duplicateClasses.forEach((duplicateClass) => {
    console.error('Classes');
    duplicateClass.classes.forEach((item) => {
      console.error(`${COLOR_CODE.YELLOW}${item.name} ${item.file}:${item.position.line}:${item.position.column}${COLOR_CODE.DEFAULT}`)
    })
    console.error(`${COLOR_CODE.GRAY}have the same css values${COLOR_CODE.DEFAULT}\n{`);
    duplicateClass.content.forEach((line) => {
      console.error(`  ${line}`);
    })

    console.error('}\n');
  })*/
};

let projectDir = process.argv[2];
if (!projectDir) {
  projectDir = process.cwd();
}

main(projectDir);
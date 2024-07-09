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
  //const scssClass = await getScssClasses("D:\\work\\runmylease\\dealership-website\\src\\ui\\block-components\\dealer-centers\\dealer-card.module.scss");
  //console.log(scssClass);

  const DUPLICATES: { scssFile: string; duplicates: string[] }[] = [];
  const nonExistedClasses: NonExisting[] = [];
  const unusedClasses: ScssClass[] = [];

  const allTsxFiles = getAllTsxFiles(path.join(projectDirectory, "src"));
  const scssImportMap = processTsxFiles(allTsxFiles, projectDirectory);
  const scssFiles = Array.from(scssImportMap.keys());

  await Promise.all(
    scssFiles.map(async (scssFile) => {
      const declaredClassesMap = await getScssClasses(scssFile);
      const declaredClassesList = Array.from(declaredClassesMap.values());
      //const duplicateClasses = await getDuplicateClasses(scssFile);
      const importFiles = scssImportMap.get(scssFile);
      const tsxClasses = getTsxClasses(importFiles!);

      /*if (duplicateClasses.length) {
        DUPLICATES.push({
          scssFile,
          duplicates: Array.from(new Set(duplicateClasses)),
        });
      }*/

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

  /*if (DUPLICATES.length) {
    sendWarning({
      title: "Duplicate classes",
      description:
        "these classes are declared more than once in your .scss file",
      array: DUPLICATES,
    });
  }*/

  nonExistedClasses.forEach((nonExisting) => {
    console.error(`class '${nonExisting.usage.class}' is used in '${COLOR_CODE.YELLOW}${nonExisting.tsxFile}:${nonExisting.usage.position.line}:${nonExisting.usage.position.column}${COLOR_CODE.DEFAULT}' but does not exists in '${COLOR_CODE.YELLOW}${nonExisting.scssFile}${COLOR_CODE.DEFAULT}'\n`);
  })

  unusedClasses.forEach((unusedClass) => {
    console.error(`Possible unused class ${COLOR_CODE.YELLOW}${unusedClass.name}${COLOR_CODE.DEFAULT} at scss file '${COLOR_CODE.YELLOW}${unusedClass.file}:${unusedClass.position.line}:${unusedClass.position.column}${COLOR_CODE.DEFAULT}'\n`);
  })
};

main(process.argv[2]);
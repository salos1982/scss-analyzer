import { ScssImportFile } from "../src/types";
import { findAllUsagesOfClassInTsx } from "../src/utils";

describe("test parsing style usage", () => {
  it("simple parsing", () => {
    const tsxContent = `import styles from "./styles.module.scss";
<div className={styles.myclass} />
 `

    const scssFile: ScssImportFile = { tsxFile: "layout.tsx", importName: "styles" };
    const classUsages = findAllUsagesOfClassInTsx(tsxContent, scssFile);
    expect(classUsages).toIncludeSameMembers([{
      class: "myclass",
      position: {
        line: 2,
        column: 17,
      },
    }]);
  })

  it("parsing 2 styles in one line", () => {
    const tsxContent = `import styles from "./layout.module.scss";
<div className={cx(styles.footer, { [styles.footerBorder]: true })} />
 `

    const scssFile: ScssImportFile = { tsxFile: "layout.tsx", importName: "styles" };
    const classUsages = findAllUsagesOfClassInTsx(tsxContent, scssFile);
    expect(classUsages).toIncludeSameMembers([
      {
        class: "footer",
        position: {
          line: 2,
          column: 20,
        },
      },
      {
        class: "footerBorder",
        position: {
          line: 2,
          column: 38,
        },
      }
    ]);
  })
})

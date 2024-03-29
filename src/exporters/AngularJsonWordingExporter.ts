import fs from "fs";
import path from "path";
import { WordingExporter } from "./WordingExporter";

export class AngularJsonWordingExporter implements WordingExporter {
  async export(
    locale: String,
    wording: Map<string, string>,
    outputFile: string,
  ): Promise<void> {
    const translations: any = {};
    wording.forEach((v, k) => {
      translations[k] = v;
    });
    const result: any = {
      locale: locale,
      translations: translations,
    };
    await this.writeFile(result, outputFile);
  }

  writeFile(wording: any, output: string) {
    return new Promise<void>((resolve, reject) => {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFile(output, JSON.stringify(wording, null, 2), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`${output} updated`);
          resolve();
        }
      });
    });
  }
}

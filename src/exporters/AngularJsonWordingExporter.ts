import fs from "fs";
import path from "path";
import { WordingExporter } from "./WordingExporter";

export class AngularJsonWordingExporter implements WordingExporter {
  async export(
    locale: String,
    wording: Map<string, string>,
    outputFile: string
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

  setValue(source: any, nestedKeys: string, value: any) {
    if (nestedKeys.length === 0) {
      return;
    }
    if (nestedKeys.length === 1) {
      const key = nestedKeys[0];
      source[key] = value;
      return;
    }
    const key = nestedKeys[0];
    const otherKeys = nestedKeys.slice(1);
    if (!source[key]) {
      source[key] = {};
    }
    this.setValue(source[key], otherKeys, value);
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

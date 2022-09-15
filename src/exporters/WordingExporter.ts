export interface WordingExporter {
  export(
    locale: string,
    wording: Map<string, string>,
    outputFile: string,
  ): Promise<void>;
}

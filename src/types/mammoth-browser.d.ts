declare module 'mammoth/mammoth.browser' {
  interface ConvertToHtmlResult {
    value: string;
  }

  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<ConvertToHtmlResult>;
}


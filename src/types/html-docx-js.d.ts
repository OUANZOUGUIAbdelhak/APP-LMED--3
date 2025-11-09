declare module 'html-docx-js/dist/html-docx' {
  interface HtmlDocxOptions {
    orientation?: 'portrait' | 'landscape';
  }

  interface HtmlDocx {
    asBlob: (html: string, options?: HtmlDocxOptions) => Blob;
    asBase64: (html: string, options?: HtmlDocxOptions) => string;
  }

  const HtmlDocxExport: HtmlDocx;
  export default HtmlDocxExport;
}


// import { Registry } from './registry/registry';
// import { BpmnEventCallback, BpmnEventType, BpmStudioMode, StudioComponent } from './studio';
// import bpmnFont from './font/bpmn.woff?raw';
// import './studio';
// export interface CSPBpmConfig {
//     container: HTMLElement;
//     mode: BpmStudioMode;
//     onReady?: (instance: CSPBpm) => void;
// }

// export class CSPBpm {
//     private studioEl!: StudioComponent;
//     private config!: CSPBpmConfig;

//     static async InitBpm(config: CSPBpmConfig): Promise<CSPBpm> {
//         const instance = new CSPBpm();
//         return await instance.init(config);
//     }

//     private async init(config: CSPBpmConfig): Promise<CSPBpm> {
//         this.config = config;

//         const htmlURL = this._createStudioFrameURL();

//         const frameStudio = this._createIframe(htmlURL);
//         this.config.container.appendChild(frameStudio);

//         await new Promise<void>((resolve) => {
//             frameStudio.onload = () => resolve();
//         });

//         const frameWin = frameStudio.contentWindow as any;
//         const frameDoc = frameWin?.document;
//         if (!frameDoc) throw new Error("Cannot access iframe content");
//         if (frameWin.customElements) {
//             await frameWin.customElements.whenDefined('csp-bpmn-studio');
//         }
//         this.studioEl = frameDoc.querySelector('csp-bpmn-studio') as StudioComponent;
//         if (this.studioEl.ready) {
//             await this.studioEl.ready;
//         }
//         this.studioEl.setMode(config.mode);
//         Registry.Font.registerFont('bpmn', bpmnFont, {
//             style: "normal",
//             weight: "normal"
//         }, frameWin.document);
//         if (config.onReady) config.onReady(this);
//         return this;
//     }


//     public async importXML(xml: string): Promise<void> {
//         await this.studioEl.loadXML(xml);
//     }

//     public async saveXML(): Promise<string | undefined> {
//         return await this.studioEl.saveXML();
//     }

//     public setMode(mode: BpmStudioMode): void {
//         this.studioEl.setMode(mode);
//     }

//     public on(event: BpmnEventType, callback: BpmnEventCallback): () => void {
//         return this.studioEl.on(event, callback);
//     }

//     private _createIframe(src: string): HTMLIFrameElement {
//         const iframe = document.createElement('iframe');
//         Object.assign(iframe.style, {
//             width: '100%',
//             height: '100%',
//             border: 'none',
//             overflow: 'hidden'
//         });
//         iframe.src = src;
//         return iframe;
//     }

//     private _createStudioFrameURL(): string {
//     //     const content = `
//     //   <!DOCTYPE html>
//     //   <html>
//     //     <head>
//     //       <style>body{margin:0; padding: 0; overflow: hidden; height: 100vh;}</style>
//     //     </head>
//     //     <body>
//     //       <csp-bpmn-studio></csp-bpmn-studio>
//     //       </body>
//     //   </html>
//     // `;
//     //     return URL.createObjectURL(new Blob([content], { type: 'text/html' }));

//         const scripts = document.getElementsByTagName('script');
//         const currentScriptSrc = scripts[scripts.length - 1]?.src || '';
//         const content = `
//       <!DOCTYPE html>
//       <html>
//         <head>
//           <style>
//             body, html { margin:0; padding: 0; overflow: hidden; height: 100vh; width: 100vw; }
//             csp-bpmn-studio { display: block; height: 100%; width: 100%; }
//           </style>
//           <script type="module" src="${currentScriptSrc}"></script>
//         </head>
//         <body>
//           <csp-bpmn-studio></csp-bpmn-studio>
//         </body>
//       </html>
//     `;
//     return URL.createObjectURL(new Blob([content], { type: 'text/html' }));
//     }
// }
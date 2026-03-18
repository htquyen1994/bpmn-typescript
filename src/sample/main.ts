import { CSPBpm } from '../lib/index.js';

// ---------------------------------------------------------------------------
// Sample BPMN 2.0 XML
// ---------------------------------------------------------------------------

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="cccc" name="Default Process" isExecutable="true">
    <bpmn:intermediateThrowEvent id="Event_1hg5bf5">
      <bpmn:outgoing>Flow_0caqwno</bpmn:outgoing>
    </bpmn:intermediateThrowEvent>
    <bpmn:endEvent id="Event_1nwclmy">
      <bpmn:incoming>Flow_1jvu349</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:task id="Activity_0sij2y4" name="TaskA">
      <bpmn:incoming>Flow_0caqwno</bpmn:incoming>
      <bpmn:outgoing>Flow_1jvu349</bpmn:outgoing>
    </bpmn:task>
    <bpmn:sequenceFlow id="Flow_0caqwno" sourceRef="Event_1hg5bf5" targetRef="Activity_0sij2y4" />
    <bpmn:sequenceFlow id="Flow_1jvu349" sourceRef="Activity_0sij2y4" targetRef="Event_1nwclmy" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="cccc">
      <bpmndi:BPMNShape id="Event_1hg5bf5_di" bpmnElement="Event_1hg5bf5">
        <dc:Bounds x="212" y="192" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Event_1nwclmy_di" bpmnElement="Event_1nwclmy">
        <dc:Bounds x="462" y="192" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Activity_0sij2y4_di" bpmnElement="Activity_0sij2y4">
        <dc:Bounds x="300" y="170" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_0caqwno_di" bpmnElement="Flow_0caqwno">
        <di:waypoint x="248" y="210" />
        <di:waypoint x="300" y="210" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_1jvu349_di" bpmnElement="Flow_1jvu349">
        <di:waypoint x="400" y="210" />
        <di:waypoint x="462" y="210" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// ---------------------------------------------------------------------------
// Bootstrap
// Guard: the same bundle URL is loaded inside the library's iframe to register
// the <csp-bpmn-studio> custom element. That iframe has no #output or
// #diagram-container, so we skip all app-level initialisation there.
// ---------------------------------------------------------------------------

const output    = document.getElementById('output');
const container = document.getElementById('diagram-container');

if (output && container) {
  function log(msg: string): void {
    const ts = new Date().toLocaleTimeString();
    output!.textContent += `[${ts}] ${msg}\n`;
    output!.scrollTop = output!.scrollHeight;
  }

  log('Initializing studio…');

  CSPBpm.InitBpm({
    container,
    mode: 'modeler',
    onReady: () => { log('Studio ready (onReady callback)'); },
  }).then(async (bpm) => {
    log('Studio initialized');

    bpm.on('element.click', (e: any) => {
      log(`click: ${e.element?.type} "${e.element?.businessObject?.name ?? e.element?.id}"`);
    });

    bpm.on('commandStack.changed', () => { log('commandStack changed'); });

    try {
      await bpm.importXML(SAMPLE_XML);
      log('Sample diagram imported');
    } catch (err) {
      log(`Import error: ${err}`);
    }

    const btn = (id: string) => document.getElementById(id) as HTMLButtonElement;

    btn('btn-import').addEventListener('click', async () => {
      try {
        await bpm.importXML(SAMPLE_XML);
        log('Imported XML');
      } catch (err) { log(`Import error: ${err}`); }
    });

    btn('btn-open-file').addEventListener('click', () => {
      (document.getElementById('input-open-file') as HTMLInputElement).click();
    });

    (document.getElementById('input-open-file') as HTMLInputElement)
      .addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
          const xml = await file.text();
          await bpm.importXML(xml);
          log(`Opened file: ${file.name}`);
        } catch (err) {
          log(`Open file error: ${err}`);
        }
        (e.target as HTMLInputElement).value = '';
      });

    btn('btn-export-xml').addEventListener('click', async () => {
      try {
        const xml = await bpm.saveXML();
        log(`Exported XML (${xml?.length ?? 0} chars)`);
        if (xml) console.log(xml);
      } catch (err) { log(`Export XML error: ${err}`); }
    });

    btn('btn-download-xml').addEventListener('click', async () => {
      try {
        const xml = await bpm.saveXML();
        if (!xml) { log('Nothing to download'); return; }
        const blob = new Blob([xml], { type: 'application/xml' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'diagram.bpmn';
        a.click();
        URL.revokeObjectURL(url);
        log('Downloaded diagram.bpmn');
      } catch (err) { log(`Download error: ${err}`); }
    });

    btn('btn-export-svg').addEventListener('click', async () => {
      try {
        const svg = await bpm.saveSVG();
        log(`Exported SVG (${svg?.length ?? 0} chars)`);
        if (svg) console.log(svg);
      } catch (err) { log(`Export SVG error: ${err}`); }
    });

    btn('btn-zoom-in').addEventListener('click',    () => bpm.zoomIn());
    btn('btn-zoom-out').addEventListener('click',   () => bpm.zoomOut());
    btn('btn-zoom-fit').addEventListener('click',   () => bpm.zoomFit());
    btn('btn-zoom-reset').addEventListener('click', () => bpm.zoomReset());
    btn('btn-undo').addEventListener('click',       () => bpm.undo());
    btn('btn-redo').addEventListener('click',       () => bpm.redo());

    btn('btn-destroy').addEventListener('click', () => {
      bpm.destroy();
      log('Facade destroyed');
    });

  }).catch((err) => {
    log(`Init error: ${err}`);
    console.error(err);
  });
}

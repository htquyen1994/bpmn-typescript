import type { BpmStudioMode } from '../types.js';

// ── Interfaces ────────────────────────────────────────────────────────────────

/**
 * References to every layout element created by `StudioLayout.build()`.
 * The studio component stores these and passes them to `applyMode()`.
 */
export interface LayoutElements {
  toolbarContainer:          HTMLDivElement;
  fileInput:                 HTMLInputElement;
  canvasContainer:           HTMLDivElement;
  canvasControlsContainer:   HTMLDivElement;
  propertiesPanelContainer:  HTMLDivElement;
  customPanelContainer:      HTMLDivElement;
  customPanelToggle:         HTMLDivElement;
  tabBarContainer:           HTMLDivElement;
}

/**
 * Callbacks from the studio component wired into the layout's interactive
 * elements (toolbar button, file input).
 */
export interface StudioLayoutCallbacks {
  /** Called when the "Import XML" subprocess toolbar button is clicked. */
  onImportSpClick(): void;
  /** Called when the hidden file input receives a file selection. */
  onFileSelected(file: File): void;
}

// ── StudioLayout ──────────────────────────────────────────────────────────────

/**
 * Builds and manages the DOM skeleton of the `<csp-bpmn-studio>` element.
 *
 * Separating layout construction from business logic keeps `CspBpmnStudioElement`
 * focused on orchestration (modeler lifecycle, multi-tab, events) without
 * being cluttered by DOM-building detail.
 */
export class StudioLayout {

  /**
   * Create all layout elements, append them to `host`, wire internal
   * interactions (custom-panel toggle), and return element references.
   */
  build(host: HTMLElement, callbacks: StudioLayoutCallbacks): LayoutElements {
    host.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;';

    // ── Toolbar (hidden in viewer mode) ──────────────────────────────────────
    const toolbarContainer = document.createElement('div');
    toolbarContainer.className = 'bpmn-toolbar';
    toolbarContainer.innerHTML = `
      <span class="bpmn-toolbar-label">SubProcess</span>
      <button class="bpmn-btn" id="btn-import-sp" title="Load a .bpmn file to add it as a reusable SubProcess">
        ⊕ Import XML
      </button>
    `;
    toolbarContainer.querySelector('#btn-import-sp')!
      .addEventListener('click', () => callbacks.onImportSpClick());
    host.appendChild(toolbarContainer);

    // ── Hidden file input ─────────────────────────────────────────────────────
    const fileInput = document.createElement('input');
    fileInput.type    = 'file';
    fileInput.accept  = '.bpmn,.xml';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) callbacks.onFileSelected(file);
      fileInput.value = '';
    });
    host.appendChild(fileInput);

    // ── Main area (canvas + right panel) ─────────────────────────────────────
    const mainArea = document.createElement('div');
    mainArea.className = 'bpmn-main-area';
    host.appendChild(mainArea);

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'bpmn-canvas-container';
    mainArea.appendChild(canvasContainer);

    // Slot for the floating canvas controls (filled by CanvasControls.mount())
    const canvasControlsContainer = document.createElement('div');
    canvasContainer.appendChild(canvasControlsContainer);

    // ── Right panel ───────────────────────────────────────────────────────────
    const rightPanel = document.createElement('div');
    rightPanel.className = 'bpmn-right-panel';
    mainArea.appendChild(rightPanel);

    const propertiesPanelContainer = document.createElement('div');
    propertiesPanelContainer.className = 'bpmn-properties-container';
    rightPanel.appendChild(propertiesPanelContainer);

    // Custom panel toggle
    const customPanelToggle = document.createElement('div');
    customPanelToggle.className = 'csp-custom-toggle';
    customPanelToggle.innerHTML =
      '<span>Custom Properties</span><span class="csp-custom-toggle-arrow">▼</span>';
    rightPanel.appendChild(customPanelToggle);

    // Custom panel body (initially open)
    const customPanelContainer = document.createElement('div');
    customPanelContainer.className = 'csp-custom-panel-body';
    rightPanel.appendChild(customPanelContainer);

    // Wire toggle collapse behaviour (internal layout concern)
    customPanelToggle.addEventListener('click', () => {
      const collapsed = customPanelContainer.classList.toggle('csp-collapsed');
      customPanelToggle.querySelector('.csp-custom-toggle-arrow')!.textContent =
        collapsed ? '▶' : '▼';
    });

    // ── Tab bar (bottom, hidden in viewer mode) ───────────────────────────────
    const tabBarContainer = document.createElement('div');
    host.appendChild(tabBarContainer);

    return {
      toolbarContainer,
      fileInput,
      canvasContainer,
      canvasControlsContainer,
      propertiesPanelContainer,
      customPanelContainer,
      customPanelToggle,
      tabBarContainer,
    };
  }

  /**
   * Show or hide mode-dependent elements.
   * Modeler mode: everything visible.
   * Viewer mode: toolbar, right panel, and tab bar are hidden.
   */
  applyMode(mode: BpmStudioMode, elements: LayoutElements): void {
    const isModeler = mode === 'modeler';

    elements.toolbarContainer.style.display = isModeler ? '' : 'none';
    elements.tabBarContainer.style.display  = isModeler ? '' : 'none';

    // Hide the whole right panel in viewer mode.
    const rightPanel = elements.propertiesPanelContainer.parentElement;
    if (rightPanel) rightPanel.style.display = isModeler ? '' : 'none';
  }

  /** Programmatically click the hidden file input to open a file picker. */
  triggerFileImport(fileInput: HTMLInputElement): void {
    fileInput.click();
  }
}

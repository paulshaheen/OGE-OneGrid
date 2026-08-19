"use strict";
import powerbi from "powerbi-visuals-api";
import "./onegrid-embed.js";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;

const BASE = "https://onegrid-app-75033e-chat.niceisland-20053c21.eastus2.azurecontainerapps.io";
const MIN_H = 760;

export class Visual implements IVisual {
    private root: HTMLElement;
    private inner: HTMLElement;
    private mounted = false;
    private cleanup: (() => void) | null = null;

    constructor(options: VisualConstructorOptions) {
        this.root = options.element;
        this.root.style.overflowY = "auto";
        this.root.style.overflowX = "hidden";
        this.inner = document.createElement("div");
        this.inner.style.width = "100%";
        this.inner.style.minHeight = MIN_H + "px";
        this.root.appendChild(this.inner);
        this.tryMount();
    }

    private tryMount(): void {
        if (this.mounted) { return; }
        const w = window as any;
        if (w.OneGridEmbed && typeof w.OneGridEmbed.mount === "function") {
            this.cleanup = w.OneGridEmbed.mount(this.inner, { apiBase: BASE });
            this.mounted = true;
        }
    }

    public update(options: VisualUpdateOptions): void {
        const vp = options && options.viewport;
        if (vp) {
            this.root.style.width = vp.width + "px";
            this.root.style.height = vp.height + "px";
            this.inner.style.height = Math.max(vp.height, MIN_H) + "px";
        }
        this.tryMount();
    }

    public destroy(): void {
        if (this.cleanup) { try { this.cleanup(); } catch (e) { /* ignore */ } this.cleanup = null; }
    }
}

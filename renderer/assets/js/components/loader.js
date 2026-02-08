class PMCILoader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    const color = this.getAttribute("color") || "#4F4F4F";
    const size = this.getAttribute("size") || "50px";
    const speed = this.getAttribute("speed") || "0.5s";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: var(--loader-bg, #ffffff);
          z-index: 9999;
          transition: opacity 0.5s ease;
        }

        .spinner {
          width: ${size};
          height: ${size};
          border: 6px solid ${color};
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin ${speed} linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        :host(.fade-out) {
          opacity: 0;
          pointer-events: none;
        }
      </style>

      <div class="spinner"></div>
    `;

    // Automatically fade out loader when page loads
    window.addEventListener("load", () => {
      this.classList.add("fade-out");
      setTimeout(() => this.remove(), 50);
    });
  }
}

customElements.define("pmci-loader", PMCILoader);

class PMCIHeader extends HTMLElement {
  async connectedCallback() {
    let settings = {};
    try {
      settings = await window.electronAPI.getLibrarySettings();
    } catch (err) {
      console.error("Failed to load library settings:", err);
    }

    const libraryName = settings?.library_name;
    const schoolName = settings?.school_name;
    const logoPath = settings?.library_logo_path
      ? `file://${settings.library_logo_path}`
      : "../assets/img/png/logo.png";

    // First, create the innerHTML
    this.innerHTML = `
      <header class="pmci-header">
        <div class="logo">
          <img id="headerLogo" src="${logoPath}" alt="Library Logo" />
        </div>
        <div class="header-text">
          <h3>${schoolName}</h3>
          <h5>${libraryName}</h5>
        </div>
      </header>
    `;

    // Now we can safely select the img if needed
    const logoImg = this.querySelector("#headerLogo");

    // Example: dynamically update later
    window.addEventListener("library-settings-updated", async () => {
      const updatedSettings = await window.electronAPI.getLibrarySettings();
      logoImg.src = updatedSettings.library_logo_path
        ? `file://${updatedSettings.library_logo_path}`
        : "../assets/img/library-logos/library-logo.png";
    });
  }
}

customElements.define("pmci-header", PMCIHeader);

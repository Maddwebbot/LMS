class PMCINav extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
        <nav>
          <ul>
            <li><a href="index.html" target="_self">  <img src="../assets/img/png/dashboard-icon.png" alt="home-icon" />Dashboard</a></li>
            <li><a href="books.html" target="_self"> <img src="../assets/img/png/book-icon.png" alt="home-icon" />Book Management</a></li>
            <li><a href="transaction.html" target="_self"> <img src="../assets/img/png/transaction-icon.png" alt="transaction-icon" />Transactions</a></li>
            <li><a href="reports.html" target="_self"> <img src="../assets/img/png/notif-icon.png" alt="report-icon" />Reports</a></li>
            <li><a href="settings.html" target="_self"> <img src="../assets/img/png/setting-icon.png" alt="setting-icon" />Settings</a></li>
          </ul>
        </nav>
    `;
    this.setActiveLink();
  }

  setActiveLink() {
    const links = this.querySelectorAll("nav ul li a");
    const currentPage = window.location.pathname.split("/").pop(); // get current file name

    links.forEach((link) => {
      const linkPage = link.getAttribute("href");
      const img = link.querySelector("img"); // select img inside <a>

      if (linkPage === currentPage) {
        // Mark active
        link.classList.add("active"); // <a> gets active
        link.parentElement.classList.add("active"); // <li> gets active
        if (img) img.classList.add("active"); // <img> gets active

        // ✅ Prevent click on active link
        link.addEventListener("click", (e) => e.preventDefault());
      } else {
        link.classList.remove("active");
        link.parentElement.classList.remove("active");
        if (img) img.classList.remove("active");

        // Remove previous click prevention if exists
        const clone = link.cloneNode(true);
        link.parentNode.replaceChild(clone, link);
      }
    });
  }
}

customElements.define("pmci-nav", PMCINav);

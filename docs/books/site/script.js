// Language switching and mobile menu

(function () {
  const STORAGE_KEY = "cosmicgrid-lang";

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || "en";
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
  }

  // Chapter page: swap content via chapters.json
  let chaptersData = null;

  function getChapterIndex() {
    const match = location.pathname.match(/chapter(\d+)\.html/);
    return match ? parseInt(match[1], 10) - 1 : -1;
  }

  async function loadChaptersData() {
    if (chaptersData) return chaptersData;
    try {
      const resp = await fetch("chapters.json");
      chaptersData = await resp.json();
      return chaptersData;
    } catch {
      return null;
    }
  }

  async function switchChapterLang(lang) {
    const idx = getChapterIndex();
    if (idx < 0) return;

    const data = await loadChaptersData();
    if (!data) return;

    const chapter = data[lang][idx];
    if (!chapter) return;

    // Update article content
    const article = document.querySelector("article");
    if (article) {
      article.innerHTML = `<h1>${chapter.title}</h1>${chapter.toc}${chapter.content}`;
    }

    // Update sidebar nav
    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
    data[lang].forEach((ch, i) => {
      if (navItems[i]) {
        navItems[i].textContent = ch.title;
      }
    });

    // Update sidebar header
    const bookTitle = document.querySelector(".book-title");
    const bookSubtitle = document.querySelector(".book-subtitle");
    if (bookTitle) {
      bookTitle.textContent = lang === "en" ? "Cosmic Grid" : "宇宙格点";
    }
    if (bookSubtitle) {
      bookSubtitle.textContent =
        lang === "en"
          ? "A Unified Framework of Physics, Consciousness, and the Creator"
          : "物理、意识与造物主的统一框架";
    }

    // Update prev/next buttons
    const prevBtn = document.querySelector(".nav-btn.prev");
    const nextBtn = document.querySelector(".nav-btn.next");
    if (prevBtn) {
      prevBtn.innerHTML =
        lang === "en" ? "&larr; Previous" : "&larr; 上一章";
    }
    if (nextBtn) {
      nextBtn.innerHTML =
        lang === "en" ? "Next &rarr;" : "下一章 &rarr;";
    }

    // Update page title
    document.title =
      chapter.title +
      " - " +
      (lang === "en" ? "Cosmic Grid" : "宇宙格点");

    // Update html lang
    document.documentElement.lang = lang;
  }

  function switchIndexLang(lang) {
    document.querySelectorAll(".lang-content").forEach((el) => {
      el.style.display = el.dataset.lang === lang ? "" : "none";
    });
    const title = document.querySelector(".index-title");
    const subtitle = document.querySelector(".index-subtitle");
    if (title) title.textContent = title.dataset[lang];
    if (subtitle) subtitle.textContent = subtitle.dataset[lang];
  }

  function updateLangButtons(lang) {
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
  }

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    const lang = getLang();

    // Language buttons
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const newLang = btn.dataset.lang;
        setLang(newLang);
        updateLangButtons(newLang);

        if (getChapterIndex() >= 0) {
          switchChapterLang(newLang);
        } else {
          switchIndexLang(newLang);
        }
      });
    });

    // Apply stored language
    updateLangButtons(lang);
    if (lang !== "en") {
      if (getChapterIndex() >= 0) {
        switchChapterLang(lang);
      } else {
        switchIndexLang(lang);
      }
    }

    // Mobile menu toggle
    const toggle = document.querySelector(".menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    if (toggle && sidebar) {
      // Create overlay
      const overlay = document.createElement("div");
      overlay.className = "sidebar-overlay";
      document.body.appendChild(overlay);

      toggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
        overlay.classList.toggle("show");
      });

      overlay.addEventListener("click", () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
      });
    }
  });
})();

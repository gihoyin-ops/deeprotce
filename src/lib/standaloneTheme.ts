// shared head assets for fully standalone documents (global-error,
// global-not-found): these render outside the root layout, so they carry
// the pre-hydration theme script and the complete standalone theme vars.
export const THEME_SCRIPT = "(function(){try{var r=document.documentElement;var s=JSON.parse(localStorage.getItem('deepchat-general-settings')||'null')||{};var a=s.appearance==='dark'||s.appearance==='light'||s.appearance==='system'?s.appearance:'system';var dark=a==='dark'||(a==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);r.classList.toggle('dark',dark);r.style.colorScheme=dark?'dark':'light';r.dataset.appearance=a;r.dataset.contrast=s.contrast==='increased'||s.contrast==='medium'?s.contrast:(window.matchMedia('(prefers-contrast: more)').matches?'increased':'medium');r.dataset.accentColor=s.accentColor||'default';}catch(e){var r2=document.documentElement;var d2=window.matchMedia('(prefers-color-scheme: dark)').matches;r2.classList.toggle('dark',d2);r2.style.colorScheme=d2?'dark':'light';}})()";

export const GLOBAL_CSS = `
:root {
  --background: #ffffff;
  --foreground: #171717;
  --deepchat-accent: #4f46e5;
  --deepchat-accent-hover: #4338ca;
  --deepchat-accent-soft: #eef2ff;
  --deepchat-accent-border: #c7d2fe;
  --deepchat-accent-text: #4f46e5;
}

html.dark {
  --background: #000000;
  --foreground: #ededed;
}

html[data-appearance="light"] {
  color-scheme: light;
  --background: #ffffff;
  --foreground: #171717;
}

html[data-appearance="dark"] {
  color-scheme: dark;
  --background: #000000;
  --foreground: #ededed;
}

html[data-contrast="increased"] {
  --foreground: #020617;
}

html.dark[data-contrast="increased"],
html[data-appearance="dark"][data-contrast="increased"] {
  --foreground: #ffffff;
}

html[data-accent-color="blue"] {
  --deepchat-accent: #2563eb;
  --deepchat-accent-hover: #1d4ed8;
  --deepchat-accent-soft: #eff6ff;
  --deepchat-accent-border: #bfdbfe;
  --deepchat-accent-text: #2563eb;
}

html[data-accent-color="green"] {
  --deepchat-accent: #16a34a;
  --deepchat-accent-hover: #15803d;
  --deepchat-accent-soft: #f0fdf4;
  --deepchat-accent-border: #bbf7d0;
  --deepchat-accent-text: #16a34a;
}

html[data-accent-color="yellow"] {
  --deepchat-accent: #ca8a04;
  --deepchat-accent-hover: #a16207;
  --deepchat-accent-soft: #fefce8;
  --deepchat-accent-border: #fde68a;
  --deepchat-accent-text: #a16207;
}

html[data-accent-color="pink"] {
  --deepchat-accent: #db2777;
  --deepchat-accent-hover: #be185d;
  --deepchat-accent-soft: #fdf2f8;
  --deepchat-accent-border: #fbcfe8;
  --deepchat-accent-text: #db2777;
}

html[data-accent-color="orange"] {
  --deepchat-accent: #ea580c;
  --deepchat-accent-hover: #c2410c;
  --deepchat-accent-soft: #fff7ed;
  --deepchat-accent-border: #fed7aa;
  --deepchat-accent-text: #ea580c;
}

html[data-accent-color="purple"] {
  --deepchat-accent: #9333ea;
  --deepchat-accent-hover: #7e22ce;
  --deepchat-accent-soft: #faf5ff;
  --deepchat-accent-border: #e9d5ff;
  --deepchat-accent-text: #9333ea;
}

html[data-accent-color="black"] {
  --deepchat-accent: #020617;
  --deepchat-accent-hover: #111827;
  --deepchat-accent-soft: #f8fafc;
  --deepchat-accent-border: #cbd5e1;
  --deepchat-accent-text: #020617;
}

html, body {
  min-height: 100%;
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  background: var(--background);
  color: var(--foreground);
}
`;


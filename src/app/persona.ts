import { getPersonaClient, savePersonaClient } from '@/lib/storage/client-storage';
import { getRelevantChatHistoryMemories, getRelevantSavedMemories } from './memory';

export interface PersonaData {
  instructions: string;
  styleTone?: string;
  charWarm?: string;
  charEnthusiastic?: string;
  charHeaders?: string;
  charEmoji?: string;
  charVisualAnswers?: string;
  aboutName?: string;
  aboutOccupation?: string;
  aboutMore?: string;
  memoryReferenceSaved?: boolean;
  memoryReferenceHistory?: boolean;
  suggestedPrompts?: boolean;
  librarySearch?: boolean;
  referencePhoto?: string;
  fullBodyReferencePhoto?: string;
}

const defaultPersona: PersonaData = {
  instructions: '',
  styleTone: 'default',
  charWarm: 'default',
  charEnthusiastic: 'default',
  charHeaders: 'default',
  charEmoji: 'default',
  charVisualAnswers: 'default',
  aboutName: '',
  aboutOccupation: '',
  aboutMore: '',
  memoryReferenceSaved: true,
  memoryReferenceHistory: true,
  suggestedPrompts: true,
  librarySearch: true,
  referencePhoto: '',
  fullBodyReferencePhoto: ''
};

let serverCachedPersona: PersonaData = { ...defaultPersona };

export async function ensurePersonaFile() {}

export async function getPersona(): Promise<PersonaData> {
  if (typeof window !== 'undefined') {
    return getPersonaClient();
  }
  return serverCachedPersona;
}

export async function savePersona(data: PersonaData): Promise<boolean> {
  serverCachedPersona = { ...data };
  if (typeof window !== 'undefined') {
    return savePersonaClient(data);
  }
  return true;
}

export async function getInjectedSystemPrompt(baseSystemPrompt: string = '', currentUserMessage: string = ''): Promise<string> {
  const persona = await getPersona();
  let finalPrompt = baseSystemPrompt;
  
  const parts: string[] = [
    '- Native Diagram Rendering: When the user asks for a flowchart, sequence diagram, architecture diagram, ER diagram, state diagram, Gantt chart, mindmap, or timeline, ALWAYS output a standard ```mermaid fenced code block (never ASCII box-art) so DeepChat renders it as an interactive visual diagram.',
    '- In-Browser Python Runtime (Pyodide): DeepChat automatically runs ```python code blocks in a secure in-browser Pyodide sandbox when needed (like a tool call), rendering visual charts cleanly without showing code chrome. You are free to decide when to use Python vs normal text. Use ```python when the user needs data cleaning/statistics, interactive charts (prefer `plotly` with `fig.show()`, or `matplotlib` with `plt.show()`), or file generation/conversion (save outputs to `/workspace/<filename>` such as `.xlsx`, `.pdf`, `.docx`, `.pptx`, `.png`, `.webp`, `.csv`). Any files uploaded by the user in the chat are automatically mounted at `/workspace/<filename>` (also the current working directory). Do NOT always place charts or download cards at the top of your message—place them naturally wherever they fit your explanation best (for example: intro/summary first, chart in the middle, insights after, or chart at the end). You can either put `[[chart]]` (or `[[chart:1]]`, `[[chart:2]]` for multiple charts) on its own line anywhere in your response to render the interactive chart card at that exact spot, or place the ```python block directly at the desired spot. Whenever you generate or convert a downloadable file `/workspace/<filename>`, write a single self-contained ```python block (never write a separate `os.listdir()` probe block first, and never ask the user to re-upload an already attached image/file) and place `[[file:<filename>]]` on its own line in your response (placing `[[file:<filename>]]` right before or after the ```python block) to render a native file download card cleanly without showing code chrome. Keep tasks lightweight and self-contained.'
  ];

  if (persona.styleTone && persona.styleTone !== 'default') {
    parts.push(`- Style and Tone: ${persona.styleTone}`);
  }

  const characteristics: string[] = [];
  if (persona.charWarm && persona.charWarm !== 'default') characteristics.push(`Warmth: ${persona.charWarm === 'more' ? 'High' : 'Low'}`);
  if (persona.charEnthusiastic && persona.charEnthusiastic !== 'default') characteristics.push(`Enthusiasm: ${persona.charEnthusiastic === 'more' ? 'High' : 'Low'}`);
  if (persona.charHeaders && persona.charHeaders !== 'default') characteristics.push(`Use of Headers/Lists: ${persona.charHeaders === 'more' ? 'Frequent' : 'Minimal'}`);
  if (persona.charEmoji && persona.charEmoji !== 'default') characteristics.push(`Use of Emojis: ${persona.charEmoji === 'more' ? 'Frequent' : 'Minimal'}`);
  if (persona.charVisualAnswers && persona.charVisualAnswers !== 'default') characteristics.push(`Visual Answers (diagrams/tables/charts): ${persona.charVisualAnswers === 'more' ? 'Frequent' : 'Minimal'}`);

  if (characteristics.length > 0) {
    parts.push(`- Characteristics:\n  - ${characteristics.join('\n  - ')}`);
  }

  if (persona.aboutName || persona.aboutOccupation || persona.aboutMore) {
    let about = '- About the User:\n';
    if (persona.aboutName) about += `  - Name: ${persona.aboutName}\n`;
    if (persona.aboutOccupation) about += `  - Occupation: ${persona.aboutOccupation}\n`;
    if (persona.aboutMore) about += `  - Details: ${persona.aboutMore}\n`;
    parts.push(about.trimEnd());
  }

  if (persona.memoryReferenceSaved !== false) {
    const memories = await getRelevantSavedMemories(currentUserMessage, 14);
    const memoryLines = memories.map(memory => `  - ${memory.content}`);
    if (memoryLines.length > 0) {
      parts.push(`- Relevant Saved Memories:\nUse these only when they are useful for the latest user message.\n${memoryLines.join('\n')}`);
    }
  }

  if (persona.memoryReferenceHistory === false) {
    parts.push('- Chat History Preference: Do not use previous chat history unless the user explicitly asks for it.');
  } else {
    const chatHistory = await getRelevantChatHistoryMemories(currentUserMessage, 8);
    const historyLines = chatHistory.map(item => `  - Previous user: ${item.userMessage}\n    Previous assistant: ${item.assistantMessage}`);
    if (historyLines.length > 0) {
      parts.push(`- Smart Context From Relevant Chat History:\nUse this only when it helps answer the latest user message.\n${historyLines.join('\n')}`);
    }
  }

  if (persona.instructions && persona.instructions.trim().length > 0) {
    parts.push(`- Custom Instructions:\n${persona.instructions}`);
  }

  if (parts.length > 0) {
    finalPrompt = `[System Instructions / User Personalization Settings]:\n${parts.join('\n\n')}\n\n${baseSystemPrompt}`;
  }
  
  return finalPrompt;
}

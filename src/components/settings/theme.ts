// data control card classes

// icon bubble container
export const dataCardIcon = (tone: 'indigo' | 'amber' | 'emerald' | 'red' = 'indigo') => {
  const tones = {
    indigo: 'group-hover:text-indigo-500',
    amber: 'group-hover:text-amber-500',
    emerald: 'group-hover:text-emerald-500',
    red: 'group-hover:text-red-500'
  };
  return `w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 transition-colors shadow-sm dark:bg-slate-900/60 dark:border-slate-700/60 ${tones[tone]}`;
};

// secondary action button
export const dataCardButton = 'bg-white hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm dark:bg-slate-900/60 dark:border-slate-700/60 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300';

// destructive action button
export const dataCardDangerButton = 'bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900/60 dark:border-slate-700/60 dark:hover:bg-red-500/10 dark:hover:border-red-500/40 dark:hover:text-red-300';

// data control row shell
export const dataCard = 'group flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-indigo-100 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-slate-700/60 dark:bg-slate-900/40 dark:hover:border-indigo-500/30';

// archive action styles
export const dataCardAmberButton = 'bg-white hover:bg-amber-50 text-slate-500 hover:text-amber-600 border border-slate-200 hover:border-amber-200 px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900/60 dark:border-slate-700/60 dark:hover:bg-amber-500/10 dark:hover:border-amber-500/40 dark:hover:text-amber-300';

// export action styles
export const dataCardEmeraldButton = 'bg-white hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200 px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900/60 dark:border-slate-700/60 dark:hover:bg-emerald-500/10 dark:hover:border-emerald-500/40 dark:hover:text-emerald-300';

'use client';

import React, { useMemo, useState } from 'react';
import { FileDown, Plus, Trash2 } from '@/components/ui/icons';
import { exportWorkbookToCsv, exportWorkbookToXlsx } from '@/lib/canvas/exporters';
import { columnIndexToLabel, evaluateSheet } from '@/lib/canvas/formula-engine';
import { parseStreamingWorkbook } from '@/lib/canvas/stream-parser';
import {
  parseWorkbookData,
  type CanvasFile,
  type CanvasMode,
  type CanvasWorkbookData,
} from '@/lib/canvas/types';

export function SheetCanvasEditor({
  file,
  mode,
  isStreaming,
  onChange,
}: {
  file: CanvasFile;
  mode: Exclude<CanvasMode, 'diff'>;
  isStreaming: boolean;
  onChange: (nextContent: string) => void;
}) {
  const workbook: CanvasWorkbookData = useMemo(() => {
    if (isStreaming) {
      return parseStreamingWorkbook(file.content) || parseWorkbookData(file.content);
    }
    return parseWorkbookData(file.content);
  }, [file.content, isStreaming]);

  const [sheetIdx, setSheetIdx] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);

  const safeSheetIdx = Math.min(sheetIdx, Math.max(0, workbook.sheets.length - 1));
  const activeSheet = workbook.sheets[safeSheetIdx] || { name: 'Sheet1', rows: [['']] };
  const evaluatedRows = useMemo(() => evaluateSheet(activeSheet.rows), [activeSheet.rows]);
  const colCount = useMemo(
    () => Math.max(4, activeSheet.rows.reduce((m, r) => Math.max(m, r.length), 0)),
    [activeSheet.rows]
  );

  const commitWorkbook = (next: CanvasWorkbookData) => {
    onChange(JSON.stringify(next, null, 2));
  };

  const updateCell = (row: number, col: number, value: string) => {
    const nextSheets = workbook.sheets.map((s, idx) => {
      if (idx !== safeSheetIdx) return s;
      const nextRows = s.rows.map((r) => [...r]);
      while (nextRows.length <= row) nextRows.push([]);
      while (nextRows[row].length <= col) nextRows[row].push('');
      nextRows[row][col] = value;
      return { ...s, rows: nextRows };
    });
    commitWorkbook({ sheets: nextSheets });
  };

  const addRow = () => {
    const nextSheets = workbook.sheets.map((s, idx) =>
      idx === safeSheetIdx ? { ...s, rows: [...s.rows, Array(colCount).fill('')] } : s
    );
    commitWorkbook({ sheets: nextSheets });
  };

  const addColumn = () => {
    const nextSheets = workbook.sheets.map((s, idx) =>
      idx === safeSheetIdx ? { ...s, rows: s.rows.map((r) => [...r, '']) } : s
    );
    commitWorkbook({ sheets: nextSheets });
  };

  const addSheet = () => {
    const nextSheets = [
      ...workbook.sheets,
      {
        name: `Sheet${workbook.sheets.length + 1}`,
        rows: [
          ['Column A', 'Column B', 'Column C'],
          ['', '', ''],
        ],
      },
    ];
    commitWorkbook({ sheets: nextSheets });
    setSheetIdx(nextSheets.length - 1);
  };

  const deleteActiveSheet = () => {
    if (workbook.sheets.length <= 1) return;
    const nextSheets = workbook.sheets.filter((_, idx) => idx !== safeSheetIdx);
    commitWorkbook({ sheets: nextSheets });
    setSheetIdx(Math.max(0, safeSheetIdx - 1));
  };

  const selectedRaw = activeSheet.rows[selectedCell.row]?.[selectedCell.col] ?? '';
  const selectedRef = `${columnIndexToLabel(selectedCell.col)}${selectedCell.row + 1}`;
  const baseName = file.path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'spreadsheet';

  const sheetTabsBar = (
    <div className="flex items-center justify-between gap-2 border-t border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] px-2.5 py-1.5">
      <div
        role="tablist"
        aria-label="Workbook sheets"
        className="dc-canvas-tablist min-w-0 flex-1 items-center gap-1"
      >
        {workbook.sheets.map((sheet, idx) => {
          const selected = idx === safeSheetIdx;
          return (
            <button
              key={`${sheet.name}-${idx}`}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSheetIdx(idx)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors ${
                selected
                  ? 'bg-[var(--dc-surface-hover)] text-[var(--dc-text-strong)]'
                  : 'text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]'
              }`}
            >
              {sheet.name}
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={addSheet}
          title="Add sheet"
          aria-label="Add sheet"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        {workbook.sheets.length > 1 && (
          <button
            type="button"
            onClick={deleteActiveSheet}
            title="Remove current sheet"
            aria-label="Remove current sheet"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--dc-text-muted)] hover:bg-rose-500/12 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  if (mode === 'preview') {
    const headerRow = evaluatedRows[0] || [];
    const dataRows = evaluatedRows.slice(1);

    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--dc-panel-muted)]">
        <div className="flex items-center justify-between border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] px-3.5 py-1.5">
          <span className="text-[12px] text-[var(--dc-text-muted)]">
            {activeSheet.name} · {activeSheet.rows.length} rows
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void exportWorkbookToXlsx(workbook, `${baseName}.xlsx`)}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 text-[12px] font-medium text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)]"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>.xlsx</span>
            </button>
            <button
              type="button"
              onClick={() => exportWorkbookToCsv(workbook, safeSheetIdx, `${baseName}.csv`)}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 text-[12px] font-medium text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)]"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>.csv</span>
            </button>
          </div>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-label={`${activeSheet.name} data table`}
          className="dc-canvas-sheet-wrap dc-canvas-preview-table custom-scrollbar flex-1 p-3 sm:p-5"
        >
          <div className="overflow-hidden rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)]">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--dc-border)]">
                  {headerRow.map((head, cIdx) => (
                    <th
                      key={cIdx}
                      className="whitespace-nowrap px-3.5 py-2.5 font-semibold text-[var(--dc-text-strong)]"
                    >
                      {head || columnIndexToLabel(cIdx)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="border-b border-[var(--dc-border-subtle)] last:border-b-0 hover:bg-[var(--dc-surface-hover)]"
                  >
                    {headerRow.map((colName, cIdx) => {
                      const val = row[cIdx] ?? '';
                      const isNumeric = /^-?\d+(\.\d+)?$/.test(val.trim());
                      if (cIdx === 0) {
                        return (
                          <th
                            key={cIdx}
                            scope="row"
                            className="whitespace-nowrap px-3.5 py-2 font-medium text-[var(--dc-text-strong)]"
                          >
                            {val}
                          </th>
                        );
                      }
                      return (
                        <td
                          key={cIdx}
                          data-col-label={colName || columnIndexToLabel(cIdx)}
                          className={`whitespace-nowrap px-3.5 py-2 text-[var(--dc-text-body)] ${
                            isNumeric ? 'tabular-nums' : ''
                          }`}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {sheetTabsBar}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--dc-canvas)]">
      {/* Formula & quick structure bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] px-3 py-1.5">
        <span className="inline-flex h-7 min-w-10 items-center justify-center rounded-md bg-[var(--dc-panel-muted)] px-2 font-mono text-[12px] font-semibold text-[var(--dc-text-strong)]">
          {selectedRef}
        </span>
        <span className="font-mono text-[12px] italic text-[var(--dc-text-faint)]">fx</span>
        <input
          type="text"
          value={selectedRaw}
          onChange={(e) => updateCell(selectedCell.row, selectedCell.col, e.target.value)}
          placeholder="Value or formula (=SUM(B2:B4))"
          aria-label={`Formula bar for ${selectedRef}`}
          className="h-7 min-w-[140px] flex-1 rounded-md border border-[var(--dc-border-subtle)] bg-[var(--dc-canvas)] px-2.5 font-mono text-[12.5px] text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--dc-border-subtle)] px-2 text-[11.5px] font-medium text-[var(--dc-text)] hover:bg-[var(--dc-surface-hover)]"
          >
            <Plus className="h-3 w-3" />
            <span>Row</span>
          </button>
          <button
            type="button"
            onClick={addColumn}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--dc-border-subtle)] px-2 text-[11.5px] font-medium text-[var(--dc-text)] hover:bg-[var(--dc-surface-hover)]"
          >
            <Plus className="h-3 w-3" />
            <span>Col</span>
          </button>
        </div>
      </div>

      {/* Interactive grid */}
      <div
        tabIndex={0}
        role="region"
        aria-label={`${activeSheet.name} grid editor`}
        className="dc-canvas-sheet-wrap custom-scrollbar flex-1"
      >
        <table className="border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="w-10 border-b border-r border-[var(--dc-border)] px-2 py-1.5 text-center text-[11px] font-semibold text-[var(--dc-text-faint)]" />
              {Array.from({ length: colCount }, (_, cIdx) => (
                <th
                  key={cIdx}
                  className="min-w-[120px] border-b border-r border-[var(--dc-border)] px-2.5 py-1.5 text-center font-mono text-[11px] font-semibold text-[var(--dc-text-muted)]"
                >
                  {columnIndexToLabel(cIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSheet.rows.map((row, rIdx) => (
              <tr key={rIdx}>
                <th
                  scope="row"
                  className="border-b border-r border-[var(--dc-border)] px-2 py-1 text-center font-mono text-[11px] font-semibold text-[var(--dc-text-muted)] tabular-nums"
                >
                  {rIdx + 1}
                </th>
                {Array.from({ length: colCount }, (_, cIdx) => {
                  const isSelected = selectedCell.row === rIdx && selectedCell.col === cIdx;
                  const isEditing = editingCell?.row === rIdx && editingCell?.col === cIdx;
                  const rawVal = row[cIdx] ?? '';
                  const displayVal = evaluatedRows[rIdx]?.[cIdx] ?? rawVal;

                  return (
                    <td
                      key={cIdx}
                      onClick={() => {
                        setSelectedCell({ row: rIdx, col: cIdx });
                        setEditingCell({ row: rIdx, col: cIdx });
                      }}
                      className={`h-8 min-w-[120px] border-b border-r border-[var(--dc-border-subtle)] px-2.5 py-1 align-middle ${
                        rIdx === 0 ? 'font-semibold text-[var(--dc-text-strong)]' : 'text-[var(--dc-text)]'
                      } ${isSelected ? 'ring-2 ring-inset ring-[var(--deepchat-accent)]' : ''}`}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus
                          value={rawVal}
                          onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setEditingCell(null);
                              setSelectedCell({
                                row: Math.min(activeSheet.rows.length - 1, rIdx + 1),
                                col: cIdx,
                              });
                            } else if (e.key === 'Tab') {
                              e.preventDefault();
                              setEditingCell(null);
                              setSelectedCell({ row: rIdx, col: Math.min(colCount - 1, cIdx + 1) });
                            } else if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                          className="w-full bg-transparent font-mono text-[12.5px] text-[var(--dc-text-strong)] outline-none"
                        />
                      ) : (
                        <span className="block max-w-[220px] truncate tabular-nums">{displayVal}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sheetTabsBar}
    </div>
  );
}

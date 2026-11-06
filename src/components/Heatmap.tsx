import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Gathering } from "../types";
import type { OverlapModel } from "../lib/overlap";
import { findCell, heatStep, peopleWord } from "../lib/overlap";
import {
  formatFullDate,
  formatDayNum,
  formatTime,
  formatWeekdayShort,
  minutes,
  slotHourLabel,
} from "../lib/time";
import { PersonChips } from "./Chips";

type Point = { r: number; c: number };

function cellLabel(model: OverlapModel, point: Point, inPeak: boolean): string {
  const cell = model.cells[point.r]?.[point.c];
  if (!cell) return "";
  const who =
    cell.people.length === 0
      ? "No one is free."
      : `${peopleWord(cell.people.length)}: ${cell.people
          .map((person) => (person.example ? `${person.name}, example` : person.name))
          .join(", ")}.`;
  const peak = inPeak ? " Part of the strongest shared block." : "";
  return `${formatFullDate(cell.date)}, ${formatTime(cell.start)} to ${formatTime(cell.end)}. ${who}${peak}`;
}

function inBlock(
  model: OverlapModel,
  point: Point,
  block: OverlapModel["blocks"][number] | undefined,
): boolean {
  if (!block) return false;
  const cell = model.cells[point.r]?.[point.c];
  if (!cell || cell.date !== block.date) return false;
  return minutes(cell.start) >= minutes(block.start) && minutes(cell.end) <= minutes(block.end);
}

export function Heatmap({ event, model }: { event: Gathering; model: OverlapModel }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const peak = model.blocks[0];
  const peakKey = peak ? `${peak.date}|${peak.start}` : "";
  const [active, setActive] = useState<Point>(() => {
    if (!peak) return { r: 0, c: 0 };
    return findCell(model, peak.date, peak.start) ?? { r: 0, c: 0 };
  });
  const activeRef = useRef(active);
  activeRef.current = active;
  const modelRef = useRef(model);
  modelRef.current = model;

  useEffect(() => {
    const current = modelRef.current;
    const block = current.blocks[0];
    if (!block) return;
    const found = findCell(current, block.date, block.start);
    if (found) setActive(found);
  }, [peakKey]);

  useEffect(() => {
    const scroller = scrollRef.current;
    const target = scroller?.querySelector<HTMLElement>("[data-peak='true']");
    if (!scroller || !target) return;
    const peakRect = target.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const deltaTop = peakRect.top - scrollerRect.top - 48;
    const deltaLeft = peakRect.left - scrollerRect.left - 78;
    if (Math.abs(deltaTop) > 4) scroller.scrollTop += deltaTop;
    if (Math.abs(deltaLeft) > 4) scroller.scrollLeft += deltaLeft;
  }, [event.id]);

  function nudge(scroller: HTMLElement, el: HTMLElement) {
    const er = el.getBoundingClientRect();
    const sr = scroller.getBoundingClientRect();
    if (er.right > sr.right - 8) scroller.scrollLeft += er.right - sr.right + 12;
    if (er.left < sr.left + 64) scroller.scrollLeft -= sr.left + 64 - er.left;
    if (er.bottom > sr.bottom - 8) scroller.scrollTop += er.bottom - sr.bottom + 12;
    if (er.top < sr.top + 36) scroller.scrollTop -= sr.top + 36 - er.top;
  }

  function focusCell(point: Point) {
    setActive(point);
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      const el = scroller?.querySelector<HTMLElement>(`[data-rc="${point.r}-${point.c}"]`);
      if (!scroller || !el) return;
      el.focus({ preventScroll: true });
      nudge(scroller, el);
    });
  }

  function onKeyDown(eventKey: KeyboardEvent<HTMLDivElement>) {
    const key = eventKey.key;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
    eventKey.preventDefault();
    const current = activeRef.current;
    let next = { ...current };
    if (key === "ArrowUp") next = { r: Math.max(0, current.r - 1), c: current.c };
    if (key === "ArrowDown") next = { r: Math.min(model.dates.length - 1, current.r + 1), c: current.c };
    if (key === "ArrowLeft") next = { r: current.r, c: Math.max(0, current.c - 1) };
    if (key === "ArrowRight") next = { r: current.r, c: Math.min(model.slotStarts.length - 1, current.c + 1) };
    if (key === "Home") next = { r: current.r, c: 0 };
    if (key === "End") next = { r: current.r, c: model.slotStarts.length - 1 };
    focusCell(next);
  }

  if (model.max === 0 || model.slotStarts.length === 0) {
    return (
      <div className="empty-panel">
        <p>When people add the days they can come, the grid of half hours will fill in here.</p>
        <a className="btn btn-primary" href="#join">
          Add your hours
        </a>
      </div>
    );
  }

  const activeCell = model.cells[active.r]?.[active.c];

  return (
    <div className="heat-wrap">
      <div className="heat-toolbar">
        <ul className="legend" aria-label="Color key">
          <li>
            <span className="swatch" data-step="0" /> No one
          </li>
          <li>
            <span className="swatch" data-step="2" /> A few
          </li>
          <li>
            <span className="swatch" data-step="5" /> Most shared
          </li>
          <li>
            <span className="swatch swatch-peak" /> Strongest block
          </li>
        </ul>
        {peak && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => focusCell(findCell(model, peak.date, peak.start) ?? { r: 0, c: 0 })}>
            Show the strongest block
          </button>
        )}
      </div>
      <p id="heat-help" className="sr-only">
        Arrow keys move through the days and half hours. Each number is how many people are free then.
      </p>
      <div
        ref={scrollRef}
        className="heat-scroll"
        role="grid"
        aria-labelledby="overlap-title"
        aria-describedby="heat-help"
        aria-rowcount={model.dates.length + 1}
        aria-colcount={model.slotStarts.length + 1}
        onKeyDown={onKeyDown}
        style={{ ["--cols" as string]: model.slotStarts.length }}
      >
        <div role="row" className="heat-row heat-head">
          <div role="columnheader" className="heat-date">
            Day
          </div>
          {model.slotStarts.map((start) => (
            <div key={start} role="columnheader" className="heat-hour" aria-label={formatTime(start)}>
              {slotHourLabel(start)}
            </div>
          ))}
        </div>
        {model.cells.map((row, r) => {
          const dayPeople = new Set(row.flatMap((cell) => cell.people.map((person) => person.id)));
          const rowPeak = peak ? row[0]?.date === peak.date : false;
          return (
            <div role="row" className="heat-row" key={model.dates[r]} data-peak-row={rowPeak ? "true" : undefined}>
              <div role="rowheader" className="heat-date">
                <span className="heat-wd">{formatWeekdayShort(model.dates[r])}</span>
                <span className="heat-num">{formatDayNum(model.dates[r])}</span>
                <span className="sr-only">
                  {formatFullDate(model.dates[r])}, {peopleWord(dayPeople.size)} that day
                </span>
              </div>
              {row.map((cell, c) => {
                const point = { r, c };
                const selected = active.r === r && active.c === c;
                const peakCell = inBlock(model, point, peak);
                const step = heatStep(cell.people.length, model.max);
                return (
                  <div
                    key={cell.start}
                    role="gridcell"
                    data-rc={`${r}-${c}`}
                    data-step={step}
                    data-peak={peakCell ? "true" : undefined}
                    className={peakCell ? "cell is-peak" : "cell"}
                    tabIndex={selected ? 0 : -1}
                    aria-selected={selected}
                    aria-label={cellLabel(model, point, peakCell)}
                    onClick={() => focusCell(point)}
                    onFocus={() => setActive(point)}
                  >
                    {cell.people.length > 0 ? cell.people.length : ""}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {activeCell && (
        <div className="heat-detail" id="heat-detail">
          <p className="eyebrow">{formatFullDate(activeCell.date)}</p>
          <p className="heat-detail-time">
            {formatTime(activeCell.start)} – {formatTime(activeCell.end)}
          </p>
          {activeCell.people.length === 0 ? (
            <p>No one is free in this half hour.</p>
          ) : (
            <>
              <p>{peopleWord(activeCell.people.length)} free in this half hour.</p>
              <PersonChips people={activeCell.people} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

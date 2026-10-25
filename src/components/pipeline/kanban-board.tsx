"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronsLeftRight, ChevronsRightLeft, X } from "lucide-react";
import { toast } from "sonner";
import { archiveApplication, moveApplication } from "@/app/actions/pipeline";
import { ScoreBadge } from "@/components/assessments/score-badge";
import { ProfileLinks } from "@/components/profile-links";
import { Signal } from "@/components/signals";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { REJECTED_DAYS, STUCK_DAYS, isActive } from "@/lib/data/dashboard";
import type { Stage } from "@/lib/data/schemas";
import { PHASE_STYLE } from "@/lib/phase-style";
import { cn, initials } from "@/lib/utils";
import { MarkButtons } from "./marks";

export type BoardColumn = { id: string; label: string; phase: Stage };

export type BoardCard = {
  id: string;
  candidateId: string;
  name: string;
  stage: Stage;
  /** The job stage the card sits in. */
  column: string;
  position: number;
  /** Days in the current stage, counted on the server so hydration matches. */
  days: number;
  score: number | null;
  linkedinUrl: string | null;
  repoUrl: string | null;
  starred: boolean;
  flagged: boolean;
  /** Not meeting the requirements: the recruiter's call, else the AI score. */
  mismatch: boolean;
};

/** Hired and rejected lanes start folded; they rarely need a look. */
const FOLDED_PHASES: Stage[] = ["hired", "rejected"];
const FOLD_KEY = "ats.board.folded";

function CardBody({
  card,
  drawerHref,
  onRemove,
}: {
  card: BoardCard;
  /** Absent on the drag preview, which is not interactive. */
  drawerHref?: string;
  onRemove?: () => void;
}) {
  const ai = useTranslations("Assessment");
  const p = useTranslations("Pipeline");
  const done = !isActive(card.stage);
  return (
    <>
      <div
        className={cn(
          // Narrow lanes give the name the room instead.
          "hidden size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold @[13rem]:flex",
          card.mismatch
            ? "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 ring-inset dark:text-rose-300"
            : PHASE_STYLE[card.stage].soft,
        )}
        aria-hidden
      >
        {initials(card.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {drawerHref ? (
            <Link
              href={drawerHref}
              scroll={false}
              className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {card.name}
            </Link>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {card.name}
            </span>
          )}
          {done && onRemove && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={p("remove", { name: card.name })}
                    className="text-muted-foreground/70 hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center rounded-md outline-none focus-visible:ring-2"
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    onClick={onRemove}
                  />
                }
              >
                <X className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>{p("removeHint")}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2.5">
          {card.score !== null && (
            <ScoreBadge
              score={card.score}
              label={ai("scoreLabel", { score: card.score })}
              className="h-4.5 px-1.5"
            />
          )}
          {card.mismatch && <Signal kind="mismatch" />}
          {card.stage === "rejected" ? (
            <Signal
              kind="removal"
              days={Math.max(1, REJECTED_DAYS - card.days)}
            />
          ) : (
            <Signal
              kind={
                card.days > STUCK_DAYS && isActive(card.stage)
                  ? "stuck"
                  : "days"
              }
              days={card.days}
            />
          )}
          <span className="ml-auto flex items-center gap-1.5">
            {drawerHref ? (
              <MarkButtons
                applicationId={card.id}
                starred={card.starred}
                flagged={card.flagged}
                quiet
              />
            ) : (
              <span className="flex gap-1">
                {card.starred && <Signal kind="starred" />}
                {card.flagged && <Signal kind="flagged" />}
              </span>
            )}
            <ProfileLinks
              linkedinUrl={card.linkedinUrl}
              repoUrl={card.repoUrl}
            />
          </span>
        </div>
      </div>
    </>
  );
}

function cardClass(card: BoardCard) {
  return cn(
    "group/card flex items-start gap-2 rounded-lg border border-l-[3px] p-2 elevated transition-[box-shadow,opacity] hover:elevated-hover",
    card.mismatch
      ? "border-rose-500/25 border-l-rose-500/60 bg-rose-500/[0.06] dark:bg-rose-500/[0.09]"
      : ["bg-card", PHASE_STYLE[card.stage].edge],
    card.stage === "rejected" && "opacity-75 hover:opacity-100",
  );
}

function SortableCard({
  card,
  drawerHref,
  onRemove,
}: {
  card: BoardCard;
  drawerHref: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { column: card.column } });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        cardClass(card),
        "cursor-grab touch-none",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
    >
      <CardBody card={card} drawerHref={drawerHref} onRemove={onRemove} />
    </li>
  );
}

function Column({
  column,
  cards,
  folded,
  onFold,
  drawerHref,
  onRemove,
}: {
  column: BoardColumn;
  cards: BoardCard[];
  folded: boolean;
  onFold: () => void;
  drawerHref: (card: BoardCard) => string;
  onRemove: (card: BoardCard) => void;
}) {
  const p = useTranslations("Pipeline");
  // A folded lane still takes drops, so a card can be rejected without
  // opening the lane.
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { column: column.id },
  });
  const style = PHASE_STYLE[column.phase];
  const count = (
    <span
      className={cn(
        "rounded-full px-1.5 text-xs leading-5 font-medium tabular-nums",
        style.soft,
      )}
    >
      {cards.length}
    </span>
  );

  if (folded) {
    return (
      <section
        ref={setNodeRef}
        aria-label={column.label}
        className={cn(
          "ring-foreground/5 flex w-11 shrink-0 flex-col items-center gap-2 rounded-xl py-2 ring-1 transition-shadow",
          style.wash,
          isOver && "ring-ring/50 ring-2",
        )}
      >
        <button
          type="button"
          aria-expanded={false}
          aria-label={p("unfold", { name: column.label })}
          title={p("unfold", { name: column.label })}
          onClick={onFold}
          className="text-muted-foreground hover:bg-background/60 hover:text-foreground focus-visible:ring-ring flex flex-1 flex-col items-center gap-2 rounded-lg px-1 py-1 outline-none focus-visible:ring-2"
        >
          <ChevronsLeftRight className="size-3.5" />
          {count}
          <span className={cn("size-2 rounded-full", style.dot)} aria-hidden />
          <span className="text-foreground/80 text-xs font-medium [writing-mode:vertical-rl]">
            {column.label}
          </span>
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label={column.label}
      className={cn(
        "ring-foreground/5 @container flex min-w-40 flex-1 basis-0 flex-col gap-2 rounded-xl p-2 ring-1 transition-shadow",
        style.wash,
        isOver && "ring-ring/50 ring-2",
      )}
    >
      <h3 className="flex items-center gap-2 px-1 pt-0.5 text-sm font-medium">
        <span className={cn("size-2 rounded-full", style.dot)} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{column.label}</span>
        {count}
        <button
          type="button"
          aria-expanded
          aria-label={p("fold", { name: column.label })}
          title={p("fold", { name: column.label })}
          onClick={onFold}
          className="text-muted-foreground hover:bg-background/60 hover:text-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center rounded-md outline-none focus-visible:ring-2"
        >
          <ChevronsRightLeft className="size-3.5" />
        </button>
      </h3>
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2">
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              drawerHref={drawerHref(card)}
              onRemove={() => onRemove(card)}
            />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}

function byPosition(a: BoardCard, b: BoardCard) {
  return a.position - b.position;
}

/** Folded lanes, remembered per stage in this browser. */
function useFolded(columns: BoardColumn[]) {
  const defaults = () =>
    new Set(
      columns.filter((c) => FOLDED_PHASES.includes(c.phase)).map((c) => c.id),
    );
  const [folded, setFolded] = useState(defaults);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FOLD_KEY) ?? "{}");
      setFolded((prev) => {
        const next = new Set(prev);
        for (const c of columns) {
          if (saved[c.id] === true) next.add(c.id);
          if (saved[c.id] === false) next.delete(c.id);
        }
        return next;
      });
    } catch {
      // No storage: the defaults stand.
    }
  }, [columns]);

  function toggle(id: string) {
    const on = !folded.has(id);
    setFolded((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    try {
      const saved = JSON.parse(localStorage.getItem(FOLD_KEY) ?? "{}");
      localStorage.setItem(FOLD_KEY, JSON.stringify({ ...saved, [id]: on }));
    } catch {
      // Not remembered, which is fine.
    }
  }
  return { folded, toggle };
}

/** One job's board: its own stages as lanes. */
export function KanbanBoard({
  boardId,
  initialCards,
  columns,
}: {
  /** The job id; keeps the drag and drop ids unique on the page. */
  boardId: string;
  initialCards: BoardCard[];
  columns: BoardColumn[];
}) {
  const e = useTranslations("Errors");
  const p = useTranslations("Pipeline");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [cards, setCards] = useState(initialCards);
  // What the database holds, as far as this board knows.
  const [synced, setSynced] = useState(initialCards);
  const [received, setReceived] = useState(initialCards);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { folded, toggle } = useFolded(columns);

  // Take new server data (after a filter change or a refresh) when it arrives.
  if (initialCards !== received) {
    setReceived(initialCards);
    setSynced(initialCards);
    setCards(initialCards);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const drawerHref = (card: BoardCard) => {
    const next = new URLSearchParams(params.toString());
    next.set("candidate", card.candidateId);
    return `${pathname}?${next}`;
  };

  const columnOf = (id: string | number): string | null => {
    if (columns.some((c) => c.id === id)) return String(id);
    return cards.find((c) => c.id === id)?.column ?? null;
  };

  async function remove(card: BoardCard) {
    const drop = (list: BoardCard[]) => list.filter((c) => c.id !== card.id);
    setCards(drop);
    setSynced(drop);
    let ok = false;
    try {
      ok = Boolean(
        (await archiveApplication({ applicationId: card.id, archived: true }))
          .ok,
      );
    } catch {
      ok = false;
    }
    if (!ok) {
      setCards((prev) => [...prev, card]);
      setSynced((prev) => [...prev, card]);
      toast.error(e("generic"));
      return;
    }
    toast.success(p("removed", { name: card.name }), {
      action: {
        label: p("undo"),
        onClick: async () => {
          const result = await archiveApplication({
            applicationId: card.id,
            archived: false,
          }).catch(() => ({ error: "generic" as const }));
          if ("error" in result && result.error) toast.error(e("generic"));
          router.refresh();
        },
      },
    });
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  // While dragging over another column, move the card there so the column
  // makes room for it.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const to = columnOf(over.id);
    const from = columnOf(active.id);
    if (!to || !from || to === from) return;
    setCards((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, column: to } : c)),
    );
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) {
      setCards(synced);
      return;
    }
    const card = cards.find((c) => c.id === active.id);
    const to = columnOf(over.id);
    if (!card || !to) return;

    // The column in its current order, including the dragged card (onDragOver
    // has already moved it here). Dropping on a card takes that card's place,
    // as arrayMove does, so a card dropped on one below it lands after it.
    // Dropping on the column itself appends.
    const column = cards.filter((c) => c.column === to).sort(byPosition);
    const from = column.findIndex((c) => c.id === card.id);
    const overIndex = column.findIndex((c) => c.id === over.id);
    const ordered =
      overIndex === -1
        ? [...column.filter((c) => c.id !== card.id), card]
        : arrayMove(column, from, overIndex);
    const index = ordered.findIndex((c) => c.id === card.id);
    const before = ordered[index - 1]?.position;
    const after = ordered[index + 1]?.position;
    const position =
      before === undefined && after === undefined
        ? card.position
        : before === undefined
          ? after! - 1000
          : after === undefined
            ? before + 1000
            : (before + after) / 2;

    const saved = synced.find((c) => c.id === card.id);
    if (!saved) return;
    if (saved.column === to && saved.position === position) {
      setCards((prev) => prev.map((c) => (c.id === card.id ? saved : c)));
      return;
    }

    const moved = { ...card, column: to, position };
    setCards((prev) => prev.map((c) => (c.id === card.id ? moved : c)));

    let ok = false;
    try {
      const result = await moveApplication({
        applicationId: card.id,
        stageId: to,
        position,
      });
      ok = Boolean(result.ok);
    } catch {
      ok = false;
    }
    if (ok) {
      // The phase and the days in stage follow the new column, so the colours
      // and the countdowns are right before the next refresh.
      const phase = columns.find((c) => c.id === to)?.phase ?? card.stage;
      const restarted = saved.column !== to ? { stage: phase, days: 0 } : {};
      const done = { ...moved, ...restarted };
      setCards((prev) => prev.map((c) => (c.id === card.id ? done : c)));
      setSynced((prev) => prev.map((c) => (c.id === card.id ? done : c)));
    } else {
      // Put the card back where the database still has it.
      setCards((prev) => prev.map((c) => (c.id === card.id ? saved : c)));
      toast.error(e("generic"));
    }
  }

  const active = cards.find((c) => c.id === activeId);

  return (
    <DndContext
      // A fixed id keeps the server and client markup the same.
      id={`board-${boardId}`}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setCards(synced);
      }}
    >
      <div className="flex gap-2 overflow-x-auto pb-2">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            cards={cards.filter((c) => c.column === column.id).sort(byPosition)}
            folded={folded.has(column.id)}
            onFold={() => toggle(column.id)}
            drawerHref={drawerHref}
            onRemove={remove}
          />
        ))}
      </div>
      <DragOverlay>
        {active && (
          <div className={cn(cardClass(active), "elevated-hover")}>
            <CardBody card={active} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

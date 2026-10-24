"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
import { Clock, Flag, Star } from "lucide-react";
import { toast } from "sonner";
import { moveApplication } from "@/app/actions/pipeline";
import { ScoreBadge } from "@/components/assessments/score-badge";
import { Badge } from "@/components/ui/badge";
import { STUCK_DAYS, isActive } from "@/lib/data/dashboard";
import type { Stage } from "@/lib/data/schemas";
import { PHASE_STYLE } from "@/lib/phase-style";
import { cn, initials } from "@/lib/utils";
import { MarkButtons } from "./marks";

export type BoardColumn = { id: string; label: string; phase: Stage };

export type BoardCard = {
  id: string;
  candidateId: string;
  name: string;
  jobTitle: string;
  stage: Stage;
  /** The column the card sits in: a stage id on a job board, else the phase. */
  column: string;
  /** A custom stage name, shown on the all jobs board. */
  stageName: string | null;
  position: number;
  /** Days in the current stage, counted on the server so hydration matches. */
  days: number;
  score: number | null;
  linkedinUrl: string | null;
  starred: boolean;
  flagged: boolean;
  /** Not meeting the requirements: the recruiter's call, else the AI score. */
  mismatch: boolean;
};

function CardBody({
  card,
  drawerHref,
}: {
  card: BoardCard;
  /** Absent on the drag preview, which is not interactive. */
  drawerHref?: string;
}) {
  const t = useTranslations("Candidates");
  const ai = useTranslations("Assessment");
  const m = useTranslations("Marks");
  const { days } = card;
  return (
    <>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          PHASE_STYLE[card.stage].soft,
        )}
      >
        {initials(card.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1">
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
          {drawerHref ? (
            <MarkButtons
              applicationId={card.id}
              starred={card.starred}
              flagged={card.flagged}
            />
          ) : (
            <span className="flex gap-1">
              {card.starred && (
                <Star className="size-3.5 fill-amber-400 text-amber-500" />
              )}
              {card.flagged && (
                <Flag className="size-3.5 fill-current text-rose-600" />
              )}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="secondary"
            className="max-w-36 justify-start"
            title={card.jobTitle}
          >
            <span className="truncate">{card.jobTitle}</span>
          </Badge>
          {card.score !== null && (
            <ScoreBadge
              score={card.score}
              label={ai("scoreLabel", { score: card.score })}
            />
          )}
          {card.mismatch && (
            <span
              title={m("mismatch")}
              className="inline-flex h-5 items-center rounded-full bg-rose-100 px-2 text-xs font-medium whitespace-nowrap text-rose-800 dark:bg-rose-950 dark:text-rose-200"
            >
              {m("mismatchShort")}
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 whitespace-nowrap",
              days > STUCK_DAYS &&
                isActive(card.stage) &&
                "font-medium text-amber-700 dark:text-amber-400",
            )}
          >
            <Clock className="size-3" />
            {t("daysShort", { days })}
          </span>
          {card.stageName && (
            <span className="min-w-0 truncate">{card.stageName}</span>
          )}
          {card.linkedinUrl && (
            <a
              href={card.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("linkedin")}
              className="hover:text-foreground ml-auto shrink-0 font-semibold"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {t("linkedinShort")}
            </a>
          )}
        </div>
      </div>
    </>
  );
}

function cardClass(card: BoardCard) {
  return cn(
    "bg-card flex items-start gap-2 rounded-lg border border-l-4 p-2 shadow-xs",
    PHASE_STYLE[card.stage].edge,
    card.mismatch &&
      "border-rose-300 bg-rose-50/80 ring-1 ring-rose-300 dark:border-rose-900 dark:bg-rose-950/30 dark:ring-rose-900",
    card.starred &&
      !card.mismatch &&
      "ring-1 ring-amber-300 dark:ring-amber-800",
  );
}

function SortableCard({
  card,
  drawerHref,
}: {
  card: BoardCard;
  drawerHref: string;
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
      <CardBody card={card} drawerHref={drawerHref} />
    </li>
  );
}

function Column({
  column,
  cards,
  drawerHref,
}: {
  column: BoardColumn;
  cards: BoardCard[];
  drawerHref: (card: BoardCard) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { column: column.id },
  });
  return (
    <section
      aria-label={column.label}
      className={cn(
        "flex min-w-52 flex-1 basis-0 flex-col gap-2 rounded-xl p-2",
        PHASE_STYLE[column.phase].wash,
        isOver && "ring-ring/40 ring-2",
      )}
    >
      <h2 className="flex items-center gap-2 px-1 pt-1 text-sm font-semibold">
        <span
          className={cn("size-2.5 rounded-full", PHASE_STYLE[column.phase].dot)}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{column.label}</span>
        <span
          className={cn(
            "rounded-full px-2 text-xs tabular-nums",
            PHASE_STYLE[column.phase].soft,
          )}
        >
          {cards.length}
        </span>
      </h2>
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

export function KanbanBoard({
  initialCards,
  columns,
  mode,
}: {
  initialCards: BoardCard[];
  columns: BoardColumn[];
  /** "stage": columns are one job's stages; "phase": the fixed phases. */
  mode: "stage" | "phase";
}) {
  const e = useTranslations("Errors");
  const pathname = usePathname();
  const params = useSearchParams();
  const [cards, setCards] = useState(initialCards);
  // What the database holds, as far as this board knows.
  const [synced, setSynced] = useState(initialCards);
  const [received, setReceived] = useState(initialCards);
  const [activeId, setActiveId] = useState<string | null>(null);

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
    let stageName: string | null = null;
    try {
      const result = await moveApplication({
        applicationId: card.id,
        ...(mode === "stage" ? { stageId: to } : { stage: to }),
        position,
      });
      ok = Boolean(result.ok);
      stageName = result.stageName ?? null;
    } catch {
      ok = false;
    }
    if (ok) {
      // The phase board names the card's stage; it can change with the move.
      // The phase and the days in stage follow the new column, so the colours
      // and the stuck highlight are right before the next refresh.
      const phase = columns.find((c) => c.id === to)?.phase ?? card.stage;
      const restarted = saved.column !== to ? { stage: phase, days: 0 } : {};
      const done = {
        ...moved,
        ...restarted,
        ...(mode === "phase" ? { stageName } : {}),
      };
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
      id="pipeline-board"
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
      <div className="flex gap-3 overflow-x-auto pb-3">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            cards={cards.filter((c) => c.column === column.id).sort(byPosition)}
            drawerHref={drawerHref}
          />
        ))}
      </div>
      <DragOverlay>
        {active && (
          <div className={cn(cardClass(active), "shadow-lg")}>
            <CardBody card={active} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

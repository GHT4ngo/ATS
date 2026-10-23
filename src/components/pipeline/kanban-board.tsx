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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { moveApplication } from "@/app/actions/pipeline";
import { Badge } from "@/components/ui/badge";
import { STAGES, type Stage } from "@/lib/data/schemas";
import { cn } from "@/lib/utils";

export type BoardCard = {
  id: string;
  candidateId: string;
  name: string;
  jobTitle: string;
  stage: Stage;
  position: number;
  stageChangedAt: string;
  linkedinUrl: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function daysSince(iso: string) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000),
  );
}

function CardBody({
  card,
  drawerHref,
}: {
  card: BoardCard;
  drawerHref?: string;
}) {
  const t = useTranslations("Candidates");
  return (
    <>
      <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
        {initials(card.name)}
      </div>
      <div className="min-w-0 flex-1">
        {drawerHref ? (
          <Link
            href={drawerHref}
            scroll={false}
            className="block truncate text-sm font-medium hover:underline"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {card.name}
          </Link>
        ) : (
          <span className="block truncate text-sm font-medium">
            {card.name}
          </span>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="max-w-32 truncate">
            {card.jobTitle}
          </Badge>
          <span className="text-muted-foreground text-xs">
            {t("daysShort", { days: daysSince(card.stageChangedAt) })}
          </span>
        </div>
      </div>
      {card.linkedinUrl && (
        <a
          href={card.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn"
          className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-semibold"
          onPointerDown={(e) => e.stopPropagation()}
        >
          in
        </a>
      )}
    </>
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
  } = useSortable({ id: card.id, data: { stage: card.stage } });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-card flex cursor-grab touch-none items-start gap-2 rounded-lg border p-2 shadow-xs",
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
  stage,
  cards,
  drawerHref,
}: {
  stage: Stage;
  cards: BoardCard[];
  drawerHref: (card: BoardCard) => string;
}) {
  const s = useTranslations("Stages");
  const { setNodeRef, isOver } = useDroppable({ id: stage, data: { stage } });
  return (
    <section
      aria-label={s(stage)}
      className={cn(
        "bg-muted/40 flex w-60 shrink-0 flex-col gap-2 rounded-xl p-2",
        isOver && "ring-ring/40 ring-2",
      )}
    >
      <h2 className="flex items-center justify-between px-1 text-sm font-medium">
        {s(stage)}
        <span className="text-muted-foreground text-xs tabular-nums">
          {cards.length}
        </span>
      </h2>
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul ref={setNodeRef} className="flex min-h-16 flex-col gap-2">
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

export function KanbanBoard({ initialCards }: { initialCards: BoardCard[] }) {
  const e = useTranslations("Errors");
  const pathname = usePathname();
  const params = useSearchParams();
  const [cards, setCards] = useState(initialCards);
  const [synced, setSynced] = useState(initialCards);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Take new server data (after a filter change or a refresh) when it arrives.
  if (initialCards !== synced) {
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

  const stageOf = (id: string | number): Stage | null => {
    if ((STAGES as readonly string[]).includes(String(id))) return id as Stage;
    return cards.find((c) => c.id === id)?.stage ?? null;
  };

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  // While dragging over another column, move the card there so the column
  // makes room for it.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const to = stageOf(over.id);
    const from = stageOf(active.id);
    if (!to || !from || to === from) return;
    setCards((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, stage: to } : c)),
    );
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) {
      setCards(synced);
      return;
    }
    const card = cards.find((c) => c.id === active.id);
    const to = stageOf(over.id);
    if (!card || !to) return;

    const column = cards
      .filter((c) => c.stage === to && c.id !== card.id)
      .sort(byPosition);
    const overIndex = column.findIndex((c) => c.id === over.id);
    // Dropping on a card puts the dragged card at that card's place; dropping
    // on the column itself appends it.
    const index = overIndex === -1 ? column.length : overIndex;
    const before = column[index - 1]?.position;
    const after = column[index]?.position;
    const position =
      before === undefined && after === undefined
        ? Date.now()
        : before === undefined
          ? after! - 1000
          : after === undefined
            ? before + 1000
            : (before + after) / 2;

    const unchanged =
      card.position === position &&
      synced.find((c) => c.id === card.id)?.stage === to;
    if (unchanged) return;

    const previous = cards;
    const moved = { ...card, stage: to, position };
    setCards((prev) => prev.map((c) => (c.id === card.id ? moved : c)));

    const res = await moveApplication({
      applicationId: card.id,
      stage: to,
      position,
    });
    if (!res.ok) {
      setCards(previous);
      toast.error(e("generic"));
    } else {
      setSynced((s) =>
        s.map((c) => (c.id === card.id ? { ...c, stage: to, position } : c)),
      );
    }
  }

  const active = cards.find((c) => c.id === activeId);

  return (
    <DndContext
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
        {STAGES.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            cards={cards.filter((c) => c.stage === stage).sort(byPosition)}
            drawerHref={drawerHref}
          />
        ))}
      </div>
      <DragOverlay>
        {active && (
          <div className="bg-card flex items-start gap-2 rounded-lg border p-2 shadow-lg">
            <CardBody card={active} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

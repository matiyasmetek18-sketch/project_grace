import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { seedEvents, sortEvents } from "./data/seed";
import { uid } from "./lib/id";
import { browserStorage, emptyStore, loadStore, saveStore, STORAGE_KEY, type StorageLike } from "./lib/storage";
import type { Gathering, Store, TaskStatus, Volunteer } from "./types";

type NewVolunteer = {
  name: string;
  note: string;
  ranges: Volunteer["ranges"];
  taskIds: string[];
  flexible: boolean;
};

type GatheringsApi = {
  events: Gathering[];
  saveError: boolean;
  getEvent: (id: string) => Gathering | undefined;
  volunteersFor: (event: Gathering) => Volunteer[];
  taskStatus: (eventId: string, taskId: string) => TaskStatus;
  setTaskStatus: (eventId: string, taskId: string, status: TaskStatus) => void;
  examplesHidden: (eventId: string) => boolean;
  setExamplesHidden: (eventId: string, hidden: boolean) => void;
  addVolunteer: (eventId: string, input: NewVolunteer) => Volunteer;
  removeVolunteer: (eventId: string, id: string) => void;
  addEvent: (event: Gathering) => void;
  removeEvent: (eventId: string) => void;
  resetLocal: () => void;
};

const GatheringsContext = createContext<GatheringsApi | null>(null);

export function GatheringsProvider({ children }: { children: ReactNode }) {
  const storageRef = useRef<StorageLike | null>(null);
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<Store>(() => emptyStore());
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    storageRef.current = browserStorage();
    setStore(loadStore(storageRef.current));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setSaveError(!saveStore(store, storageRef.current));
  }, [store, ready]);

  const events = useMemo(() => sortEvents([...seedEvents, ...store.customEvents]), [store.customEvents]);

  const getEvent = useCallback((id: string) => events.find((event) => event.id === id), [events]);

  const volunteersFor = useCallback(
    (event: Gathering) => {
      const removed = new Set(store.removedIds);
      const added = (store.volunteersByEvent[event.id] ?? []).filter((volunteer) => !removed.has(volunteer.id));
      const examples = store.examplesHidden[event.id]
        ? []
        : event.volunteers.filter((volunteer) => !removed.has(volunteer.id));
      return [...added].reverse().concat(examples);
    },
    [store.examplesHidden, store.removedIds, store.volunteersByEvent],
  );

  const taskStatus = useCallback(
    (eventId: string, taskId: string): TaskStatus => store.taskStatus[eventId]?.[taskId] ?? "open",
    [store.taskStatus],
  );

  const setTaskStatus = useCallback((eventId: string, taskId: string, status: TaskStatus) => {
    setStore((current) => {
      const eventStatuses = { ...(current.taskStatus[eventId] ?? {}) };
      if (status === "open") delete eventStatuses[taskId];
      else eventStatuses[taskId] = status;
      return {
        ...current,
        taskStatus: { ...current.taskStatus, [eventId]: eventStatuses },
      };
    });
  }, []);

  const examplesHidden = useCallback(
    (eventId: string) => Boolean(store.examplesHidden[eventId]),
    [store.examplesHidden],
  );

  const setExamplesHidden = useCallback((eventId: string, hidden: boolean) => {
    setStore((current) => {
      const next = { ...current.examplesHidden };
      if (hidden) next[eventId] = true;
      else delete next[eventId];
      return { ...current, examplesHidden: next };
    });
  }, []);

  const addVolunteer = useCallback((eventId: string, input: NewVolunteer) => {
    const volunteer: Volunteer = {
      id: uid("person"),
      name: input.name.trim().slice(0, 60),
      note: input.note.trim().slice(0, 240),
      ranges: input.ranges,
      taskIds: input.taskIds,
      flexible: input.flexible,
      example: false,
      createdAt: new Date().toISOString(),
    };
    setStore((current) => ({
      ...current,
      volunteersByEvent: {
        ...current.volunteersByEvent,
        [eventId]: [...(current.volunteersByEvent[eventId] ?? []), volunteer],
      },
    }));
    return volunteer;
  }, []);

  const removeVolunteer = useCallback((eventId: string, id: string) => {
    setStore((current) => {
      const removedIds = current.removedIds.includes(id) ? current.removedIds : [...current.removedIds, id];
      const list = (current.volunteersByEvent[eventId] ?? []).filter((volunteer) => volunteer.id !== id);
      return {
        ...current,
        removedIds,
        volunteersByEvent: { ...current.volunteersByEvent, [eventId]: list },
      };
    });
  }, []);

  const addEvent = useCallback((event: Gathering) => {
    setStore((current) => {
      if (seedEvents.some((seed) => seed.id === event.id)) return current;
      if (current.customEvents.some((existing) => existing.id === event.id)) return current;
      return { ...current, customEvents: [...current.customEvents, event] };
    });
  }, []);

  const removeEvent = useCallback((eventId: string) => {
    setStore((current) => {
      if (seedEvents.some((seed) => seed.id === eventId)) return current;
      const volunteersByEvent = { ...current.volunteersByEvent };
      delete volunteersByEvent[eventId];
      const taskStatusMap = { ...current.taskStatus };
      delete taskStatusMap[eventId];
      const examplesHiddenMap = { ...current.examplesHidden };
      delete examplesHiddenMap[eventId];
      return {
        ...current,
        customEvents: current.customEvents.filter((event) => event.id !== eventId),
        volunteersByEvent,
        taskStatus: taskStatusMap,
        examplesHidden: examplesHiddenMap,
      };
    });
  }, []);

  const resetLocal = useCallback(() => {
    setStore(emptyStore());
    storageRef.current?.removeItem(STORAGE_KEY);
  }, []);

  const api = useMemo<GatheringsApi>(
    () => ({
      events,
      saveError,
      getEvent,
      volunteersFor,
      taskStatus,
      setTaskStatus,
      examplesHidden,
      setExamplesHidden,
      addVolunteer,
      removeVolunteer,
      addEvent,
      removeEvent,
      resetLocal,
    }),
    [
      events,
      saveError,
      getEvent,
      volunteersFor,
      taskStatus,
      setTaskStatus,
      examplesHidden,
      setExamplesHidden,
      addVolunteer,
      removeVolunteer,
      addEvent,
      removeEvent,
      resetLocal,
    ],
  );

  return <GatheringsContext.Provider value={api}>{children}</GatheringsContext.Provider>;
}

export function useGatherings(): GatheringsApi {
  const value = useContext(GatheringsContext);
  if (!value) throw new Error("useGatherings must be used within GatheringsProvider");
  return value;
}

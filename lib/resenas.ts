"use client";

// lib/resenas.ts — Práctica 4 (Firestore). Capa de acceso a datos de reseñas.
// Los componentes NO importan firebase/firestore directamente: todo pasa por acá.
import {
  average,
  collection,
  connectFirestoreEmulator,
  count,
  deleteDoc,
  doc,
  getAggregateFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { firebase, USA_EMULADORES } from "./firebase";

export interface Resena {
  uid: string; // = id del documento
  puntaje: number; // 1..5
  texto: string;
  autor: string;
  creadaEn: Timestamp | null; // null mientras el serverTimestamp está pendiente (escritura local)
  pendiente: boolean; // true mientras el servidor no confirmó la escritura (hasPendingWrites)
}

export interface Resumen {
  cantidad: number;
  promedio: number | null;
}

// ── Paso 1 · Inicialización ──────────────────────────────────────────────────
// En `npm run dev` habla con el emulador de Firestore (127.0.0.1:8080).
let db: Firestore | null = null;
export function firestore(): Firestore {
  if (db) return db;
  db = getFirestore(firebase().app);
  if (USA_EMULADORES) connectFirestoreEmulator(db, "127.0.0.1", 8080);
  return db;
}

const resenasDe = (cursoId: string) => collection(firestore(), "cursos", cursoId, "resenas");

// ── Paso 3 · Escribir ────────────────────────────────────────────────────────
/** Crear o editar MI reseña. El id del documento es mi UID: una reseña por persona y curso. */
export async function guardarResena(cursoId: string, puntaje: number, texto: string, esNueva: boolean): Promise<void> {
  const usuario = firebase().auth.currentUser;
  if (!usuario) throw new Error("Tenés que ingresar para dejar una reseña.");
  const ref = doc(resenasDe(cursoId), usuario.uid);
  const datos = { puntaje, texto, autor: (usuario.displayName ?? "Anónimo").slice(0, 80) };
  if (esNueva) await setDoc(ref, { ...datos, creadaEn: serverTimestamp() });
  else await setDoc(ref, datos, { merge: true }); // sin creadaEn: conserva la fecha original
}

export async function borrarResena(cursoId: string): Promise<void> {
  const usuario = firebase().auth.currentUser;
  if (!usuario) return;
  await deleteDoc(doc(resenasDe(cursoId), usuario.uid));
}

// ── Paso 4 · Escuchar en tiempo real ─────────────────────────────────────────
/**
 * Últimas 20 reseñas en tiempo real. Devuelve la función para cancelar la suscripción.
 * `confirmadas` indica que el servidor ya confirmó todas las escrituras propias.
 */
export function escucharResenas(
  cursoId: string,
  alCambiar: (resenas: Resena[], confirmadas: boolean) => void,
  alFallar: (e: Error) => void,
  soloCincoEstrellas = false,
): Unsubscribe {
  const filtros = soloCincoEstrellas ? [where("puntaje", "==", 5)] : [];
  const q = query(resenasDe(cursoId), ...filtros, orderBy("creadaEn", "desc"), limit(20));
  return onSnapshot(
    q,
    // includeMetadataChanges: avisa también cuando el servidor confirma una escritura
    // propia (hasPendingWrites pasa de true a false) aunque los datos no cambien.
    { includeMetadataChanges: true },
    (snap) =>
      alCambiar(
        snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: "estimate" });
          return {
            uid: d.id,
            puntaje: data.puntaje,
            texto: data.texto,
            autor: data.autor,
            creadaEn: data.creadaEn ?? null,
            pendiente: d.metadata.hasPendingWrites,
          };
        }),
        // false mientras quede alguna escritura propia sin confirmar (incluido un borrado,
        // que ya no aparece en snap.docs).
        !snap.metadata.hasPendingWrites,
      ),
    alFallar,
  );
}

// ── Paso 5 · Resumen con agregación ──────────────────────────────────────────
/** Promedio y cantidad calculados por el servidor (no es en tiempo real). */
export async function resumenDe(cursoId: string): Promise<Resumen> {
  const snap = await getAggregateFromServer(resenasDe(cursoId), { cantidad: count(), promedio: average("puntaje") });
  return snap.data();
}

/** Mensaje legible para los errores más comunes de Firestore. */
export function mensajeFirestore(e: unknown): string {
  const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
  if (code === "permission-denied") return "Las reglas de seguridad rechazaron la operación (permission-denied).";
  if (code === "failed-precondition") return "Falta un índice compuesto (o todavía se está construyendo).";
  return e instanceof Error ? e.message : String(e);
}

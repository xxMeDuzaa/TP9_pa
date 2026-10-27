"use client";

// app/components/ResenasCurso.tsx — Práctica 4. Formulario + lista en tiempo real + resumen.
import { useEffect, useState, type FormEvent } from "react";
import { borrarResena, escucharResenas, guardarResena, mensajeFirestore, resumenDe, type Resena, type Resumen } from "@/lib/resenas";

const estrellas = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

/**
 * Las reseñas se abren a pedido: la suscripción en tiempo real existe solo mientras
 * el panel está abierto. Así el catálogo no abre 7 conexiones (y hasta 140 lecturas)
 * en cada visita.
 */
export default function ResenasCurso({ cursoId, uid }: { cursoId: string; uid: string | null }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="resenas">
      <button type="button" className="link" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        {abierto ? "Ocultar reseñas ▲" : "Ver reseñas ▼"}
      </button>
      {abierto && <PanelResenas cursoId={cursoId} uid={uid} />}
    </div>
  );
}

function PanelResenas({ cursoId, uid }: { cursoId: string; uid: string | null }) {
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [soloCinco, setSoloCinco] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Huella de las reseñas confirmadas por el servidor: cuando cambia, se recalcula el resumen.
  const [firma, setFirma] = useState("");

  // Suscripción en tiempo real: React llama a la función que devuelve escucharResenas
  // (unsubscribe) al desmontar o al cambiar de curso/filtro. Sin eso, quedan
  // suscripciones huérfanas consumiendo lecturas.
  useEffect(() => {
    return escucharResenas(
      cursoId,
      (lista, confirmadas) => {
        setResenas(lista);
        if (confirmadas) setFirma(lista.map((r) => `${r.uid}:${r.puntaje}`).join(","));
      },
      (e) => setError(mensajeFirestore(e)),
      soloCinco,
    );
  }, [cursoId, soloCinco]);

  // La agregación no es en tiempo real: se vuelve a pedir cuando cambian las reseñas
  // y el servidor ya confirmó la escritura (si se pidiera antes, devolvería el valor viejo).
  useEffect(() => {
    resumenDe(cursoId)
      .then(setResumen)
      .catch((e) => setError(mensajeFirestore(e)));
  }, [cursoId, firma]);

  const mia = uid ? resenas.find((r) => r.uid === uid) : undefined;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    try {
      await guardarResena(cursoId, Number(f.get("puntaje")), String(f.get("texto")).trim(), !mia);
      setError(null);
    } catch (err) {
      setError(mensajeFirestore(err));
    } finally {
      setEnviando(false);
    }
  }

  async function onBorrar() {
    try {
      await borrarResena(cursoId);
      setError(null);
    } catch (err) {
      setError(mensajeFirestore(err));
    }
  }

  return (
    <section className="resenas__panel" aria-label="Reseñas del curso">
      <p className="resenas__resumen">
        {resumen && resumen.cantidad > 0
          ? `★ ${resumen.promedio?.toFixed(1)} · ${resumen.cantidad} ${resumen.cantidad === 1 ? "reseña" : "reseñas"}`
          : "Todavía no hay reseñas."}
      </p>

      <label className="resenas__filtro">
        <input type="checkbox" checked={soloCinco} onChange={(e) => setSoloCinco(e.target.checked)} /> Solo 5 estrellas
      </label>

      {uid ? (
        // key: al aparecer mi reseña, el formulario se vuelve a montar con sus valores.
        <form key={mia ? "editar" : "nueva"} className="resenas__form" onSubmit={onSubmit}>
          <select name="puntaje" defaultValue={mia?.puntaje ?? 5} aria-label="Puntaje">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {estrellas(n)}
              </option>
            ))}
          </select>
          <textarea name="texto" maxLength={500} rows={2} defaultValue={mia?.texto ?? ""} placeholder="¿Qué te pareció el curso?" required />
          <div className="resenas__botones">
            <button type="submit" className="button button--small" disabled={enviando}>
              {mia ? "Actualizar mi reseña" : "Publicar"}
            </button>
            {mia && (
              <button type="button" className="button button--small button--ghost" onClick={onBorrar}>
                Borrar
              </button>
            )}
          </div>
        </form>
      ) : (
        <small className="hint">Ingresá para dejar tu reseña.</small>
      )}

      {error && (
        <p className="alerta alerta--error" role="alert">
          {error}
        </p>
      )}

      <ul className="resenas__lista">
        {resenas.map((r) => (
          <li key={r.uid} className={r.pendiente ? "resena resena--pendiente" : "resena"}>
            <span className="resena__estrellas" aria-label={`${r.puntaje} de 5`}>
              {estrellas(r.puntaje)}
            </span>{" "}
            {r.texto} — <em>{r.autor}</em>
            {r.pendiente && <small className="hint"> · enviando…</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}

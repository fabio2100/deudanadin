import type { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

async function getDolarOficialVenta() {
  const response = await fetch("https://dolarapi.com/v1/dolares/oficial");
  if (!response.ok) {
    throw new Error("No se pudo obtener el valor del dólar oficial");
  }

  const data = await response.json() as { venta?: number };
  if (typeof data.venta !== "number" || Number.isNaN(data.venta)) {
    throw new Error("El valor de venta del dólar oficial no es válido");
  }

  return data.venta;
}

function normalizeMontoString(value: string | number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error("monto debe ser numérico");
  }

  return numeric.toFixed(2);
}

function getId(query: string | string[] | undefined) {
  const raw = Array.isArray(query) ? query[0] : query;
  if (!raw || !ObjectId.isValid(raw)) {
    throw new Error("ID inválido");
  }

  return new ObjectId(raw);
}

function readBody(req: NextApiRequest) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }

  return req.body ?? {};
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("deudas");
    const id = getId(req.query.id);

    if (req.method === "GET") {
      const item = await collection.findOne({ _id: id });
      if (!item) {
        return res.status(404).json({ ok: false, message: "Deuda no encontrada" });
      }
      return res.status(200).json({ ok: true, data: item });
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      const payload = readBody(req);
      const update: Record<string, unknown> = {};

      if (payload.fechaHora !== undefined) {
        const fechaHora = new Date(String(payload.fechaHora));
        if (Number.isNaN(fechaHora.getTime())) {
          throw new Error("fechaHora inválida");
        }
        update.fechaHora = fechaHora;
      }

      if (payload.monto !== undefined) {
        const esDolar = Boolean(payload.esDolar ?? false);
        if (esDolar) {
          const venta = await getDolarOficialVenta();
          const montoUsd = Number(payload.monto ?? 0);
          if (!Number.isFinite(montoUsd)) {
            throw new Error("monto debe ser numérico");
          }
          update.monto = normalizeMontoString(montoUsd * venta * 1.21);
        } else {
          const monto = String(payload.monto ?? "");
          if (!/^\d+(\.\d{2})?$/.test(monto)) {
            throw new Error("monto debe ser un string con dos decimales");
          }
          update.monto = monto;
        }
      }

      if (payload.descripcion !== undefined) {
        const descripcion = String(payload.descripcion ?? "").trim();
        if (!descripcion) {
          throw new Error("descripcion es obligatoria");
        }
        update.descripcion = descripcion;
      }

      if (payload.esDolar !== undefined) {
        const nextEsDolar = Boolean(payload.esDolar);
        update.esDolar = nextEsDolar;

        if (nextEsDolar && payload.monto !== undefined) {
          const venta = await getDolarOficialVenta();
          const montoUsd = Number(payload.monto ?? 0);
          if (!Number.isFinite(montoUsd)) {
            throw new Error("monto debe ser numérico");
          }
          update.monto = normalizeMontoString(montoUsd * venta * 1.21);
        }
      }

      if (payload.cuotaNro !== undefined) {
        update.cuotaNro = Number(payload.cuotaNro);
      }

      if (payload.cuotas !== undefined) {
        update.cuotas = Number(payload.cuotas);
      }

      const result = await collection.updateOne({ _id: id }, { $set: update });
      if (result.matchedCount === 0) {
        return res.status(404).json({ ok: false, message: "Deuda no encontrada" });
      }

      const updated = await collection.findOne({ _id: id });
      return res.status(200).json({ ok: true, data: updated });
    }

    if (req.method === "DELETE") {
      const result = await collection.deleteOne({ _id: id });
      if (result.deletedCount === 0) {
        return res.status(404).json({ ok: false, message: "Deuda no encontrada" });
      }
      return res.status(200).json({ ok: true, message: "Deuda eliminada" });
    }

    return res.status(405).json({ ok: false, message: "Método no permitido" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return res.status(400).json({ ok: false, message });
  }
}

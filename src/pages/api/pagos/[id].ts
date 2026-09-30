import type { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

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
    const collection = db.collection("pagos");
    const id = getId(req.query.id);

    if (req.method === "GET") {
      const item = await collection.findOne({ _id: id });
      if (!item) {
        return res.status(404).json({ ok: false, message: "Pago no encontrado" });
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
        const monto = Number(payload.monto);
        if (!Number.isFinite(monto)) {
          throw new Error("monto es obligatorio y debe ser numérico");
        }
        update.monto = monto;
      }

      if (payload.descripcion !== undefined) {
        update.descripcion = String(payload.descripcion);
      }

      const result = await collection.updateOne({ _id: id }, { $set: update });
      if (result.matchedCount === 0) {
        return res.status(404).json({ ok: false, message: "Pago no encontrado" });
      }

      const updated = await collection.findOne({ _id: id });
      return res.status(200).json({ ok: true, data: updated });
    }

    if (req.method === "DELETE") {
      const result = await collection.deleteOne({ _id: id });
      if (result.deletedCount === 0) {
        return res.status(404).json({ ok: false, message: "Pago no encontrado" });
      }
      return res.status(200).json({ ok: true, message: "Pago eliminado" });
    }

    return res.status(405).json({ ok: false, message: "Método no permitido" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return res.status(400).json({ ok: false, message });
  }
}

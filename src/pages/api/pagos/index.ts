import type { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

type Pago = {
  _id?: ObjectId;
  fechaHora: Date;
  monto: number;
  descripcion?: string | null;
};

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

function normalizePagoInput(body: unknown): Pago {
  const payload = (body ?? {}) as Record<string, unknown>;

  const fechaHora = payload.fechaHora !== undefined && payload.fechaHora !== null && String(payload.fechaHora).trim() !== ""
    ? new Date(String(payload.fechaHora))
    : new Date();
  if (Number.isNaN(fechaHora.getTime())) {
    throw new Error("fechaHora inválida");
  }

  const monto = Number(payload.monto);
  if (!Number.isFinite(monto)) {
    throw new Error("monto es obligatorio y debe ser numérico");
  }

  const pago: Pago = {
    fechaHora,
    monto,
  };

  if (payload.descripcion !== undefined) {
    const descripcion = payload.descripcion;
    pago.descripcion = descripcion === null || String(descripcion).trim() === "" ? null : String(descripcion);
  }

  return pago;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("pagos");

    if (req.method === "GET") {
      const pagos = await collection.find({}).sort({ fechaHora: -1 }).toArray();
      return res.status(200).json({ ok: true, data: pagos });
    }

    if (req.method === "POST") {
      const payload = normalizePagoInput(readBody(req));
      const result = await collection.insertOne(payload);
      const created = await collection.findOne({ _id: result.insertedId });
      return res.status(201).json({ ok: true, data: created });
    }

    return res.status(405).json({ ok: false, message: "Método no permitido" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return res.status(400).json({ ok: false, message });
  }
}

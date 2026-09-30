import type { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

type Deuda = {
  _id?: ObjectId;
  fechaHora: Date;
  monto: string;
  descripcion: string;
  esDolar: boolean;
  cuotaNro?: number;
  cuotas?: number;
};

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

async function normalizeDeudaInput(body: unknown): Promise<Deuda> {
  const payload = (body ?? {}) as Record<string, unknown>;

  const fechaHora = payload.fechaHora !== undefined && payload.fechaHora !== null && String(payload.fechaHora).trim() !== ""
    ? new Date(String(payload.fechaHora))
    : new Date();
  if (Number.isNaN(fechaHora.getTime())) {
    throw new Error("fechaHora inválida");
  }

  const esDolar = Boolean(payload.esDolar ?? false);
  let montoRaw = String(payload.monto ?? "");

  if (esDolar) {
    const venta = await getDolarOficialVenta();
    const montoUsd = Number(montoRaw);
    if (!Number.isFinite(montoUsd)) {
      throw new Error("monto debe ser numérico");
    }

    montoRaw = normalizeMontoString(montoUsd * venta * 1.21);
  } else {
    if (!/^\d+(\.\d{2})?$/.test(montoRaw)) {
      throw new Error("monto debe ser un string con dos decimales");
    }
  }

  const descripcion = String(payload.descripcion ?? "").trim();
  if (!descripcion) {
    throw new Error("descripcion es obligatoria");
  }

  const deuda: Deuda = {
    fechaHora,
    monto: montoRaw,
    descripcion,
    esDolar,
  };

  if (payload.cuotaNro !== undefined && payload.cuotaNro !== null) {
    deuda.cuotaNro = Number(payload.cuotaNro);
  }

  if (payload.cuotas !== undefined && payload.cuotas !== null) {
    deuda.cuotas = Number(payload.cuotas);
  }

  return deuda;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("deudas");

    if (req.method === "GET") {
      const deudas = await collection.find({}).sort({ fechaHora: -1 }).toArray();
      return res.status(200).json({ ok: true, data: deudas });
    }

    if (req.method === "POST") {
      const payload = await normalizeDeudaInput(readBody(req));
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

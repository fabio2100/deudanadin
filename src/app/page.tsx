"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type DeudaRecord = {
  _id?: string;
  fechaHora: string | Date;
  monto: string | number;
  descripcion: string;
  esDolar?: boolean;
  cuotaNro?: number;
  cuotas?: number;
};

type PagoRecord = {
  _id?: string;
  fechaHora: string | Date;
  monto: number | string;
  descripcion?: string | null;
};

type MonthlySummary = {
  key: string;
  label: string;
  deuda: number;
  pagado: number;
  debe: number;
  deudaRecords: DeudaRecord[];
  pagoRecords: PagoRecord[];
};

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function formatCurrencyInput(value: string) {
  return value.replace(/[^\d.]/g, "");
}

function parseCurrencyInput(value: string) {
  if (value.trim() === "") {
    return 0;
  }

  const numeric = Number(value.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDate(dateValue: string | Date) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Home() {
  const [deudas, setDeudas] = useState<DeudaRecord[]>([]);
  const [pagos, setPagos] = useState<PagoRecord[]>([]);
  const [dolarVenta, setDolarVenta] = useState<number>(1);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    monto: "",
    descripcion: "",
  });
  const [debtForm, setDebtForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    esDolar: false,
    monto: "",
    descripcion: "",
  });
  const [paymentError, setPaymentError] = useState("");
  const [debtError, setDebtError] = useState("");

  const getDebtAmountInPesos = (deuda: DeudaRecord) => {
    const baseAmount = Number(deuda.monto ?? 0);
    if (!deuda.esDolar) {
      return baseAmount;
    }

    return baseAmount * dolarVenta * 1.21;
  };

  const loadData = async () => {
    try {
      const [deudasRes, pagosRes, dolarRes] = await Promise.all([
        fetch("/api/deudas"),
        fetch("/api/pagos"),
        fetch("https://dolarapi.com/v1/dolares/oficial"),
      ]);

      const [deudasData, pagosData, dolarData] = await Promise.all([
        deudasRes.json(),
        pagosRes.json(),
        dolarRes.json(),
      ]);

      setDeudas(deudasData?.data ?? []);
      setPagos(pagosData?.data ?? []);
      setDolarVenta(Number(dolarData?.venta ?? 1));
    } catch (error) {
      console.error("Error loading data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreatePago = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPaymentError("");

    const monto = parseCurrencyInput(paymentForm.monto);
    const descripcion = paymentForm.descripcion.trim();

    if (!paymentForm.fecha || !Number.isFinite(monto) || monto <= 0) {
      setPaymentError("Completá la fecha y el monto.");
      return;
    }

    try {
      const response = await fetch("/api/pagos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fechaHora: new Date(`${paymentForm.fecha}T00:00:00`),
          monto,
          descripcion: descripcion || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "No se pudo guardar el pago");
      }

      setPaymentForm({
        fecha: new Date().toISOString().slice(0, 10),
        monto: "",
        descripcion: "",
      });
      setIsPaymentFormOpen(false);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el pago";
      setPaymentError(message);
    }
  };

  const handleCreateDeuda = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDebtError("");

    const monto = parseCurrencyInput(debtForm.monto);
    const descripcion = debtForm.descripcion.trim();

    if (!debtForm.fecha || !Number.isFinite(monto) || monto <= 0 || !descripcion) {
      setDebtError("Completá la fecha, el monto y la descripción.");
      return;
    }

    try {
      const response = await fetch("/api/deudas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fechaHora: new Date(`${debtForm.fecha}T11:00:00`),
          monto: debtForm.esDolar ? String(monto) : monto.toFixed(2),
          descripcion,
          esDolar: debtForm.esDolar,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "No se pudo guardar la deuda");
      }

      setDebtForm({
        fecha: new Date().toISOString().slice(0, 10),
        esDolar: false,
        monto: "",
        descripcion: "",
      });
      setIsDebtFormOpen(false);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la deuda";
      setDebtError(message);
    }
  };

  const monthlySummary = useMemo<MonthlySummary[]>(() => {
    const monthlyMap = new Map<
      string,
      { deuda: number; pagado: number; deudaRecords: DeudaRecord[]; pagoRecords: PagoRecord[] }
    >();

    const addMonthIfNeeded = (date: Date) => {
      const key = getMonthKey(date);
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          deuda: 0,
          pagado: 0,
          deudaRecords: [],
          pagoRecords: [],
        });
      }
      return monthlyMap.get(key)!;
    };

    for (const deuda of deudas) {
      const date = deuda.fechaHora instanceof Date ? deuda.fechaHora : new Date(deuda.fechaHora);
      const current = addMonthIfNeeded(date);

      const debtAmount = getDebtAmountInPesos(deuda);
      current.deuda += debtAmount;
      current.deudaRecords.push(deuda);
    }

    for (const pago of pagos) {
      const date = pago.fechaHora instanceof Date ? pago.fechaHora : new Date(pago.fechaHora);
      const current = addMonthIfNeeded(date);

      current.pagado += Number(pago.monto ?? 0);
      current.pagoRecords.push(pago);
    }

    return Array.from(monthlyMap.entries())
      .map(([key, totals]) => {
        const [year, monthIndex] = key.split("-").map(Number);
        const date = new Date(year, monthIndex, 1);

        return {
          key,
          label: date.toLocaleString("es-AR", { month: "long", year: "numeric" }),
          deuda: totals.deuda,
          pagado: totals.pagado,
          debe: totals.deuda - totals.pagado,
          deudaRecords: totals.deudaRecords,
          pagoRecords: totals.pagoRecords,
        };
      })
      .filter((item) => item.debe > 0)
      .sort((left, right) => {
        const leftDate = new Date(
          Number(left.key.split("-")[0]),
          Number(left.key.split("-")[1]),
          1,
        );
        const rightDate = new Date(
          Number(right.key.split("-")[0]),
          Number(right.key.split("-")[1]),
          1,
        );

        return leftDate.getTime() - rightDate.getTime();
      });
  }, [deudas, pagos, getDebtAmountInPesos]);

  if (isLoading) {
    return <main className={styles.page}><section className={styles.card}><p>Cargando...</p></section></main>;
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div>
              <p className={styles.kicker}>Estado financiero</p>
              <h1>Resumen mensual</h1>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => {
                  setIsPaymentFormOpen(false);
                  setPaymentError("");
                  setIsDebtFormOpen((current) => !current);
                }}
              >
                Agregar deuda
              </button>

              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => {
                  setIsDebtFormOpen(false);
                  setDebtError("");
                  setIsPaymentFormOpen((current) => !current);
                }}
              >
                Agregar pago
              </button>
            </div>
          </div>

          {isDebtFormOpen && (
            <div
              className={styles.modalOverlay}
              onClick={() => {
                setIsDebtFormOpen(false);
                setDebtError("");
              }}
            >
              <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h2>Agregar deuda</h2>
                  <button
                    type="button"
                    className={styles.closeButton}
                    aria-label="Cerrar formulario"
                    onClick={() => {
                      setIsDebtFormOpen(false);
                      setDebtError("");
                    }}
                  >
                    ×
                  </button>
                </div>

                <form className={styles.paymentForm} onSubmit={handleCreateDeuda}>
                  <div className={styles.paymentFields}>
                    <label className={styles.paymentField}>
                      <span>Fecha</span>
                      <input
                        type="date"
                        value={debtForm.fecha}
                        onChange={(event) =>
                          setDebtForm((current) => ({ ...current, fecha: event.target.value }))
                        }
                      />
                    </label>

                    <label className={styles.checkboxField}>
                      <span>Es Dólar</span>
                      <input
                        type="checkbox"
                        checked={debtForm.esDolar}
                        onChange={(event) =>
                          setDebtForm((current) => ({ ...current, esDolar: event.target.checked }))
                        }
                      />
                    </label>

                    <label className={styles.paymentField}>
                      <span>Monto</span>
                      <div className={styles.currencyInputWrapper}>
                        <span className={styles.currencyPrefix}>$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatCurrencyInput(debtForm.monto)}
                          onChange={(event) =>
                            setDebtForm((current) => ({ ...current, monto: event.target.value }))
                          }
                          placeholder="0"
                          className={styles.currencyInput}
                        />
                      </div>
                    </label>

                    <label className={styles.paymentField}>
                      <span>Descripción</span>
                      <input
                        type="text"
                        value={debtForm.descripcion}
                        onChange={(event) =>
                          setDebtForm((current) => ({ ...current, descripcion: event.target.value }))
                        }
                        placeholder="Ej: Impuesto, tarjeta..."
                      />
                    </label>
                  </div>

                  <div className={styles.paymentActions}>
                    <button type="submit" className={styles.primaryButton}>
                      Guardar deuda
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => {
                        setIsDebtFormOpen(false);
                        setDebtError("");
                      }}
                    >
                      Cancelar
                    </button>
                  </div>

                  {debtError && <p className={styles.paymentError}>{debtError}</p>}
                </form>
              </div>
            </div>
          )}

          {isPaymentFormOpen && (
            <div
              className={styles.modalOverlay}
              onClick={() => {
                setIsPaymentFormOpen(false);
                setPaymentError("");
              }}
            >
              <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h2>Agregar pago</h2>
                  <button
                    type="button"
                    className={styles.closeButton}
                    aria-label="Cerrar formulario"
                    onClick={() => {
                      setIsPaymentFormOpen(false);
                      setPaymentError("");
                    }}
                  >
                    ×
                  </button>
                </div>

                <form className={styles.paymentForm} onSubmit={handleCreatePago}>
                  <div className={styles.paymentFields}>
                    <label className={styles.paymentField}>
                      <span>Fecha</span>
                      <input
                        type="date"
                        value={paymentForm.fecha}
                        onChange={(event) =>
                          setPaymentForm((current) => ({ ...current, fecha: event.target.value }))
                        }
                      />
                    </label>

                    <label className={styles.paymentField}>
                      <span>Monto</span>
                      <div className={styles.currencyInputWrapper}>
                        <span className={styles.currencyPrefix}>$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formatCurrencyInput(paymentForm.monto)}
                          onChange={(event) =>
                            setPaymentForm((current) => ({ ...current, monto: event.target.value }))
                          }
                          placeholder="0"
                          className={styles.currencyInput}
                        />
                      </div>
                    </label>

                    <label className={styles.paymentField}>
                      <span>Descripción</span>
                      <input
                        type="text"
                        value={paymentForm.descripcion}
                        onChange={(event) =>
                          setPaymentForm((current) => ({ ...current, descripcion: event.target.value }))
                        }
                        placeholder="Opcional"
                      />
                    </label>
                  </div>

                  <div className={styles.paymentActions}>
                    <button type="submit" className={styles.primaryButton}>
                      Guardar pago
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => {
                        setIsPaymentFormOpen(false);
                        setPaymentError("");
                      }}
                    >
                      Cancelar
                    </button>
                  </div>

                  {paymentError && <p className={styles.paymentError}>{paymentError}</p>}
                </form>
              </div>
            </div>
          )}
        </header>

        <div className={styles.tableScroll}>
          <div className={styles.table}>
            <div className={styles.headerRow}>
              <span>Mes</span>
              <span>Deuda</span>
              <span>Pagado</span>
              <span>Debe</span>
              <span>Detalle</span>
            </div>

            {monthlySummary.map((item) => (
              <div key={item.key}>
                <div className={styles.row}>
                  <span data-label="Mes">{item.label}</span>
                  <span data-label="Deuda" className={styles.deuda}>
                    {formatCurrency(item.deuda)}
                  </span>
                  <span data-label="Pagado" className={styles.pagado}>
                    {formatCurrency(item.pagado)}
                  </span>
                  <span
                    data-label="Debe"
                    className={item.debe > 0 ? styles.debeError : styles.debeSuccess}
                  >
                    {formatCurrency(item.debe)}
                  </span>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={`Ver detalle de ${item.label}`}
                    onClick={() =>
                      setExpandedMonth((current) => (current === item.key ? null : item.key))
                    }
                  >
                    ℹ️
                  </button>
                </div>

                {expandedMonth === item.key && (
                  <div className={styles.detailPanel}>
                    <div className={styles.detailGrid}>
                      <div className={styles.detailTableWrap}>
                        <h3>Deudas</h3>
                        <table className={styles.detailTable}>
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Descripción</th>
                              <th>Monto</th>
                              <th>Cuota</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.deudaRecords.length > 0 ? (
                              item.deudaRecords.map((deuda) => (
                                <tr key={deuda._id ?? `${deuda.descripcion}-${deuda.fechaHora}`}>
                                  <td>{formatDate(deuda.fechaHora)}</td>
                                  <td>{deuda.descripcion}</td>
                                  <td>{formatCurrency(getDebtAmountInPesos(deuda))}</td>
                                  <td>
                                    {deuda.cuotaNro != null && deuda.cuotas != null
                                      ? `${deuda.cuotaNro}/${deuda.cuotas}`
                                      : "-"}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4}>Sin deudas para este mes</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className={styles.detailTableWrap}>
                        <h3>Pagos</h3>
                        <table className={styles.detailTable}>
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Descripción</th>
                              <th>Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.pagoRecords.length > 0 ? (
                              item.pagoRecords.map((pago) => (
                                <tr key={pago._id ?? `${pago.fechaHora}-${pago.monto}`}>
                                  <td>{formatDate(pago.fechaHora)}</td>
                                  <td>{pago.descripcion ?? "-"}</td>
                                  <td>{formatCurrency(Number(pago.monto ?? 0))}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3}>Sin pagos para este mes</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className={styles.totalRow}>
              <span>Total</span>
              <span className={styles.deuda}>
                {formatCurrency(monthlySummary.reduce((sum, item) => sum + item.deuda, 0))}
              </span>
              <span className={styles.pagado}>
                {formatCurrency(monthlySummary.reduce((sum, item) => sum + item.pagado, 0))}
              </span>
              <span
                className={
                  monthlySummary.reduce((sum, item) => sum + item.debe, 0) > 0
                    ? styles.debeError
                    : styles.debeSuccess
                }
              >
                {formatCurrency(monthlySummary.reduce((sum, item) => sum + item.debe, 0))}
              </span>
              <span />
            </div>
          </div>
        </div>

      </section>
    </main>
  );
}

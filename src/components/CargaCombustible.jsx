// src/components/CargaCombustible.jsx
// Vista del CHOFER - Registrar carga de combustible
// Mimen SRL - App de Flota

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const ESTACIONES = {
  Shell: ["V-Power Nafta", "V-Power Gasoil"],
  YPF: ["Infinia", "Infinia Gasoil"],
};

// Props esperadas: vehiculoId, vehiculoNombre, choferId, choferNombre
export default function CargaCombustible({ vehiculoId, vehiculoNombre, choferId, choferNombre }) {
  const [form, setForm] = useState({
    estacion: "",
    tipo_combustible: "",
    litros: "",
    costo_total: "",
    odometro_km: "",
    observaciones: "",
  });
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState(null);

  const tiposDisponibles = form.estacion ? ESTACIONES[form.estacion] : [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      // Al cambiar estación, resetear tipo
      ...(name === "estacion" ? { tipo_combustible: "" } : {}),
    }));
  };

  const precioPorLitro =
    form.litros && form.costo_total
      ? (parseFloat(form.costo_total) / parseFloat(form.litros)).toFixed(2)
      : null;

  const handleSubmit = async () => {
    setError(null);

    // Validaciones básicas
    if (!form.estacion || !form.tipo_combustible || !form.litros || !form.costo_total || !form.odometro_km) {
      setError("Completá todos los campos obligatorios.");
      return;
    }
    if (parseFloat(form.litros) <= 0 || parseFloat(form.costo_total) <= 0 || parseInt(form.odometro_km) <= 0) {
      setError("Los valores deben ser mayores a cero.");
      return;
    }

    setLoading(true);
    const { error: sbError } = await supabase.from("cargas_combustible").insert({
      vehiculo_id: vehiculoId,
      vehiculo_nombre: vehiculoNombre,
      chofer_id: choferId,
      chofer_nombre: choferNombre,
      estacion: form.estacion,
      tipo_combustible: form.tipo_combustible,
      litros: parseFloat(form.litros),
      costo_total: parseFloat(form.costo_total),
      odometro_km: parseInt(form.odometro_km),
      observaciones: form.observaciones || null,
    });

    setLoading(false);

    if (sbError) {
      setError("Error al guardar: " + sbError.message);
    } else {
      setExito(true);
      setForm({ estacion: "", tipo_combustible: "", litros: "", costo_total: "", odometro_km: "", observaciones: "" });
      setTimeout(() => setExito(false), 4000);
    }
  };

  return (
    <div className="carga-combustible">
      <h2 className="seccion-titulo">⛽ Carga de Combustible</h2>
      <p className="seccion-subtitulo">
        {vehiculoNombre} · {choferNombre}
      </p>

      {/* Estación */}
      <div className="campo">
        <label>Estación *</label>
        <div className="btn-group">
          {Object.keys(ESTACIONES).map((est) => (
            <button
              key={est}
              type="button"
              className={`btn-opcion ${form.estacion === est ? "activo" : ""}`}
              onClick={() => setForm((p) => ({ ...p, estacion: est, tipo_combustible: "" }))}
            >
              {est}
            </button>
          ))}
        </div>
      </div>

      {/* Tipo de combustible */}
      {tiposDisponibles.length > 0 && (
        <div className="campo">
          <label>Tipo de Combustible *</label>
          <div className="btn-group">
            {tiposDisponibles.map((tipo) => (
              <button
                key={tipo}
                type="button"
                className={`btn-opcion ${form.tipo_combustible === tipo ? "activo" : ""}`}
                onClick={() => setForm((p) => ({ ...p, tipo_combustible: tipo }))}
              >
                {tipo}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Litros */}
      <div className="campo">
        <label>Litros cargados *</label>
        <input
          type="number"
          name="litros"
          value={form.litros}
          onChange={handleChange}
          placeholder="ej: 120.5"
          step="0.01"
          min="0"
          inputMode="decimal"
        />
      </div>

      {/* Costo total */}
      <div className="campo">
        <label>Costo total ($) *</label>
        <input
          type="number"
          name="costo_total"
          value={form.costo_total}
          onChange={handleChange}
          placeholder="ej: 85000"
          step="0.01"
          min="0"
          inputMode="decimal"
        />
      </div>

      {/* Precio calculado automático */}
      {precioPorLitro && (
        <div className="info-calculada">
          💡 Precio por litro: <strong>${precioPorLitro}</strong>
        </div>
      )}

      {/* Odómetro */}
      <div className="campo">
        <label>Odómetro actual (km) *</label>
        <input
          type="number"
          name="odometro_km"
          value={form.odometro_km}
          onChange={handleChange}
          placeholder="ej: 148500"
          min="0"
          inputMode="numeric"
        />
      </div>

      {/* Observaciones */}
      <div className="campo">
        <label>Observaciones</label>
        <textarea
          name="observaciones"
          value={form.observaciones}
          onChange={handleChange}
          placeholder="Opcional: falla en el surtidor, carga incompleta, etc."
          rows={2}
        />
      </div>

      {error && <div className="alerta error">{error}</div>}
      {exito && <div className="alerta exito">✅ Carga registrada correctamente.</div>}

      <button
        className="btn-primario"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? "Guardando..." : "Registrar Carga"}
      </button>
    </div>
  );
}

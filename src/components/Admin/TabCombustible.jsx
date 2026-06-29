// src/components/admin/TabCombustible.jsx
// Vista del ADMINISTRADOR - Historial de cargas de combustible
// Mimen SRL - App de Flota

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const ESTACION_COLOR = {
  Shell: "#f5a623",
  YPF: "#0057a8",
};

const TIPO_ICONO = {
  "V-Power Nafta": "🟢",
  "V-Power Gasoil": "🟠",
  Infinia: "🔵",
  "Infinia Gasoil": "🟣",
};

export default function TabCombustible() {
  const [cargas, setCargas] = useState([]);
  const [rendimiento, setRendimiento] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    vehiculo: "",
    estacion: "",
    desde: "",
    hasta: "",
  });
  const [vista, setVista] = useState("historial"); // "historial" | "rendimiento"

  useEffect(() => {
    fetchCargas();
    fetchRendimiento();
  }, []);

  const fetchCargas = async () => {
    setLoading(true);
    let query = supabase
      .from("cargas_combustible")
      .select("*")
      .order("created_at", { ascending: false });

    if (filtros.vehiculo) query = query.ilike("vehiculo_nombre", `%${filtros.vehiculo}%`);
    if (filtros.estacion) query = query.eq("estacion", filtros.estacion);
    if (filtros.desde) query = query.gte("created_at", filtros.desde);
    if (filtros.hasta) query = query.lte("created_at", filtros.hasta + "T23:59:59");

    const { data, error } = await query;
    if (!error) setCargas(data || []);
    setLoading(false);
  };

  const fetchRendimiento = async () => {
    const { data } = await supabase.from("v_rendimiento_combustible").select("*");
    setRendimiento(data || []);
  };

  const handleFiltro = (e) => {
    setFiltros((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const aplicarFiltros = () => {
    fetchCargas();
  };

  const limpiarFiltros = () => {
    setFiltros({ vehiculo: "", estacion: "", desde: "", hasta: "" });
    setTimeout(fetchCargas, 100);
  };

  // Totales del período visible
  const totales = cargas.reduce(
    (acc, c) => ({
      litros: acc.litros + Number(c.litros),
      gasto: acc.gasto + Number(c.costo_total),
      cargas: acc.cargas + 1,
    }),
    { litros: 0, gasto: 0, cargas: 0 }
  );

  const formatFecha = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const formatPeso = (n) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="tab-combustible">
      <h2 className="seccion-titulo">⛽ Combustible</h2>

      {/* Tabs internas */}
      <div className="tab-interno">
        <button
          className={vista === "historial" ? "activo" : ""}
          onClick={() => setVista("historial")}
        >
          Historial de Cargas
        </button>
        <button
          className={vista === "rendimiento" ? "activo" : ""}
          onClick={() => setVista("rendimiento")}
        >
          Rendimiento (km/L)
        </button>
      </div>

      {/* ========== HISTORIAL ========== */}
      {vista === "historial" && (
        <>
          {/* Filtros */}
          <div className="filtros-panel">
            <input
              type="text"
              name="vehiculo"
              placeholder="Filtrar por vehículo..."
              value={filtros.vehiculo}
              onChange={handleFiltro}
            />
            <select name="estacion" value={filtros.estacion} onChange={handleFiltro}>
              <option value="">Todas las estaciones</option>
              <option value="Shell">Shell</option>
              <option value="YPF">YPF</option>
            </select>
            <input type="date" name="desde" value={filtros.desde} onChange={handleFiltro} />
            <input type="date" name="hasta" value={filtros.hasta} onChange={handleFiltro} />
            <button className="btn-secundario" onClick={aplicarFiltros}>Filtrar</button>
            <button className="btn-ghost" onClick={limpiarFiltros}>Limpiar</button>
          </div>

          {/* Resumen del período */}
          <div className="resumen-cards">
            <div className="mini-card">
              <span className="mini-label">Cargas</span>
              <span className="mini-valor">{totales.cargas}</span>
            </div>
            <div className="mini-card">
              <span className="mini-label">Total litros</span>
              <span className="mini-valor">{totales.litros.toFixed(1)} L</span>
            </div>
            <div className="mini-card">
              <span className="mini-label">Gasto total</span>
              <span className="mini-valor">{formatPeso(totales.gasto)}</span>
            </div>
            <div className="mini-card">
              <span className="mini-label">Precio prom/L</span>
              <span className="mini-valor">
                {totales.litros > 0 ? formatPeso(totales.gasto / totales.litros) : "-"}
              </span>
            </div>
          </div>

          {/* Tabla */}
          {loading ? (
            <div className="cargando">Cargando registros...</div>
          ) : cargas.length === 0 ? (
            <div className="vacio">No hay cargas de combustible registradas.</div>
          ) : (
            <div className="tabla-scroll">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Vehículo</th>
                    <th>Chofer</th>
                    <th>Estación</th>
                    <th>Combustible</th>
                    <th>Litros</th>
                    <th>Costo</th>
                    <th>$/L</th>
                    <th>Odómetro</th>
                    <th>Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {cargas.map((c) => (
                    <tr key={c.id}>
                      <td className="td-fecha">{formatFecha(c.created_at)}</td>
                      <td className="td-vehiculo">{c.vehiculo_nombre || c.vehiculo_id}</td>
                      <td>{c.chofer_nombre}</td>
                      <td>
                        <span
                          className="badge-estacion"
                          style={{ backgroundColor: ESTACION_COLOR[c.estacion] }}
                        >
                          {c.estacion}
                        </span>
                      </td>
                      <td>
                        {TIPO_ICONO[c.tipo_combustible]} {c.tipo_combustible}
                      </td>
                      <td className="td-num">{Number(c.litros).toFixed(1)} L</td>
                      <td className="td-num">{formatPeso(c.costo_total)}</td>
                      <td className="td-num">
                        {c.precio_por_litro ? formatPeso(c.precio_por_litro) : "-"}
                      </td>
                      <td className="td-num">{c.odometro_km?.toLocaleString("es-AR")} km</td>
                      <td className="td-obs">{c.observaciones || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ========== RENDIMIENTO ========== */}
      {vista === "rendimiento" && (
        <div>
          <p className="hint">
            km/L calculado entre la primera y última carga registrada por vehículo y tipo de combustible.
            Con el GPS instalado este dato será más preciso.
          </p>
          {rendimiento.length === 0 ? (
            <div className="vacio">Sin datos de rendimiento todavía.</div>
          ) : (
            <div className="tabla-scroll">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Vehículo</th>
                    <th>Combustible</th>
                    <th>Cargas</th>
                    <th>Total litros</th>
                    <th>Gasto total</th>
                    <th>Km recorridos</th>
                    <th>km/L</th>
                  </tr>
                </thead>
                <tbody>
                  {rendimiento.map((r, i) => (
                    <tr key={i}>
                      <td>{r.vehiculo_nombre || r.vehiculo_id}</td>
                      <td>{TIPO_ICONO[r.tipo_combustible]} {r.tipo_combustible}</td>
                      <td className="td-num">{r.total_cargas}</td>
                      <td className="td-num">{Number(r.total_litros).toFixed(1)} L</td>
                      <td className="td-num">{formatPeso(r.total_gasto)}</td>
                      <td className="td-num">{r.km_recorridos?.toLocaleString("es-AR") || "-"} km</td>
                      <td className="td-num rendimiento-valor">
                        {r.km_por_litro ? (
                          <span className={r.km_por_litro < 5 ? "alerta-baja" : ""}>
                            {r.km_por_litro} km/L
                          </span>
                        ) : (
                          <span className="sin-datos">Mín. 2 cargas</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Todas las llamadas a la API van aquí.
// Si cambia la dirección del servidor, solo se edita esta línea:
const API_URL = "http://127.0.0.1:8000/api";

async function peticion(ruta, opciones = {}) {
  const resp = await fetch(`${API_URL}${ruta}`, {
    headers: { "Content-Type": "application/json" },
    ...opciones,
  });
  if (resp.status === 204) return null;          // DELETE correcto: sin contenido
  const datos = await resp.json().catch(() => null);
  if (!resp.ok) {
    const detalle = datos ? JSON.stringify(datos) : `Error ${resp.status}`;
    throw new Error(detalle);
  }
  return datos;
}

const Api = {
  listarTareas: () => peticion("/tasks/"),
  listarProyectos: () => peticion("/projects/"),
  crearTarea: (datos) => peticion("/tasks/", { method: "POST", body: JSON.stringify(datos) }),
  cambiarEstado: (id, status) =>
    peticion(`/tasks/${id}/`, { method: "PATCH", body: JSON.stringify({ status }) }),
  borrarTarea: (id) => peticion(`/tasks/${id}/`, { method: "DELETE" }),
  listarEtiquetas: () => peticion("/tags/"),
  listarTiempos: () => peticion("/time-logs/"),
  crearProyecto: (d) => peticion("/projects/", { method: "POST", body: JSON.stringify(d) }),
  borrarProyecto: (id) => peticion(`/projects/${id}/`, { method: "DELETE" }),
  crearEtiqueta: (d) => peticion("/tags/", { method: "POST", body: JSON.stringify(d) }),
  borrarEtiqueta: (id) => peticion(`/tags/${id}/`, { method: "DELETE" }),
  actualizarTarea: (id, d) => peticion(`/tasks/${id}/`, { method: "PATCH", body: JSON.stringify(d) }),
  listarUsuarios: () => peticion("/users/"),
  marcarSubtarea: (id, is_completed) =>
    peticion(`/subtasks/${id}/`, { method: "PATCH", body: JSON.stringify({ is_completed }) }),
};
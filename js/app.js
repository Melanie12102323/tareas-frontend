const $ = (id) => document.getElementById(id);
const NOMBRE_ESTADO = { "To-Do": "Pendiente", "Doing": "En progreso", "Done": "Completada" };
const FILTROS = {
  todas: () => true,
  pendientes: (t) => t.status === "To-Do",
  progreso: (t) => t.status === "Doing",
  completadas: (t) => t.status === "Done",
};
const datos = { tareas: [], etiquetas: {}, etiquetaLista: [], proyectos: [], horas: 0, filtro: "todas", texto: "", seleccion: null };

// Sistema de juego: cada tarea completada da XP según su prioridad; 100 XP = 1 nivel
const XP = { Alta: 30, Media: 20, Baja: 10 };
const xpTotal = () => datos.tareas.filter(FILTROS.completadas).reduce((s, t) => s + (XP[t.priority] ?? 0), 0);
const nivelDe = (xp) => 1 + Math.floor(xp / 100);

function contexto() {
  const hechas = datos.tareas.filter(FILTROS.completadas);
  return {
    hechas: hechas.length,
    altas: hechas.filter((t) => t.priority === "Alta").length,
    subs: datos.tareas.reduce((s, t) => s + t.subtasks.filter((x) => x.is_completed).length, 0),
    etiquetas: datos.etiquetaLista.length, proyectos: datos.proyectos.length, horas: datos.horas,
  };
}
const LOGROS = [
  { id: "primera", nombre: "Primer paso", desc: "Completa tu primera tarea", ok: (c) => c.hechas >= 1 },
  { id: "cinco", nombre: "En racha", desc: "Completa 5 tareas", ok: (c) => c.hechas >= 5 },
  { id: "diez", nombre: "Imparable", desc: "Completa 10 tareas", ok: (c) => c.hechas >= 10 },
  { id: "alta", nombre: "Bajo presión", desc: "Completa una tarea de prioridad alta", ok: (c) => c.altas >= 1 },
  { id: "subs", nombre: "Detallista", desc: "Completa 3 subtareas", ok: (c) => c.subs >= 3 },
  { id: "etiq", nombre: "Organizado", desc: "Crea 3 etiquetas", ok: (c) => c.etiquetas >= 3 },
  { id: "proy", nombre: "Planificador", desc: "Ten 2 proyectos", ok: (c) => c.proyectos >= 2 },
  { id: "tiempo", nombre: "Cronometrado", desc: "Registra 10 horas de trabajo", ok: (c) => c.horas >= 10 },
];
const logrosAbiertos = () => { const c = contexto(); return LOGROS.filter((l) => l.ok(c)); };

function toast(texto) {
  const t = $("toast");
  t.textContent = texto;
  t.classList.add("visible");
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove("visible"), 3500);
}

// Crea elementos del DOM sin usar innerHTML (los datos de la API nunca se interpretan como HTML)
function h(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  e.append(...hijos.flat().filter((x) => x != null && x !== false));
  return e;
}

function aviso(texto, error = false) {
  const m = $("mensaje");
  m.textContent = texto;
  m.classList.toggle("error", error);
}

function fechaInfo(t) {
  if (!t.due_date) return { texto: "Sin fecha", vencida: false };
  const [y, m, d] = t.due_date.split("-").map(Number);
  const f = new Date(y, m - 1, d);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dif = Math.round((f - hoy) / 864e5);
  const texto = dif === 0 ? "Hoy" : dif === 1 ? "Mañana" : dif === -1 ? "Ayer"
    : f.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return { texto, vencida: dif < 0 && t.status !== "Done" };
}

const nombreEtiqueta = (t) => datos.etiquetas[t.tags[0]] ?? "Sin etiqueta";
const tareaActual = () => datos.tareas.find((t) => t.id === datos.seleccion);

async function recargar() {
  datos.tareas = await Api.listarTareas();
  if (!tareaActual()) datos.seleccion = datos.tareas[0]?.id ?? null;
  pintar();
}

async function accion(promesa, errorTexto) {
  try { await promesa; await recargar(); aviso(""); }
  catch (e) { aviso(`${errorTexto}: ${e.message}`, true); }
}

async function cambiarEstado(id, nuevo) {
  const xpAntes = xpTotal(), logrosAntes = logrosAbiertos().length;
  await accion(Api.cambiarEstado(id, nuevo), "No se pudo cambiar el estado");
  const xpAhora = xpTotal(), abiertos = logrosAbiertos();
  const partes = [];
  if (xpAhora !== xpAntes) partes.push(`${xpAhora > xpAntes ? "+" : ""}${xpAhora - xpAntes} XP`);
  if (nivelDe(xpAhora) > nivelDe(xpAntes)) partes.push(`¡Subiste al nivel ${nivelDe(xpAhora)}!`);
  if (abiertos.length > logrosAntes) partes.push(`Logro: ${abiertos[abiertos.length - 1].nombre}`);
  if (partes.length) toast(partes.join(" · "));
}
function eliminar(t) {
  if (confirm(`¿Eliminar "${t.title}"?`)) accion(Api.borrarTarea(t.id), "No se pudo eliminar");
}
function seleccionar(id) { datos.seleccion = id; pintar(); }

function fila(t) {
  const vence = fechaInfo(t);
  return h("li", {
    class: "tarea" + (t.status === "Done" ? " hecha" : ""), role: "option", tabindex: "0",
    "aria-selected": String(t.id === datos.seleccion),
    onclick: () => seleccionar(t.id),
    onkeydown: (ev) => { if (ev.key === "Enter" && ev.target === ev.currentTarget) seleccionar(t.id); },
  },
    h("input", {
      type: "checkbox", "aria-label": `Completar ${t.title}`, checked: t.status === "Done",
      onclick: (ev) => ev.stopPropagation(),
      onchange: (ev) => cambiarEstado(t.id, ev.target.checked ? "Done" : "To-Do"),
    }),
    h("div", {},
      h("strong", {}, t.title),
      h("div", { class: "meta" },
        h("span", { class: "pill etiqueta" }, nombreEtiqueta(t)),
        h("span", { class: vence.vencida ? "vencida" : "" }, vence.texto))),
    h("span", { class: `pill ${t.priority}` }, t.priority),
    h("span", { class: "flecha", "aria-hidden": "true" }, "›"));
}

function pintarLista() {
  const q = datos.texto.toLowerCase();
  const visibles = datos.tareas.filter(FILTROS[datos.filtro]).filter((t) => t.title.toLowerCase().includes(q));
  $("tareas").replaceChildren(...(visibles.length
    ? visibles.map(fila)
    : [h("li", { class: "vacio" }, "No hay tareas en esta vista. Crea una con «Nueva tarea».")]));
}

function bloque(titulo, ...contenido) {
  return h("div", { class: "bloque" }, h("h4", {}, titulo), ...contenido);
}

function pintarDetalle() {
  const t = tareaActual();
  if (!t) {
    $("detalle").replaceChildren(h("p", { class: "vacio" }, "Elige una tarea de la lista para ver su detalle."));
    return;
  }
  const proyecto = datos.proyectos.find((p) => p.id === t.project);
  const hechas = t.subtasks.filter((s) => s.is_completed).length;
  $("detalle").replaceChildren(
    h("h3", {}, t.title),
    h("div", { class: "meta" },
      h("span", { class: "pill etiqueta" }, nombreEtiqueta(t)),
      h("span", { class: `pill ${t.priority}` }, t.priority)),
    bloque("Descripción", h("p", {}, t.description || "Sin descripción.")),
    bloque("Etiquetas", h("div", { class: "flex flex-wrap gap-2" }, ...(datos.etiquetaLista.length
      ? datos.etiquetaLista.map((e) => { const on = t.tags.includes(e.id); return h("button", {
          type: "button", class: "tag-chip" + (on ? " on" : ""), "aria-pressed": String(on),
          onclick: () => accion(Api.actualizarTarea(t.id, { tags: on ? t.tags.filter((x) => x !== e.id) : [...t.tags, e.id] }), "No se pudieron cambiar las etiquetas"),
        }, e.name); })
      : [h("p", {}, "Aún no hay etiquetas. Créalas en «Proyectos y etiquetas».")]))),
    bloque("Proyecto", h("p", {}, proyecto?.name ?? "Sin proyecto")),
    bloque("Fecha de vencimiento", h("p", {}, `${fechaInfo(t).texto} · ${t.due_date}`)),
    t.subtasks.length ? bloque(`Subtareas (${hechas}/${t.subtasks.length})`,
      ...t.subtasks.map((s) => h("label", { class: "sub" },
        h("input", { type: "checkbox", checked: s.is_completed,
          onchange: (ev) => accion(Api.marcarSubtarea(s.id, ev.target.checked), "No se pudo actualizar la subtarea") }),
        s.title))) : null,
    bloque("Estado", h("select", { "aria-label": "Estado", onchange: (ev) => cambiarEstado(t.id, ev.target.value) },
      ...Object.entries(NOMBRE_ESTADO).map(([v, n]) => h("option", { value: v, selected: v === t.status }, n)))),
    h("div", { class: "acciones" },
      t.status === "To-Do" ? h("button", { class: "btn azul", onclick: () => cambiarEstado(t.id, "Doing") }, "Marcar como en progreso") : null,
      t.status !== "Done"
        ? h("button", { class: "btn verde", onclick: () => cambiarEstado(t.id, "Done") }, "Completar")
        : h("button", { class: "btn azul", onclick: () => cambiarEstado(t.id, "To-Do") }, "Reabrir"),
      h("button", { class: "btn rojo", onclick: () => eliminar(t) }, "Eliminar")));
}

function pintarJugador() {
  const xp = xpTotal();
  $("nivel-texto").textContent = `Nivel ${nivelDe(xp)}`;
  $("xp").style.width = `${xp % 100}%`;
  $("xp-texto").textContent = `${xp % 100} / 100 XP`;
  const cuenta = (f) => datos.tareas.filter(FILTROS[f]).length;
  $("stats").replaceChildren(
    ...[["Pendientes", cuenta("pendientes")], ["En progreso", cuenta("progreso")], ["Completadas", cuenta("completadas")]]
      .map(([n, v]) => h("div", {}, h("dt", {}, n), h("dd", {}, String(v)))));
}

const tarjeta = (titulo, valor) => h("div", { class: "stat-card" }, h("span", {}, titulo), h("strong", {}, valor));
const barra = (nombre, valor, total, color) => h("div", { class: "barra-fila" },
  h("span", {}, nombre),
  h("div", { class: "barra-fondo" }, h("i", { class: color, style: `width:${total ? Math.round(valor * 100 / total) : 0}%` })),
  h("b", {}, String(valor)));

function pintarStats() {
  const total = datos.tareas.length, c = contexto();
  const cuenta = (f) => datos.tareas.filter(FILTROS[f]).length;
  const prio = (p) => datos.tareas.filter((t) => t.priority === p).length;
  const abiertos = logrosAbiertos().map((l) => l.id);
  $("stats-contenido").replaceChildren(
    h("div", { class: "grid gap-3 sm:grid-cols-3" },
      tarjeta("Completado", `${total ? Math.round(c.hechas * 100 / total) : 0}%`),
      tarjeta("XP total", String(xpTotal())),
      tarjeta("Horas registradas", c.horas.toFixed(1))),
    h("div", { class: "grid gap-6 mt-5 sm:grid-cols-2" },
      h("div", {}, h("h3", { class: "sub-titulo" }, "Tareas por estado"),
        barra("Pendientes", cuenta("pendientes"), total, "bg-ambar"),
        barra("En progreso", cuenta("progreso"), total, "bg-cian"),
        barra("Completadas", cuenta("completadas"), total, "bg-verde")),
      h("div", {}, h("h3", { class: "sub-titulo" }, "Por prioridad"),
        barra("Alta", prio("Alta"), total, "bg-rojo"),
        barra("Media", prio("Media"), total, "bg-ambar"),
        barra("Baja", prio("Baja"), total, "bg-verde"))),
    h("h3", { class: "sub-titulo mt-6" }, `Logros (${abiertos.length}/${LOGROS.length})`),
    h("div", { class: "grid gap-2.5 sm:grid-cols-2" }, ...LOGROS.map((l) => {
      const abierto = abiertos.includes(l.id);
      return h("div", { class: "logro" + (abierto ? "" : " bloqueado") },
        h("strong", {}, (abierto ? "★ " : "Bloqueado · ") + l.nombre), h("span", {}, l.desc));
    })));
}

const COLOR_OK = /^#[0-9a-f]{6}$/i;
function pintarGestion() {
  const fila = (contenido, alBorrar) => h("li", { class: "fila-item" }, contenido,
    h("button", { type: "button", class: "btn mini rojo", onclick: alBorrar }, "Eliminar"));
  $("lista-proyectos").replaceChildren(...(datos.proyectos.length
    ? datos.proyectos.map((p) => fila(h("span", {}, p.name), () => borrarCatalogo(
        `¿Eliminar el proyecto "${p.name}"? También se eliminarán sus tareas.`, Api.borrarProyecto, p.id)))
    : [h("li", { class: "vacio" }, "Aún no hay proyectos.")]));
  $("lista-etiquetas").replaceChildren(...(datos.etiquetaLista.length
    ? datos.etiquetaLista.map((e) => fila(
        h("span", {}, h("i", { class: "punto", style: COLOR_OK.test(e.color) ? `background:${e.color}` : "" }), e.name),
        () => borrarCatalogo(`¿Eliminar la etiqueta "${e.name}"?`, Api.borrarEtiqueta, e.id)))
    : [h("li", { class: "vacio" }, "Aún no hay etiquetas.")]));
}

function pintar() { pintarLista(); pintarDetalle(); pintarJugador(); pintarStats(); pintarGestion(); }

function llenarProyectos() {
  $("proyecto").replaceChildren(...(datos.proyectos.length
    ? datos.proyectos.map((p) => h("option", { value: p.id }, p.name))
    : [h("option", { value: "" }, "Crea un proyecto primero")]));
}

async function recargarCatalogos() {
  const [proyectos, etiquetas] = await Promise.all([Api.listarProyectos(), Api.listarEtiquetas()]);
  datos.proyectos = proyectos; datos.etiquetaLista = etiquetas;
  datos.etiquetas = Object.fromEntries(etiquetas.map((e) => [e.id, e.name]));
  llenarProyectos();
  await recargar();
}

async function borrarCatalogo(pregunta, borrar, id) {
  if (!confirm(pregunta)) return;
  try { await borrar(id); $("error-gestion").textContent = ""; await recargarCatalogos(); }
  catch (e) { $("error-gestion").textContent = `No se pudo eliminar: ${e.message}`; }
}

// Eventos de la interfaz
$("buscar").addEventListener("input", (ev) => { datos.texto = ev.target.value; pintarLista(); });
$("filtros").addEventListener("click", (ev) => {
  const chip = ev.target.closest(".chip");
  if (!chip) return;
  datos.filtro = chip.dataset.filtro;
  document.querySelectorAll(".chip").forEach((c) => {
    c.classList.toggle("activo", c === chip);
    c.setAttribute("aria-pressed", String(c === chip));
  });
  pintarLista();
});
$("abrir-nueva").addEventListener("click", () => { $("error-form").textContent = ""; $("dialogo").showModal(); });
$("cancelar").addEventListener("click", () => $("dialogo").close());
$("form-tarea").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    const nueva = await Api.crearTarea({
      project: Number($("proyecto").value), title: $("titulo").value.trim(),
      description: $("descripcion").value.trim(), priority: $("prioridad").value,
      status: "To-Do", due_date: $("fecha").value,
    });
    ev.target.reset();
    $("dialogo").close();
    datos.seleccion = nueva.id;
    await recargar();
  } catch (e) {
    $("error-form").textContent = `No se pudo guardar: ${e.message}`;
  }
});

async function iniciar() {
  try {
    const [tareas, proyectos, etiquetas, usuarios, tiempos] = await Promise.all([
      Api.listarTareas(), Api.listarProyectos(), Api.listarEtiquetas(), Api.listarUsuarios(), Api.listarTiempos(),
    ]);
    datos.tareas = tareas; datos.proyectos = proyectos; datos.etiquetaLista = etiquetas;
    datos.etiquetas = Object.fromEntries(etiquetas.map((e) => [e.id, e.name]));
    datos.horas = tiempos.reduce((suma, x) => suma + Number(x.hours), 0);
    datos.seleccion = tareas[0]?.id ?? null;
    llenarProyectos();
    const nombre = usuarios[0]?.name.split(" ")[0] ?? "Usuario";
    $("nombre-usuario").textContent = nombre;
    $("avatar").textContent = nombre[0].toUpperCase();
    $("estado-api").textContent = "API conectada";
    $("estado-api").classList.add("ok");
    pintar();
  } catch (e) {
    $("estado-api").textContent = "Sin conexión con la API";
    $("estado-api").classList.add("fallo");
    aviso("No se pudo conectar. Revisa que Django esté corriendo, el CORS y los permisos.", true);
    console.error(e);
  }
}
// Navegación entre vistas y ventana de gestión
function mostrarVista(v) {
  $("vista-tareas").classList.toggle("hidden", v !== "tareas");
  $("vista-stats").classList.toggle("hidden", v !== "stats");
  $("nav-tareas").classList.toggle("activo", v === "tareas");
  $("nav-stats").classList.toggle("activo", v === "stats");
}
$("nav-tareas").addEventListener("click", () => mostrarVista("tareas"));
$("nav-stats").addEventListener("click", () => mostrarVista("stats"));
$("abrir-gestion").addEventListener("click", () => { $("error-gestion").textContent = ""; $("dialogo-gestion").showModal(); });
$("cerrar-gestion").addEventListener("click", () => $("dialogo-gestion").close());

$("form-proyecto").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    await Api.crearProyecto({ name: $("p-nombre").value.trim(), description: "",
      budget: $("p-presupuesto").value || "0", deadline: $("p-fecha").value });
    ev.target.reset(); $("error-gestion").textContent = "";
    await recargarCatalogos();
  } catch (e) { $("error-gestion").textContent = `No se pudo crear el proyecto: ${e.message}`; }
});
$("form-etiqueta").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    await Api.crearEtiqueta({ name: $("e-nombre").value.trim(), color: $("e-color").value });
    ev.target.reset(); $("error-gestion").textContent = "";
    await recargarCatalogos();
  } catch (e) { $("error-gestion").textContent = `No se pudo crear la etiqueta: ${e.message}`; }
});

iniciar();
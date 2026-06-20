const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
];

const MESES_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const EQUIPO_CONFIG_KEY = 'cuzco-equipo-config';

const BONO_PLANIFICACION_COSTE = 50;

const BONO_LABELS_LEGACY = {
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  sesiones: 'Sesiones',
  otro: 'Otro'
};

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const TIPOS_EVENTO = {
  'renovacion-pagada': { label: 'Renovación pagada', color: '#1e3a8a', orden: 1 },
  'valoracion-entrenamiento': { label: 'Valoración entrenamiento', color: '#2563eb', orden: 1.5 },
  'renovacion-probable': { label: 'Renovación probable', color: '#84cc16', orden: 2 },
  baja: { label: 'Baja', color: '#92400e', orden: 3 },
  entrenamiento: { label: 'Entrenamiento', color: '#dc2626', orden: 4 },
  reserva: { label: 'Reserva', color: '#9ca3af', orden: 5 },
  'vacaciones-cliente': { label: 'Vacaciones cliente', color: '#f97316', orden: 6 },
  'vacaciones-entrenador': { label: 'Vacaciones entrenador', color: 'split', orden: 7 },
  'mod-pesos': { label: 'Mod. pesos PDF', color: '#171717', orden: 8 },
  'mod-ejercicios': { label: 'Mod. ejercicios PDF', color: '#171717', orden: 9 },
  'entrega-nutricion': { label: 'Entrega nutrición', color: '#171717', orden: 10 }
};

const MAPA_CALENDARIO_LEGACY = {
  contratacion: 'entrenamiento',
  vacaciones: 'vacaciones-cliente',
  sesion: 'renovacion-probable',
  libre: 'renovacion-pagada',
  baja: 'baja'
};

const LOCAL_USERS_KEY = 'cuzco-usuarios';
const LOCAL_SESSION_KEY = 'cuzco-session';

let sb = null;
let modoLocal = false;
let usuario = null;
let perfil = null;
let clientes = [];
let clientesEquipo = [];
let miembrosEquipo = [];
let equipoConfig = null;
let clienteActivo = null;
let tipoActivo = 'entrenamiento';
let modoInsercionEvento = 'detallado';
let vistaActual = 'dashboard';
let miembroEquipoActivo = null;
let equipoPaso = 'miembros';
let busquedaEquipoMiembro = '';
let origenDetalleEquipo = null;
let clienteLecturaEquipo = false;
let busqueda = '';
let guardando = false;
let mesGlobalCalendario = (() => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
})();
let mesEquipoMiembroCalendario = mesGlobalCalendario;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clienteVacio() {
  const hoy = new Date();
  const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  return {
    id: uid(),
    apellidos: '',
    nombre: '',
    bono: { modalidad: '', coste: '', sesionesSemanales: '', duracionMinutos: '' },
    mesContratacion: mes,
    calendario: {},
    sesiones: [],
    sesionesTotal: 0,
    confirmacionHorario: false,
    horarioNotas: '',
    pdf1: { entregado: false, fecha: '' },
    pdf2: { entregado: false, fecha: '' },
    ejercicios: [],
    pesos: []
  };
}

function nombreCompleto(c) {
  const partes = [c.apellidos, c.nombre].filter(Boolean);
  return partes.length ? partes.join(', ') : 'Sin nombre';
}

function iniciales(texto) {
  return texto.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function toast(msg, duracion = 2500) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), duracion);
}

function mostrarEstadoAuth(msg, tipo = 'success') {
  const el = $('#auth-status-banner');
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-status-banner auth-status-${tipo}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), tipo === 'success' ? 12000 : 8000);
}

function solicitarGuardadoNativo(email, password, nombre) {
  const loginEmail = $('#login-email');
  const loginPassword = $('#login-password');
  if (loginEmail) loginEmail.value = email;
  if (loginPassword) loginPassword.value = password;

  if (window.PasswordCredential && navigator.credentials?.store) {
    const cred = new PasswordCredential({ id: email, password, name: nombre });
    navigator.credentials.store(cred).catch(() => {});
  }
}

function finalizarRegistro(email, password, nombre, alContinuar) {
  const msg = '¡Cuenta creada correctamente!';
  mostrarEstadoAuth(msg, 'success');
  mostrarExitoRegistro(msg);
  toast(msg, 4000);
  solicitarGuardadoNativo(email, password, nombre);
  requestAnimationFrame(() => alContinuar());
}

const CONFIG_STORAGE_KEY = 'cuzco-supabase-config';

function esUrlSupabaseValida(url) {
  return /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test((url || '').trim());
}

function getConfig() {
  const fallback = window.CUZCO_CONFIG || { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };
  try {
    const stored = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || 'null');
    if (stored?.SUPABASE_URL && stored?.SUPABASE_ANON_KEY && esUrlSupabaseValida(stored.SUPABASE_URL)) {
      return stored;
    }
    if (stored && !esUrlSupabaseValida(stored.SUPABASE_URL)) {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    }
  } catch { /* usar config.js */ }
  return fallback;
}

function extraerRefDesdeClave(key) {
  try {
    const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.ref || null;
  } catch {
    return null;
  }
}

function normalizarUrlSupabase(url, key) {
  const entrada = url.trim().replace(/\/$/, '');

  const desdeDashboard = entrada.match(/dashboard\/project\/([a-z0-9]+)/i);
  if (desdeDashboard) {
    return `https://${desdeDashboard[1]}.supabase.co`;
  }

  if (/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(entrada)) {
    return entrada;
  }

  if (/^[a-z0-9]{10,}$/i.test(entrada)) {
    return `https://${entrada}.supabase.co`;
  }

  const ref = extraerRefDesdeClave(key);
  if (ref) return `https://${ref}.supabase.co`;

  return entrada;
}

function guardarConfigSupabase(url, key) {
  const config = {
    SUPABASE_URL: normalizarUrlSupabase(url, key),
    SUPABASE_ANON_KEY: key.trim()
  };
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  return config;
}

function urlRedireccionEmail() {
  return window.location.origin + window.location.pathname;
}

function supabaseConfigurado() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getConfig();
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

const SUPABASE_LOCAL = 'vendor/supabase.min.js';
const SUPABASE_CDNS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

function supabaseDisponible() {
  return typeof window.supabase?.createClient === 'function';
}

function cargarScriptUnaVez(src) {
  return new Promise((resolve, reject) => {
    const existente = document.querySelector(`script[src="${src}"]`);
    if (existente) {
      if (supabaseDisponible()) {
        resolve();
        return;
      }
      if (existente.dataset.cuzcoFallo === '1') {
        reject(new Error('Supabase no se cargó correctamente.'));
        return;
      }
      const alTerminar = () => {
        if (supabaseDisponible()) resolve();
        else {
          existente.dataset.cuzcoFallo = '1';
          reject(new Error('Supabase no se cargó correctamente.'));
        }
      };
      existente.addEventListener('load', alTerminar, { once: true });
      existente.addEventListener('error', () => reject(new Error('No se pudo descargar Supabase.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      if (supabaseDisponible()) resolve();
      else reject(new Error('Supabase no se cargó correctamente.'));
    };
    script.onerror = () => reject(new Error('No se pudo descargar Supabase.'));
    document.head.appendChild(script);
  });
}

async function cargarSupabaseScript() {
  if (supabaseDisponible()) return;

  const errores = [];
  for (const src of [SUPABASE_LOCAL, ...SUPABASE_CDNS]) {
    try {
      await cargarScriptUnaVez(src);
      if (supabaseDisponible()) return;
    } catch (err) {
      errores.push(err.message);
      console.warn('Supabase no cargó desde', src, err);
    }
  }

  throw new Error(errores[0] || 'Supabase no se cargó correctamente.');
}

function initSupabase() {
  if (!supabaseConfigurado()) return null;
  if (!window.supabase?.createClient) {
    throw new Error('La librería Supabase no está disponible. Recarga la página.');
  }
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getConfig();
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true
    }
  });
}

function cuzcoTogglePwd(btn) {
  if (!btn) return;
  const input = document.getElementById(btn.dataset.target);
  if (!input) return;
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  btn.textContent = visible ? 'Ver' : 'Ocultar';
  btn.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
}

function initTogglePassword() {
  window.cuzcoTogglePwd = cuzcoTogglePwd;
}

function localClientesKey(userId) {
  return `cuzco-clientes-${userId}`;
}

function getLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLocalUsers(users) {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {
    throw new Error('No se puede guardar la cuenta. Abre la app en http://localhost:3456 (no como archivo).');
  }
}

async function hashPassword(password) {
  const input = `${password}:cuzco-salt`;
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return `local-${Math.abs(hash)}`;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function guardarClientesLocal() {
  if (!usuario || !modoLocal) return;
  localStorage.setItem(localClientesKey(usuario.id), JSON.stringify(clientes));
}

const debounceGuardarLocal = debounce(guardarClientesLocal, 400);

function esMiembroEquipoPropio(userId = miembroEquipoActivo) {
  return Boolean(userId && usuario && userId === usuario.id);
}

function clientesVistaMiembro(userId = miembroEquipoActivo) {
  return userId ? clientesDeMiembro(userId) : [];
}

function filtrarClientesLista(lista, q = '') {
  if (!q.trim()) return lista;
  const query = q.toLowerCase();
  return lista.filter((c) => nombreCompleto(c).toLowerCase().includes(query));
}

function refrescarVistaGeneral() {
  if (vistaActual === 'dashboard') renderDashboard();
  else if (vistaActual === 'equipo' && equipoPaso === 'miembro') renderDashboardMiembro();
}

function obtenerCliente(id = clienteActivo) {
  if (clienteLecturaEquipo || (origenDetalleEquipo && !esMiembroEquipoPropio(origenDetalleEquipo.miembroId))) {
    return clientesEquipo.find((c) => c.id === id) || null;
  }
  return clientes.find((c) => c.id === id);
}

async function cargarClientes() {
  if (!usuario) return;

  if (modoLocal) {
    try {
      const data = localStorage.getItem(localClientesKey(usuario.id));
      clientes = (data ? JSON.parse(data) : []).map((c) =>
        normalizarCliente({ ...c, user_id: usuario.id })
      );
    } catch {
      clientes = [];
    }
    renderTodo();
    return;
  }

  if (!sb) return;
  const { data, error } = await sb
    .from('clientes')
    .select('id, data')
    .order('updated_at', { ascending: false });

  if (error) {
    toast('Error al cargar clientes');
    console.error(error);
    return;
  }

  clientes = (data || []).map((row) =>
    normalizarCliente({ ...row.data, id: row.id, user_id: row.user_id })
  );
  renderTodo();
}

async function persistirCliente(id) {
  if (!usuario || guardando) return;

  if (modoLocal) {
    debounceGuardarLocal();
    return;
  }

  if (!sb) return;
  const c = obtenerCliente(id);
  if (!c) return;

  guardando = true;
  const { id: clientId, ...data } = c;
  const { error } = await sb
    .from('clientes')
    .upsert({
      id: clientId,
      user_id: usuario.id,
      data,
      updated_at: new Date().toISOString()
    });

  guardando = false;
  if (error) {
    toast('Error al guardar');
    console.error(error);
  }
}

const debounceGuardar = debounce((id) => persistirCliente(id), 400);

function sincronizarClienteEquipo(c) {
  if (!usuario || !c) return;
  const copy = { ...c, user_id: usuario.id };
  const idx = clientesEquipo.findIndex((x) => x.id === c.id);
  if (idx >= 0) clientesEquipo[idx] = copy;
  else clientesEquipo.push(copy);
}

function actualizarCliente(patch, id = clienteActivo) {
  const idx = clientes.findIndex((c) => c.id === id);
  if (idx === -1) return;
  clientes[idx] = { ...clientes[idx], ...patch };
  sincronizarClienteEquipo(clientes[idx]);
  debounceGuardar(id);
  renderLista();
  refrescarVistaGeneral();
}

function leerDatosFormulario() {
  if (!clienteActivo) return null;
  const c = obtenerCliente();
  if (!c) return null;

  const bono = normalizarBono({
    ...c.bono,
    modalidad: $('#bono-modalidad')?.value || '',
    sesionesSemanales: $('#bono-sesiones-semana')?.value || '',
    duracionMinutos: $('#bono-duracion')?.value || '',
    coste: $('#bono-coste')?.value || ''
  });
  if (bono.modalidad === 'planificacion') bono.coste = String(BONO_PLANIFICACION_COSTE);

  return {
    apellidos: $('#apellidos')?.value || '',
    nombre: $('#nombre')?.value || '',
    bono,
    mesContratacion: $('#mes-contratacion')?.value || '',
    sesionesTotal: Number($('#sesiones-total')?.value) || 0,
    confirmacionHorario: Boolean($('#confirmacion-horario')?.checked),
    horarioNotas: $('#horario-notas')?.value || '',
    pdf1: {
      entregado: Boolean($('#pdf1-entregado')?.checked),
      fecha: $('#pdf1-fecha')?.value || ''
    },
    pdf2: {
      entregado: Boolean($('#pdf2-entregado')?.checked),
      fecha: $('#pdf2-fecha')?.value || ''
    }
  };
}

async function guardarClienteCompleto(opts = {}) {
  const id = clienteActivo;
  if (!id) return false;

  const patch = leerDatosFormulario();
  if (!patch) return false;

  const idx = clientes.findIndex((c) => c.id === id);
  if (idx === -1) return false;

  clientes[idx] = { ...clientes[idx], ...patch };
  sincronizarClienteEquipo(clientes[idx]);
  await persistirCliente(id);

  const titulo = $('#form-title');
  if (titulo) titulo.textContent = nombreCompleto(clientes[idx]);
  renderLista();
  refrescarVistaGeneral();
  if (!opts.silencioso) toast('Cliente guardado', 2000);
  return true;
}

async function eliminarClienteRemoto(id) {
  if (modoLocal) {
    guardarClientesLocal();
    return;
  }
  if (!sb) return;
  const { error } = await sb.from('clientes').delete().eq('id', id);
  if (error) toast('Error al eliminar');
}

let contextMenuClienteActivo = null;

function menuContextoClienteAbierto() {
  const menu = $('#cliente-context-menu');
  return Boolean(menu && !menu.classList.contains('hidden'));
}

function cerrarMenuContextoCliente() {
  const menu = $('#cliente-context-menu');
  if (menu) menu.classList.add('hidden');
  contextMenuClienteActivo = null;
}

function irAPerfilCliente(clienteId) {
  seleccionarCliente(clienteId);
  setVista('detalle');
  cerrarMenuContextoCliente();
}

async function confirmarYEliminarCliente(id) {
  const c = obtenerClientePorId(id);
  if (!c) return false;

  const nombre = nombreCompleto(c);
  const aviso = `¿Eliminar el perfil de «${nombre}»?\n\nSe borrarán todos sus datos: bono, calendario, sesiones, PDFs y tareas. Esta acción no se puede deshacer.`;
  if (!confirm(aviso)) return false;

  if (!confirm(`Última confirmación: ¿eliminar definitivamente a «${nombre}»?`)) return false;

  await eliminarClienteRemoto(id);
  clientes = clientes.filter((x) => x.id !== id);
  clientesEquipo = clientesEquipo.filter((x) => x.id !== id);
  if (clienteActivo === id) {
    clienteActivo = clientes.length ? clientes[0].id : null;
  }
  cerrarMenuContextoCliente();
  renderTodo();
  if (!clienteActivo) setVista('dashboard');
  toast('Cliente eliminado', 2000);
  return true;
}

function abrirMenuContextoCliente(e, clienteId) {
  const c = obtenerClientePorId(clienteId);
  if (!c) return;

  e.preventDefault();
  e.stopPropagation();

  cerrarMenuContextoEvento();
  cerrarMenuContextoCliente();

  const menu = $('#cliente-context-menu');
  const titulo = $('#cliente-context-menu-title');
  if (!menu) return;

  contextMenuClienteActivo = { clienteId };
  if (titulo) titulo.textContent = nombreCompleto(c);

  menu.classList.remove('hidden');
  menu.style.left = `${Math.min(e.clientX, window.innerWidth - 220)}px`;
  menu.style.top = `${Math.min(e.clientY, window.innerHeight - 120)}px`;
}

function enlazarContextoCliente(el, clienteId) {
  if (!el || el.dataset.ctxCliente === '1') return;
  el.dataset.ctxCliente = '1';
  el.addEventListener('contextmenu', (e) => abrirMenuContextoCliente(e, clienteId));
}

function initMenuContextoCliente() {
  if (window.__cuzcoClienteContextBound) return;
  window.__cuzcoClienteContextBound = true;

  const menu = $('#cliente-context-menu');
  menu?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  on('#cliente-ctx-ver', 'click', (e) => {
    e.stopPropagation();
    if (contextMenuClienteActivo?.clienteId) {
      irAPerfilCliente(contextMenuClienteActivo.clienteId);
    }
  });

  on('#cliente-ctx-eliminar', 'click', async (e) => {
    e.stopPropagation();
    if (contextMenuClienteActivo?.clienteId) {
      await confirmarYEliminarCliente(contextMenuClienteActivo.clienteId);
    }
  });
}

function renderTodo() {
  renderLista();
  if (vistaActual === 'detalle') renderFormulario();
  else refrescarVistaGeneral();
}

const OVERVIEW_LABELS = [
  'Cliente',
  'Bono',
  'Contratación',
  'Sesiones',
  'Horario',
  'PDF 1',
  'PDF 2',
  'Ejercicios',
  'Pesos',
  ''
];

function etiquetarFilasTablaMovil(tr) {
  [...tr.children].forEach((td, i) => {
    if (OVERVIEW_LABELS[i]) td.dataset.label = OVERVIEW_LABELS[i];
  });
}

function cerrarSidebarMovil() {
  $('#app')?.classList.remove('sidebar-open');
  const overlay = $('#sidebar-overlay');
  if (overlay) overlay.classList.add('hidden');
  const btn = $('#btn-mobile-menu');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function abrirSidebarMovil() {
  $('#app')?.classList.add('sidebar-open');
  const overlay = $('#sidebar-overlay');
  if (overlay) overlay.classList.remove('hidden');
  const btn = $('#btn-mobile-menu');
  if (btn) btn.setAttribute('aria-expanded', 'true');
}

function actualizarTituloMovil() {
  const el = $('#mobile-topbar-title');
  if (!el) return;
  if (vistaActual === 'dashboard') {
    el.textContent = 'Vista general';
  } else if (vistaActual === 'detalle') {
    const c = obtenerCliente();
    el.textContent = c ? nombreCompleto(c) : 'Ficha detalle';
  } else if (vistaActual === 'equipo') {
    el.textContent = equipoPaso === 'miembro' && miembroEquipoActivo
      ? nombreMiembro(miembroEquipoActivo)
      : 'Equipo';
  } else {
    el.textContent = 'Cuzco';
  }
}

function initMobileNav() {
  if (window.__cuzcoMobileNavBound) return;
  window.__cuzcoMobileNavBound = true;

  on('#btn-mobile-menu', 'click', () => {
    if ($('#app')?.classList.contains('sidebar-open')) cerrarSidebarMovil();
    else abrirSidebarMovil();
  });

  on('#sidebar-overlay', 'click', cerrarSidebarMovil);

  ['#nav-dashboard', '#nav-detalle', '#nav-equipo', '#btn-nuevo-cliente', '#btn-logout'].forEach((sel) => {
    on(sel, 'click', cerrarSidebarMovil);
  });
}

function setVista(vista) {
  vistaActual = vista;
  cerrarSidebarMovil();
  $('#dashboard').classList.toggle('hidden', vista !== 'dashboard');
  $('#detail-view').classList.toggle('hidden', vista !== 'detalle');
  $('#equipo-view')?.classList.toggle('hidden', vista !== 'equipo');
  $('#nav-dashboard').classList.toggle('active', vista === 'dashboard');
  $('#nav-detalle').classList.toggle('active', vista === 'detalle');
  $('#nav-equipo')?.classList.toggle('active', vista === 'equipo');

  $('#btn-nuevo-cliente')?.classList.toggle(
    'hidden',
    vista === 'equipo' && equipoPaso === 'miembro' && !esMiembroEquipoPropio()
  );

  if (vista === 'dashboard') {
    origenDetalleEquipo = null;
    clienteLecturaEquipo = false;
    renderDashboard();
    renderLista();
  } else if (vista === 'detalle') {
    renderFormulario();
    renderLista();
  } else if (vista === 'equipo') {
    origenDetalleEquipo = null;
    clienteLecturaEquipo = false;
    renderVistaEquipo();
  }

  actualizarTituloMovil();
}

function renderLista() {
  const list = $('#client-list');
  list.innerHTML = '';

  let filtrados;
  if (vistaActual === 'equipo' && equipoPaso === 'miembro' && miembroEquipoActivo) {
    filtrados = filtrarClientesLista(clientesVistaMiembro(), busquedaEquipoMiembro);
  } else {
    filtrados = filtrarClientes();
  }

  if (filtrados.length === 0) {
    list.innerHTML = '<p class="sidebar-empty">No hay clientes</p>';
    return;
  }

  filtrados.forEach((c) => {
    const bonoSub = textoBono(c.bono);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'client-item' + (c.id === clienteActivo ? ' active' : '');
    btn.innerHTML = `
      <span class="client-item-name">${esc(nombreCompleto(c))}</span>
      <span class="client-item-sub">${esc(bonoSub === '—' ? 'Sin bono' : bonoSub)}</span>
    `;
    btn.addEventListener('click', () => {
      abrirDetalleCliente(c.id);
      cerrarSidebarMovil();
    });
    if (esMiembroEquipoPropio() || vistaActual !== 'equipo' || equipoPaso !== 'miembro') {
      enlazarContextoCliente(btn, c.id);
    }
    list.appendChild(btn);
  });
}

function abrirDetalleCliente(clienteId) {
  if (vistaActual === 'equipo' && equipoPaso === 'miembro' && miembroEquipoActivo) {
    origenDetalleEquipo = { miembroId: miembroEquipoActivo };
    clienteLecturaEquipo = !esMiembroEquipoPropio();
    seleccionarCliente(clienteId);
    setVista('detalle');
    return;
  }
  origenDetalleEquipo = null;
  clienteLecturaEquipo = false;
  seleccionarCliente(clienteId);
  setVista('detalle');
}

function filtrarClientes() {
  if (!busqueda.trim()) return clientes;
  const q = busqueda.toLowerCase();
  return clientes.filter((c) => nombreCompleto(c).toLowerCase().includes(q));
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function seleccionarCliente(id) {
  clienteActivo = id;
  renderLista();
  if (vistaActual === 'detalle') renderFormulario();
}

function contarPendientes(items) {
  return items.filter((i) => !i.done).length;
}

function resumenSesiones(c) {
  const done = c.sesiones.filter((s) => s.done).length;
  const total = c.sesiones.length;
  return { done, total, pendientes: total - done };
}

function parseMes(mesStr) {
  const [year, month] = mesStr.split('-').map(Number);
  return { year, month: month - 1 };
}

function formatFecha(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function migrarCalendario(calendario = {}) {
  const out = {};
  Object.entries(calendario).forEach(([fecha, val]) => {
    if (typeof val === 'string') {
      const tipo = MAPA_CALENDARIO_LEGACY[val] || val;
      if (TIPOS_EVENTO[tipo]) out[fecha] = [{ tipo, detalle: '' }];
      return;
    }
    if (Array.isArray(val)) {
      out[fecha] = val
        .map((ev) => ({
          tipo: ev?.tipo || 'entrenamiento',
          detalle: ev?.detalle || ''
        }))
        .filter((ev) => TIPOS_EVENTO[ev.tipo]);
      if (!out[fecha].length) delete out[fecha];
      return;
    }
    if (val && typeof val === 'object' && val.tipo) {
      out[fecha] = [{ tipo: val.tipo, detalle: val.detalle || '' }];
    }
  });
  return out;
}

function equipoConfigVacio() {
  return {
    facturacionObjetivo: 0,
    horasObjetivo: 0,
    valoracionesObjetivo: 0,
    miembros: {}
  };
}

function asegurarMiembroConfig(userId) {
  if (!equipoConfig.miembros[userId]) {
    equipoConfig.miembros[userId] = {
      facturacionPct: 0,
      horasPct: 0,
      valoracionesPct: 0
    };
  }
}

function proximosMeses(cantidad = 3) {
  const hoy = new Date();
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const mes = d.getMonth();
    return {
      key: `${d.getFullYear()}-${String(mes + 1).padStart(2, '0')}`,
      label: `${MESES_FULL[mes]} ${d.getFullYear()}`
    };
  });
}

function formatoEuros(n) {
  const val = Number(n) || 0;
  return `${val.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;
}

function parseImporte(texto) {
  if (!texto) return 0;
  const m = String(texto).replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function parseMinutos(texto, fallback = 60) {
  if (!texto) return fallback;
  const m = String(texto).match(/(\d+)\s*min/i);
  return m ? parseInt(m[1], 10) : fallback;
}

function importeDesdeCliente(c, ev) {
  const det = parseImporte(ev?.detalle);
  if (det > 0 && det < 10000) return det;
  return parseFloat(normalizarBono(c.bono).coste) || 0;
}

function clientesDeMiembro(userId) {
  return clientesEquipo.filter((c) => c.user_id === userId);
}

function calcularFacturacionMes(userId, mesKey) {
  let real = 0;
  let prevista = 0;
  const lista = userId ? clientesDeMiembro(userId) : clientesEquipo;

  lista.forEach((c) => {
    const bono = normalizarBono(c.bono);
    if (bono.modalidad && c.mesContratacion === mesKey) {
      prevista += parseFloat(bono.coste) || 0;
    }
    Object.keys(c.calendario || {}).forEach((fecha) => {
      if (!fecha.startsWith(mesKey)) return;
      eventosDelDia(c.calendario, fecha).forEach((ev) => {
        const importe = importeDesdeCliente(c, ev);
        if (ev.tipo === 'renovacion-pagada') real += importe;
        if (ev.tipo === 'renovacion-probable') prevista += importe;
      });
    });
  });

  return { real, prevista };
}

function calcularHorasMes(userId, mesKey) {
  let minutos = 0;
  const lista = userId ? clientesDeMiembro(userId) : clientesEquipo;
  lista.forEach((c) => {
    const fallback = parseInt(normalizarBono(c.bono).duracionMinutos, 10) || 60;
    Object.keys(c.calendario || {}).forEach((fecha) => {
      if (!fecha.startsWith(mesKey)) return;
      eventosDelDia(c.calendario, fecha).forEach((ev) => {
        if (ev.tipo === 'entrenamiento') {
          minutos += parseMinutos(ev.detalle, fallback);
        }
      });
    });
  });
  return minutos / 60;
}

function contarValoracionesMes(userId, mesKey) {
  let total = 0;
  const lista = userId ? clientesDeMiembro(userId) : clientesEquipo;
  lista.forEach((c) => {
    Object.keys(c.calendario || {}).forEach((fecha) => {
      if (!fecha.startsWith(mesKey)) return;
      eventosDelDia(c.calendario, fecha).forEach((ev) => {
        if (ev.tipo === 'valoracion-entrenamiento') total += 1;
      });
    });
  });
  return total;
}

const debounceGuardarEquipo = debounce(() => guardarEquipoConfig(), 500);

async function cargarEquipoConfig() {
  equipoConfig = equipoConfigVacio();
  try {
    if (modoLocal) {
      const raw = localStorage.getItem(EQUIPO_CONFIG_KEY);
      if (raw) Object.assign(equipoConfig, JSON.parse(raw));
    } else if (sb) {
      const { data } = await sb.from('equipo_config').select('config').eq('id', 1).maybeSingle();
      if (data?.config) Object.assign(equipoConfig, data.config);
    }
  } catch (err) {
    console.warn('Config equipo:', err);
  }
  miembrosEquipo.forEach((m) => asegurarMiembroConfig(m.id));
}

async function guardarEquipoConfig() {
  if (!usuario) return;
  try {
    if (modoLocal) {
      localStorage.setItem(EQUIPO_CONFIG_KEY, JSON.stringify(equipoConfig));
    } else if (sb) {
      await sb.from('equipo_config').upsert({
        id: 1,
        config: equipoConfig,
        updated_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error(err);
    toast('No se pudo guardar la configuración del equipo');
  }
}

async function cargarMiembrosEquipo() {
  if (!usuario) return;
  if (modoLocal) {
    miembrosEquipo = [{ id: usuario.id, nombre: perfil?.nombre || 'Usuario' }];
    return;
  }
  if (!sb) return;
  const { data, error } = await sb.from('perfiles').select('id, nombre').order('nombre');
  if (error || !data?.length) {
    miembrosEquipo = [{ id: usuario.id, nombre: perfil?.nombre || 'Usuario' }];
    return;
  }
  miembrosEquipo = data;
}

async function cargarClientesEquipo() {
  if (!usuario) return;
  if (modoLocal) {
    clientesEquipo = clientes.map((c) => ({ ...c, user_id: usuario.id }));
    return;
  }
  if (!sb) return;
  const { data, error } = await sb.from('clientes').select('id, user_id, data');
  if (error) {
    clientesEquipo = clientes.map((c) => ({ ...c, user_id: usuario.id }));
    return;
  }
  clientesEquipo = (data || []).map((row) =>
    normalizarCliente({ ...row.data, id: row.id, user_id: row.user_id })
  );
}

function nombreMiembro(userId) {
  return miembrosEquipo.find((m) => m.id === userId)?.nombre || 'Miembro';
}

function htmlAccesoPerfilMiembro(m) {
  const n = clientesDeMiembro(m.id).length;
  return `<button type="button" class="equipo-acceso-perfil" data-equipo-ver="${m.id}">
    <span class="equipo-acceso-avatar">${esc(iniciales(nombreMiembro(m.id)))}</span>
    <span class="equipo-acceso-texto">
      <span class="equipo-acceso-nombre">${esc(nombreMiembro(m.id))}</span>
      <span class="equipo-acceso-meta">${n} cliente${n !== 1 ? 's' : ''} · Ver perfil y cartera</span>
    </span>
  </button>`;
}

function abrirVistaEquipo(miembroId = null) {
  if (miembroId) {
    miembroEquipoActivo = miembroId;
    equipoPaso = 'miembro';
    busquedaEquipoMiembro = '';
    mesEquipoMiembroCalendario = mesGlobalCalendario;
  } else {
    equipoPaso = 'miembros';
    miembroEquipoActivo = null;
    busquedaEquipoMiembro = '';
  }
  setVista('equipo');
}

function renderListaMiembrosEquipo() {
  const lista = $('#equipo-miembros-lista');
  if (!lista) return;

  if (!miembrosEquipo.length) {
    lista.innerHTML = '<p class="equipo-detalle-empty">No hay miembros en el equipo.</p>';
    return;
  }

  lista.innerHTML = miembrosEquipo.map((m) => {
    const n = clientesDeMiembro(m.id).length;
    const esPropio = m.id === usuario?.id;
    return `<button type="button" class="equipo-miembro-card" data-equipo-miembro="${m.id}">
      <span class="equipo-miembro-card-avatar">${esc(iniciales(nombreMiembro(m.id)))}</span>
      <span class="equipo-miembro-card-texto">
        <span class="equipo-miembro-card-nombre">${esc(nombreMiembro(m.id))}${esPropio ? ' (tú)' : ''}</span>
        <span class="equipo-miembro-card-meta">${n} cliente${n !== 1 ? 's' : ''} · Ver cartera completa</span>
      </span>
    </button>`;
  }).join('');
}

function renderVistaEquipo() {
  const pasoMiembros = $('#equipo-paso-miembros');
  const pasoDashboard = $('#equipo-miembro-dashboard');
  if (!pasoMiembros || !pasoDashboard) return;

  pasoMiembros.classList.toggle('hidden', equipoPaso !== 'miembros');
  pasoDashboard.classList.toggle('hidden', equipoPaso !== 'miembro');

  if (equipoPaso === 'miembros') {
    renderListaMiembrosEquipo();
    renderLista();
    return;
  }

  if (!miembroEquipoActivo || !miembrosEquipo.some((m) => m.id === miembroEquipoActivo)) {
    equipoPaso = 'miembros';
    miembroEquipoActivo = null;
    renderVistaEquipo();
    return;
  }

  const nombre = nombreMiembro(miembroEquipoActivo);
  const esPropio = esMiembroEquipoPropio();
  const titulo = $('#equipo-miembro-dashboard-titulo');
  const sub = $('#equipo-miembro-dashboard-sub');
  if (titulo) titulo.textContent = esPropio ? 'Tu cartera' : `Cartera de ${nombre}`;
  if (sub) {
    sub.textContent = esPropio
      ? 'Vista general de tus clientes — calendario, facturación y objetivos'
      : `Vista general de ${nombre} — solo lectura`;
  }

  const hint = $('#equipo-global-calendar-hint');
  if (hint) {
    hint.textContent = esPropio
      ? 'Clic en evento de la leyenda → asigna cliente (0,5 s) → arrastra al día'
      : 'Calendario global del miembro (solo lectura)';
  }

  renderDashboardMiembro();
  renderLista();
}

function renderPanelEquipoMiembro(miembroId) {
  const panel = $('#equipo-panel-miembro');
  if (!panel || !usuario || !miembroId) return;

  asegurarMiembroConfig(miembroId);
  const mesActual = proximosMeses(1)[0];
  const cfg = equipoConfig.miembros[miembroId];
  const editable = esMiembroEquipoPropio(miembroId);
  const nombre = nombreMiembro(miembroId);
  const disabledAttr = editable ? '' : ' disabled readonly';

  let html = '';

  html += '<section class="equipo-section"><h3 class="equipo-section-title">Facturación</h3>';
  proximosMeses(3).forEach((mes) => {
    const f = calcularFacturacionMes(miembroId, mes.key);
    html += `<div class="equipo-mes-card">
      <h4 class="equipo-mes-label">${mes.label}</h4>
      <div class="equipo-kpi-row">
        <span class="equipo-kpi"><strong>Real</strong> ${formatoEuros(f.real)}</span>
        <span class="equipo-kpi"><strong>Prevista</strong> ${formatoEuros(f.prevista)}</span>
      </div>
    </div>`;
  });
  html += '</section>';

  const objFact = ((equipoConfig.facturacionObjetivo || 0) * (cfg.facturacionPct || 0)) / 100;
  const realFact = calcularFacturacionMes(miembroId, mesActual.key).real;
  html += `<section class="equipo-section">
    <h3 class="equipo-section-title">Objetivo facturación <span class="equipo-mes-ref">${mesActual.label}</span></h3>
    <label class="equipo-field-label">Total objetivo equipo (€)
      <input type="number" class="equipo-input" data-equipo="facturacionObjetivo" min="0" step="1" value="${equipoConfig.facturacionObjetivo || 0}"${disabledAttr}>
    </label>
    <div class="equipo-miembro-row">
      <span class="equipo-miembro-nombre">${esc(nombre)}</span>
      <label>% <input type="number" class="equipo-input equipo-input-sm" data-equipo-miembro="${miembroId}" data-field="facturacionPct" min="0" max="100" step="0.1" value="${cfg.facturacionPct || 0}"${disabledAttr}></label>
      <span class="equipo-objetivo-val">${formatoEuros(realFact)} / ${formatoEuros(objFact)}</span>
    </div>
  </section>`;

  const objHoras = ((equipoConfig.horasObjetivo || 0) * (cfg.horasPct || 0)) / 100;
  const realHoras = calcularHorasMes(miembroId, mesActual.key);
  html += `<section class="equipo-section">
    <h3 class="equipo-section-title">Horas entrenamiento objetivo <span class="equipo-mes-ref">${mesActual.label}</span></h3>
    <label class="equipo-field-label">Total horas objetivo equipo
      <input type="number" class="equipo-input" data-equipo="horasObjetivo" min="0" step="0.5" value="${equipoConfig.horasObjetivo || 0}"${disabledAttr}>
    </label>
    <div class="equipo-miembro-row">
      <span class="equipo-miembro-nombre">${esc(nombre)}</span>
      <label>% <input type="number" class="equipo-input equipo-input-sm" data-equipo-miembro="${miembroId}" data-field="horasPct" min="0" max="100" step="0.1" value="${cfg.horasPct || 0}"${disabledAttr}></label>
      <span class="equipo-objetivo-val">${realHoras.toFixed(1)} / ${objHoras.toFixed(1)} h</span>
    </div>
  </section>`;

  const objVal = Math.round(((equipoConfig.valoracionesObjetivo || 0) * (cfg.valoracionesPct || 0)) / 100);
  const realVal = contarValoracionesMes(miembroId, mesActual.key);
  html += `<section class="equipo-section">
    <h3 class="equipo-section-title">Valoraciones de entrenamiento <span class="equipo-mes-ref">${mesActual.label}</span></h3>
    <label class="equipo-field-label">Total valoraciones objetivo equipo
      <input type="number" class="equipo-input" data-equipo="valoracionesObjetivo" min="0" step="1" value="${equipoConfig.valoracionesObjetivo || 0}"${disabledAttr}>
    </label>
    <div class="equipo-miembro-row">
      <span class="equipo-miembro-nombre">${esc(nombre)}</span>
      <label>% <input type="number" class="equipo-input equipo-input-sm" data-equipo-miembro="${miembroId}" data-field="valoracionesPct" min="0" max="100" step="0.1" value="${cfg.valoracionesPct || 0}"${disabledAttr}></label>
      <span class="equipo-objetivo-val">${realVal} / ${objVal}</span>
    </div>
  </section>`;

  panel.innerHTML = html;

  if (!panel.dataset.bound) {
    panel.dataset.bound = '1';
    panel.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.matches('.equipo-input') || t.disabled) return;
      const equipoField = t.dataset.equipo;
      const miembroCfgId = t.dataset.equipoMiembro;
      const field = t.dataset.field;
      const val = t.type === 'number' ? parseFloat(t.value) || 0 : t.value;

      if (equipoField) {
        equipoConfig[equipoField] = val;
      } else if (miembroCfgId && field) {
        asegurarMiembroConfig(miembroCfgId);
        equipoConfig.miembros[miembroCfgId][field] = val;
      }
      debounceGuardarEquipo();
      renderPanelEquipoMiembro(miembroEquipoActivo);
      if (vistaActual === 'dashboard') renderPanelEquipo();
    });
  }
}

function renderDashboardMiembro() {
  if (!miembroEquipoActivo) return;

  const tbody = $('#equipo-overview-body');
  const filtrados = filtrarClientesLista(clientesVistaMiembro(), busquedaEquipoMiembro)
    .slice()
    .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));
  const editable = esMiembroEquipoPropio();

  $('#equipo-client-count').textContent = `${filtrados.length} cliente${filtrados.length !== 1 ? 's' : ''}`;
  $('#equipo-dashboard-empty')?.classList.toggle('hidden', filtrados.length > 0);
  $('#equipo-table-wrap')?.classList.toggle('hidden', filtrados.length === 0);

  renderCalendarioGlobal({
    container: '#equipo-global-calendar-container',
    legend: '#equipo-global-calendar-legend',
    title: '#equipo-global-calendar-title',
    clientesLista: clientesVistaMiembro(),
    mes: mesEquipoMiembroCalendario,
    editable,
    legendKey: 'equipo-miembro'
  });
  renderPanelEquipoMiembro(miembroEquipoActivo);

  if (!tbody) return;
  tbody.innerHTML = '';

  filtrados.forEach((c) => {
    const ses = resumenSesiones(c);
    const ejPend = contarPendientes(c.ejercicios);
    const pePend = contarPendientes(c.pesos);
    const bonoTxt = textoBono(c.bono);

    const tr = document.createElement('tr');
    tr.dataset.clienteId = c.id;
    tr.innerHTML = `
      <td class="cell-name cliente-perfil"><strong>${esc(nombreCompleto(c))}</strong></td>
      <td class="cell-bono">${esc(bonoTxt)}</td>
      <td class="cell-cal">${miniCalendarioHTML(c)}</td>
      <td class="cell-sesiones">
        <span class="progress-pill ${ses.pendientes === 0 && ses.total > 0 ? 'ok' : ses.pendientes > 0 ? 'warn' : ''}">
          ${ses.done}/${ses.total}
        </span>
      </td>
      <td class="cell-check">${statusChip(c.confirmacionHorario)}</td>
      <td class="cell-check">${statusChip(c.pdf1.entregado)}</td>
      <td class="cell-check">${statusChip(c.pdf2.entregado)}</td>
      <td class="cell-todo">${ejPend > 0 ? `<span class="count-badge">${ejPend}</span>` : statusChip(true, '—', '0')}</td>
      <td class="cell-todo">${pePend > 0 ? `<span class="count-badge">${pePend}</span>` : statusChip(true, '—', '0')}</td>
      <td class="cell-actions">
        <button type="button" class="btn-table" data-action="edit" data-id="${c.id}">${editable ? 'Editar' : 'Ver'}</button>
      </td>
    `;

    tr.querySelector('[data-action="edit"]').addEventListener('click', () => {
      abrirDetalleCliente(c.id);
    });

    if (editable) {
      enlazarContextoCliente(tr, c.id);
      const checks = [
        { col: 4, field: 'confirmacionHorario', key: null },
        { col: 5, field: 'pdf1', key: 'entregado' },
        { col: 6, field: 'pdf2', key: 'entregado' }
      ];
      checks.forEach(({ col, field, key }) => {
        const td = tr.children[col];
        td.style.cursor = 'pointer';
        td.title = 'Clic para cambiar';
        td.addEventListener('click', () => {
          if (key) {
            const obj = { ...c[field], [key]: !c[field][key] };
            actualizarCliente({ [field]: obj }, c.id);
          } else {
            actualizarCliente({ [field]: !c[field] }, c.id);
          }
          renderDashboardMiembro();
        });
      });
    }

    etiquetarFilasTablaMovil(tr);
    tbody.appendChild(tr);
  });
}

function initVistaEquipo() {
  if (window.__cuzcoEquipoViewBound) return;
  window.__cuzcoEquipoViewBound = true;

  on('#nav-equipo', 'click', () => abrirVistaEquipo());
  on('#btn-volver-dashboard-equipo', 'click', () => setVista('dashboard'));
  on('#btn-volver-miembros-equipo', 'click', () => {
    equipoPaso = 'miembros';
    miembroEquipoActivo = null;
    busquedaEquipoMiembro = '';
    renderVistaEquipo();
    actualizarTituloMovil();
  });

  on('#equipo-btn-cal-prev', 'click', () => cambiarMesCalendarioEquipo(-1));
  on('#equipo-btn-cal-next', 'click', () => cambiarMesCalendarioEquipo(1));

  on('#equipo-dashboard-search', 'input', (e) => {
    busquedaEquipoMiembro = e.target.value;
    renderDashboardMiembro();
    renderLista();
  });

  $('#equipo-miembros-lista')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-equipo-miembro]');
    if (!card) return;
    abrirVistaEquipo(card.dataset.equipoMiembro);
  });
}

function cambiarMesCalendarioEquipo(delta) {
  const { year, month } = parseMes(mesEquipoMiembroCalendario);
  const d = new Date(year, month + delta, 1);
  mesEquipoMiembroCalendario = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderDashboardMiembro();
}

function renderPanelEquipo() {
  const panel = $('#equipo-panel');
  if (!panel || !usuario) return;

  miembrosEquipo.forEach((m) => asegurarMiembroConfig(m.id));
  const mesActual = proximosMeses(1)[0];

  let html = '';

  html += `<section class="equipo-section equipo-perfiles-section">
    <h3 class="equipo-section-title">Perfiles del equipo</h3>
    <p class="equipo-section-sub">Consulta la cartera y fichas completas de cada miembro</p>
    <div class="equipo-perfiles-list">${miembrosEquipo.map((m) => htmlAccesoPerfilMiembro(m)).join('')}</div>
    <button type="button" class="btn btn-ghost btn-sm equipo-ver-todos" data-equipo-ver-todos="1">Abrir sección de equipo →</button>
  </section>`;

  html += '<section class="equipo-section"><h3 class="equipo-section-title">Facturación</h3>';
  proximosMeses(3).forEach((mes) => {
    const equipoReal = calcularFacturacionMes(null, mes.key);
    html += `<div class="equipo-mes-card">
      <h4 class="equipo-mes-label">${mes.label}</h4>
      <div class="equipo-kpi-row">
        <span class="equipo-kpi"><strong>Real</strong> ${formatoEuros(equipoReal.real)}</span>
        <span class="equipo-kpi"><strong>Prevista</strong> ${formatoEuros(equipoReal.prevista)}</span>
      </div>
      <ul class="equipo-miembro-list">`;
    miembrosEquipo.forEach((m) => {
      const f = calcularFacturacionMes(m.id, mes.key);
      html += `<li><span>${esc(nombreMiembro(m.id))}</span><span>${formatoEuros(f.real)} / ${formatoEuros(f.prevista)}</span></li>`;
    });
    html += '</ul></div>';
  });
  html += '</section>';

  html += `<section class="equipo-section">
    <h3 class="equipo-section-title">Objetivo facturación equipo <span class="equipo-mes-ref">${mesActual.label}</span></h3>
    <label class="equipo-field-label">Total objetivo (€)
      <input type="number" class="equipo-input" data-equipo="facturacionObjetivo" min="0" step="1" value="${equipoConfig.facturacionObjetivo || 0}">
    </label>
    <div class="equipo-miembros-grid">`;
  miembrosEquipo.forEach((m) => {
    const cfg = equipoConfig.miembros[m.id];
    const objetivo = ((equipoConfig.facturacionObjetivo || 0) * (cfg.facturacionPct || 0)) / 100;
    const real = calcularFacturacionMes(m.id, mesActual.key).real;
    html += `<div class="equipo-miembro-block">
      ${htmlAccesoPerfilMiembro(m)}
      <div class="equipo-miembro-row">
        <span class="equipo-miembro-nombre">${esc(nombreMiembro(m.id))}</span>
        <label>% <input type="number" class="equipo-input equipo-input-sm" data-equipo-miembro="${m.id}" data-field="facturacionPct" min="0" max="100" step="0.1" value="${cfg.facturacionPct || 0}"></label>
        <span class="equipo-objetivo-val">${formatoEuros(real)} / ${formatoEuros(objetivo)}</span>
      </div>
    </div>`;
  });
  html += '</div></section>';

  html += `<section class="equipo-section">
    <h3 class="equipo-section-title">Horas entrenamiento objetivo <span class="equipo-mes-ref">${mesActual.label}</span></h3>
    <label class="equipo-field-label">Total horas objetivo
      <input type="number" class="equipo-input" data-equipo="horasObjetivo" min="0" step="0.5" value="${equipoConfig.horasObjetivo || 0}">
    </label>
    <div class="equipo-miembros-grid">`;
  miembrosEquipo.forEach((m) => {
    const cfg = equipoConfig.miembros[m.id];
    const objetivo = ((equipoConfig.horasObjetivo || 0) * (cfg.horasPct || 0)) / 100;
    const real = calcularHorasMes(m.id, mesActual.key);
    html += `<div class="equipo-miembro-block">
      ${htmlAccesoPerfilMiembro(m)}
      <div class="equipo-miembro-row">
        <span class="equipo-miembro-nombre">${esc(nombreMiembro(m.id))}</span>
        <label>% <input type="number" class="equipo-input equipo-input-sm" data-equipo-miembro="${m.id}" data-field="horasPct" min="0" max="100" step="0.1" value="${cfg.horasPct || 0}"></label>
        <span class="equipo-objetivo-val">${real.toFixed(1)} / ${objetivo.toFixed(1)} h</span>
      </div>
    </div>`;
  });
  html += '</div></section>';

  html += `<section class="equipo-section">
    <h3 class="equipo-section-title">Valoraciones de entrenamiento <span class="equipo-mes-ref">${mesActual.label}</span></h3>
    <label class="equipo-field-label">Total valoraciones objetivo
      <input type="number" class="equipo-input" data-equipo="valoracionesObjetivo" min="0" step="1" value="${equipoConfig.valoracionesObjetivo || 0}">
    </label>
    <div class="equipo-miembros-grid">`;
  miembrosEquipo.forEach((m) => {
    const cfg = equipoConfig.miembros[m.id];
    const objetivo = Math.round(((equipoConfig.valoracionesObjetivo || 0) * (cfg.valoracionesPct || 0)) / 100);
    const real = contarValoracionesMes(m.id, mesActual.key);
    html += `<div class="equipo-miembro-block">
      ${htmlAccesoPerfilMiembro(m)}
      <div class="equipo-miembro-row">
        <span class="equipo-miembro-nombre">${esc(nombreMiembro(m.id))}</span>
        <label>% <input type="number" class="equipo-input equipo-input-sm" data-equipo-miembro="${m.id}" data-field="valoracionesPct" min="0" max="100" step="0.1" value="${cfg.valoracionesPct || 0}"></label>
        <span class="equipo-objetivo-val">${real} / ${objetivo}</span>
      </div>
    </div>`;
  });
  html += '</div></section>';

  panel.innerHTML = html;

  if (!panel.dataset.bound) {
    panel.dataset.bound = '1';
    panel.addEventListener('click', (e) => {
      const ver = e.target.closest('[data-equipo-ver]');
      if (ver) {
        abrirVistaEquipo(ver.dataset.equipoVer);
        return;
      }
      if (e.target.closest('[data-equipo-ver-todos]')) {
        abrirVistaEquipo();
      }
    });
    panel.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.matches('.equipo-input')) return;
      const equipoField = t.dataset.equipo;
      const miembroId = t.dataset.equipoMiembro;
      const field = t.dataset.field;
      const val = t.type === 'number' ? parseFloat(t.value) || 0 : t.value;

      if (equipoField) {
        equipoConfig[equipoField] = val;
      } else if (miembroId && field) {
        asegurarMiembroConfig(miembroId);
        equipoConfig.miembros[miembroId][field] = val;
      }
      debounceGuardarEquipo();
      renderPanelEquipo();
    });
  }
}

function normalizarBono(bono = {}) {
  const b = { ...bono };
  if (!b.modalidad && b.tipologia) {
    if (['mensual', 'trimestral', 'semestral', 'anual', 'sesiones'].includes(b.tipologia)) {
      b.modalidad = 'entrenamiento-4sem';
    } else if (b.tipologia === 'otro') {
      b.modalidad = '';
    }
  }
  const out = {
    modalidad: b.modalidad || '',
    coste: b.coste ?? '',
    sesionesSemanales: b.sesionesSemanales ? String(b.sesionesSemanales) : '',
    duracionMinutos: b.duracionMinutos ? String(b.duracionMinutos) : ''
  };
  if (out.modalidad === 'planificacion') {
    out.coste = String(BONO_PLANIFICACION_COSTE);
    out.sesionesSemanales = '';
    out.duracionMinutos = '';
  }
  return out;
}

function textoBono(bono) {
  const b = normalizarBono(bono);
  if (!b.modalidad) {
    if (bono?.tipologia) {
      const leg = BONO_LABELS_LEGACY[bono.tipologia] || bono.tipologia;
      return bono.coste ? `${leg} · ${bono.coste}€` : leg;
    }
    return '—';
  }
  if (b.modalidad === 'planificacion') {
    return `Planificación · ${b.coste || BONO_PLANIFICACION_COSTE}€`;
  }
  if (b.modalidad === 'entrenamiento-4sem') {
    const partes = ['4 semanas'];
    if (b.sesionesSemanales) {
      partes.push(`${b.sesionesSemanales} ses./sem`);
    }
    if (b.duracionMinutos) {
      partes.push(`${b.duracionMinutos} min`);
    }
    if (b.coste) partes.push(`${b.coste}€`);
    return partes.join(' · ');
  }
  return '—';
}

function normalizarCliente(c) {
  return {
    ...c,
    bono: normalizarBono(c.bono),
    calendario: migrarCalendario(c.calendario)
  };
}

function actualizarCamposBonoUI(modalidad) {
  const plan = $('#bono-planificacion-fields');
  const entreno = $('#bono-entrenamiento-fields');
  const coste = $('#bono-coste');
  if (plan) plan.classList.toggle('hidden', modalidad !== 'planificacion');
  if (entreno) entreno.classList.toggle('hidden', modalidad !== 'entrenamiento-4sem');
  if (coste) {
    if (modalidad === 'planificacion') {
      coste.value = BONO_PLANIFICACION_COSTE;
      coste.readOnly = true;
    } else {
      coste.readOnly = false;
      if (modalidad !== 'entrenamiento-4sem') coste.value = '';
    }
  }
}

function eventosDelDia(calendario, fecha) {
  const raw = calendario?.[fecha];
  if (!raw) return [];
  if (typeof raw === 'string') {
    const tipo = MAPA_CALENDARIO_LEGACY[raw] || raw;
    return TIPOS_EVENTO[tipo] ? [{ tipo, detalle: '' }] : [];
  }
  if (Array.isArray(raw)) {
    return raw.filter((ev) => ev?.tipo && TIPOS_EVENTO[ev.tipo]);
  }
  return [];
}

function ordenarEventos(eventos) {
  return [...eventos].sort(
    (a, b) => (TIPOS_EVENTO[a.tipo]?.orden ?? 99) - (TIPOS_EVENTO[b.tipo]?.orden ?? 99)
  );
}

function tamanoNucleoEventos(n, compact = false) {
  if (compact) return Math.min(14, Math.max(5, 4 + n * 1.5));
  return Math.min(38, Math.max(12, 10 + n * 3));
}

function lineaEvento(ev, incluirCliente = false) {
  const meta = TIPOS_EVENTO[ev.tipo];
  const etiqueta = meta?.label || ev.tipo;
  const detalle = ev.detalle ? ` ${ev.detalle}` : '';
  const prefijo = incluirCliente && ev.clienteNombre ? `${ev.clienteNombre}: ` : '';
  return `${prefijo}${etiqueta}${detalle}`;
}

function ensureCalTooltip() {
  if (!window._calTooltip) {
    window._calTooltip = document.createElement('div');
    window._calTooltip.id = 'cal-tooltip';
    window._calTooltip.className = 'cal-tooltip hidden';
    document.body.appendChild(window._calTooltip);
  }
  return window._calTooltip;
}

let calTooltipHideTimer = null;

function cancelarOcultarTooltip() {
  clearTimeout(calTooltipHideTimer);
}

function programarOcultarTooltip() {
  cancelarOcultarTooltip();
  calTooltipHideTimer = setTimeout(ocultarTooltipCalendario, 150);
}

function ocultarTooltipCalendario() {
  cancelarOcultarTooltip();
  const tip = ensureCalTooltip();
  tip.classList.add('hidden');
  tip.classList.remove('interactive');
  tip.innerHTML = '';
}

function itemsEventoConIndice(eventos) {
  return eventos.map((ev, idx) => ({ ev, idx }));
}

function normalizarItemsEvento(eventos) {
  if (!eventos?.length) return [];
  if (eventos[0]?.ev) return eventos;
  return eventos.map((ev, idx) => ({
    ev,
    idx: ev.eventoIdx != null ? ev.eventoIdx : idx,
    clienteId: ev.clienteId || null
  }));
}

function ordenarItemsEvento(items, global = false) {
  return [...items].sort((a, b) => {
    if (global) {
      const na = a.ev.clienteNombre || '';
      const nb = b.ev.clienteNombre || '';
      if (na !== nb) return na.localeCompare(nb, 'es');
    }
    return (TIPOS_EVENTO[a.ev.tipo]?.orden ?? 99) - (TIPOS_EVENTO[b.ev.tipo]?.orden ?? 99);
  });
}

function posicionarTooltipCalendario(anchor) {
  const tip = ensureCalTooltip();
  const rect = anchor.getBoundingClientRect();
  tip.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
  tip.style.top = `${rect.bottom + 6}px`;
}

function mostrarTooltipCalendario(eventos, anchor, opts = {}) {
  const items = normalizarItemsEvento(eventos);
  if (!items.length) return;

  const { editable = false, fecha = null } = opts;
  const tip = ensureCalTooltip();
  cancelarOcultarTooltip();

  const global = Boolean(opts.global);
  tip.innerHTML = ordenarItemsEvento(items, global).map(({ ev, idx, clienteId }) => {
    const meta = TIPOS_EVENTO[ev.tipo];
    const split = ev.tipo === 'vacaciones-entrenador';
    const swatch = split
      ? '<span class="tip-swatch tip-swatch-split"></span>'
      : `<span class="tip-swatch" style="background:${meta?.color || '#999'}"></span>`;
    const clienteAttr = clienteId ? ` data-cliente-id="${clienteId}"` : '';
    const acciones = editable && fecha != null
      ? `<span class="tip-actions">`
        + `<button type="button" class="tip-edit" data-idx="${idx}"${clienteAttr} aria-label="Editar evento" title="Editar">✎</button>`
        + `<button type="button" class="tip-delete" data-idx="${idx}"${clienteAttr} aria-label="Eliminar evento" title="Eliminar">×</button>`
        + `</span>`
      : '';
    return `<div class="tip-line" data-idx="${idx}">${swatch}<span class="tip-text">${esc(lineaEvento(ev, Boolean(ev.clienteNombre)))}</span>${acciones}</div>`;
  }).join('');

  tip.classList.toggle('interactive', editable);
  tip.classList.remove('hidden');
  posicionarTooltipCalendario(anchor);

  if (editable && fecha != null) {
    const resolverClienteEvento = (clienteId) => (
      clienteId ? obtenerClientePorId(clienteId) : obtenerCliente()
    );

    tip.querySelectorAll('.tip-edit').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        const cl = resolverClienteEvento(btn.dataset.clienteId || '');
        if (!cl) return;
        const ev = eventosDelDia(cl.calendario, fecha)[idx];
        if (!ev) return;
        ocultarTooltipCalendario();
        abrirModalEditarEvento(fecha, ev.tipo, ev.detalle || '', {
          clienteId: cl.id,
          eventoIdx: idx
        });
      });
    });

    tip.querySelectorAll('.tip-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        const clienteId = btn.dataset.clienteId;
        if (clienteId) {
          eliminarEventoCliente(clienteId, fecha, idx);
        } else {
          const cl = obtenerCliente();
          if (!cl) return;
          eliminarEventoDia(cl, fecha, idx);
        }
        ocultarTooltipCalendario();
        toast('Evento eliminado', 2000);
      });
    });
    tip.onmouseenter = cancelarOcultarTooltip;
    tip.onmouseleave = programarOcultarTooltip;
  } else {
    tip.onmouseenter = null;
    tip.onmouseleave = null;
  }
}

function crearHostBurbuja(eventos, opts = {}) {
  const host = document.createElement('div');
  host.className = `day-bubble-host${opts.compact ? ' compact' : ''}`;
  if (opts.editable) host.classList.add('editable');
  const items = normalizarItemsEvento(eventos);
  const sorted = ordenarItemsEvento(items, Boolean(opts.global));
  const n = sorted.length;
  if (!n) return host;

  const coreSize = tamanoNucleoEventos(n, opts.compact);
  const ringStep = opts.compact ? 4 : 6;
  const total = coreSize + n * ringStep;
  host.style.width = `${total}px`;
  host.style.height = `${total}px`;

  sorted.forEach(({ ev, idx }, i) => {
    const ring = document.createElement('span');
    ring.className = 'day-bubble-ring';
    ring.dataset.eventIdx = String(idx);
    if (ev.tipo === 'vacaciones-entrenador') ring.classList.add('ring-split');
    else ring.style.setProperty('--ring-color', TIPOS_EVENTO[ev.tipo]?.color || '#999');
    const d = coreSize + (i + 1) * ringStep;
    ring.style.width = `${d}px`;
    ring.style.height = `${d}px`;
    if (opts.editable) {
      ring.classList.add('ring-editable');
      const textoEvento = opts.global && ev.clienteNombre
        ? `${ev.clienteNombre}: ${lineaEvento(ev)}`
        : lineaEvento(ev);
      ring.title = `${textoEvento} — pasa el cursor para editar o eliminar`;
    }
    host.appendChild(ring);
  });

  const core = document.createElement('span');
  core.className = 'day-bubble-core';
  core.style.width = `${coreSize}px`;
  core.style.height = `${coreSize}px`;
  host.appendChild(core);

  const tooltipOpts = {
    editable: Boolean(opts.editable),
    fecha: opts.fecha || null,
    global: Boolean(opts.global)
  };

  host.addEventListener('mouseenter', () => {
    cancelarOcultarTooltip();
    mostrarTooltipCalendario(sorted, host, tooltipOpts);
  });
  host.addEventListener('mouseleave', (e) => {
    const tip = ensureCalTooltip();
    if (tip.contains(e.relatedTarget)) return;
    programarOcultarTooltip();
  });

  if (opts.editable) {
    host.querySelectorAll('.ring-editable').forEach((ring) => {
      const idx = Number(ring.dataset.eventIdx);
      const item = sorted.find((x) => x.idx === idx);
      if (!item) return;

      ring.addEventListener('mouseenter', (e) => {
        e.stopPropagation();
        cancelarOcultarTooltip();
        host.querySelectorAll('.day-bubble-ring').forEach((r) => r.classList.remove('ring-hover'));
        ring.classList.add('ring-hover');
        mostrarTooltipCalendario([item], ring, tooltipOpts);
      });
      ring.addEventListener('mouseleave', (e) => {
        ring.classList.remove('ring-hover');
        const tip = ensureCalTooltip();
        if (tip.contains(e.relatedTarget)) return;
        programarOcultarTooltip();
      });
    });
  }

  return host;
}

function agregarEventosGlobales(clientesLista = clientes) {
  const porDia = {};
  clientesLista.forEach((c) => {
    Object.keys(c.calendario || {}).forEach((fecha) => {
      const eventos = eventosDelDia(c.calendario, fecha);
      if (!eventos.length) return;
      if (!porDia[fecha]) porDia[fecha] = [];
      eventos.forEach((ev, eventoIdx) => {
        porDia[fecha].push({
          ...ev,
          clienteId: c.id,
          clienteNombre: nombreCompleto(c),
          eventoIdx
        });
      });
    });
  });
  return porDia;
}

const LEYENDA_CALENDARIO_TIPOS = [
  'renovacion-pagada',
  'valoracion-entrenamiento',
  'renovacion-probable',
  'baja',
  'entrenamiento',
  'reserva',
  'vacaciones-cliente',
  'vacaciones-entrenador',
  'mod-pesos',
  'mod-ejercicios',
  'entrega-nutricion'
];

const LEYENDA_ETIQUETAS_CORTAS = {
  'renovacion-pagada': 'Renov. pagada',
  'valoracion-entrenamiento': 'Valoración',
  'renovacion-probable': 'Renov. probable',
  baja: 'Baja',
  entrenamiento: 'Entrenamiento',
  reserva: 'Reserva',
  'vacaciones-cliente': 'Vac. cliente',
  'vacaciones-entrenador': 'Vac. entrenador',
  'mod-pesos': 'Mod. pesos',
  'mod-ejercicios': 'Mod. ejercicios',
  'entrega-nutricion': 'Nutrición'
};

function htmlItemLeyendaCalendario(id, activo = false) {
  const meta = TIPOS_EVENTO[id];
  if (!meta) return '';
  const swatch = id === 'vacaciones-entrenador'
    ? '<span class="swatch swatch-split"></span>'
    : `<span class="swatch" style="background:${meta.color}"></span>`;
  const activeClass = activo ? ' active' : '';
  const modoClass = activo && id !== 'borrar'
    ? (modoInsercionEvento === 'rapido' ? ' modo-rapido' : ' modo-detallado')
    : '';
  const label = LEYENDA_ETIQUETAS_CORTAS[id] || meta.label;
  return `<div class="legend-item${activeClass}${modoClass}" data-tipo="${id}" role="button" tabindex="0">${swatch} ${label}</div>`;
}

function htmlLeyendaCalendarioInteractiva({ incluirTitulo = true } = {}) {
  let html = '';
  if (incluirTitulo) {
    html += '<span class="legend-title">Clic en evento → elige cliente (0,5 s) → arrastra al día · Izq.: sin detalle · Der.: con detalle</span>';
  }
  LEYENDA_CALENDARIO_TIPOS.forEach((id) => {
    html += htmlItemLeyendaCalendario(id, id === tipoActivo);
  });
  const borrarActivo = tipoActivo === 'borrar' ? ' active' : '';
  html += `<div class="legend-item legend-item-borrar${borrarActivo}" data-tipo="borrar" role="button" tabindex="0"><span class="swatch swatch-borrar"></span> Borrar día</div>`;
  return html;
}

function leyendaEventosHTML() {
  return Object.entries(TIPOS_EVENTO).map(([id, meta]) => {
    const swatch = id === 'vacaciones-entrenador'
      ? '<span class="swatch swatch-split"></span>'
      : `<span class="swatch" style="background:${meta.color}"></span>`;
    return `<span class="legend-chip">${swatch} ${meta.label}</span>`;
  }).join('');
}

function toggleEventoDia(cliente, fecha, tipo, detalle) {
  const eventos = eventosDelDia(cliente.calendario, fecha);
  const idx = eventos.findIndex((ev) => ev.tipo === tipo);
  if (idx >= 0) {
    eventos.splice(idx, 1);
    if (eventos.length) cliente.calendario[fecha] = eventos;
    else delete cliente.calendario[fecha];
  } else {
    eventos.push({ tipo, detalle: detalle || '' });
    cliente.calendario[fecha] = eventos;
  }
}

function añadirEventoDia(cliente, fecha, tipo, detalle) {
  const eventos = eventosDelDia(cliente.calendario, fecha);
  eventos.push({ tipo, detalle: detalle || '' });
  cliente.calendario[fecha] = eventos;
}

function obtenerClientePorId(id) {
  const propio = clientes.find((c) => c.id === id);
  if (propio) return propio;
  if (vistaActual === 'equipo' && equipoPaso === 'miembro' && miembroEquipoActivo) {
    return clientesVistaMiembro().find((c) => c.id === id) || null;
  }
  if (origenDetalleEquipo) {
    return clientesEquipo.find((c) => c.id === id) || null;
  }
  return null;
}

function eliminarEventoCliente(clienteId, fecha, index) {
  const cl = obtenerClientePorId(clienteId);
  if (!cl) return;
  eliminarEventoDia(cl, fecha, index);
}

function eliminarEventoDia(cliente, fecha, index) {
  const eventos = eventosDelDia(cliente.calendario, fecha);
  if (index < 0 || index >= eventos.length) return;
  eventos.splice(index, 1);
  if (eventos.length) cliente.calendario[fecha] = eventos;
  else delete cliente.calendario[fecha];
  sincronizarClienteEquipo(cliente);
  debounceGuardar(cliente.id);
  if (cliente.id === clienteActivo) renderCalendario(cliente);
  refrescarVistaGeneral();
}

function editarEventoDia(cliente, fecha, index, detalle) {
  const eventos = eventosDelDia(cliente.calendario, fecha);
  if (index < 0 || index >= eventos.length) return;
  eventos[index] = { ...eventos[index], detalle: detalle || '' };
  cliente.calendario[fecha] = eventos;
  sincronizarClienteEquipo(cliente);
  debounceGuardar(cliente.id);
  if (cliente.id === clienteActivo) renderCalendario(cliente);
  refrescarVistaGeneral();
}

function editarEventoCliente(clienteId, fecha, index, detalle) {
  const cl = obtenerClientePorId(clienteId);
  if (!cl) return;
  editarEventoDia(cl, fecha, index, detalle);
}

function obtenerEventosGlobalesDia(fecha) {
  return agregarEventosGlobales()[fecha] || [];
}

let contextMenuEventoActivo = null;

function menuContextoEventoAbierto() {
  const menu = $('#evento-context-menu');
  return Boolean(menu && !menu.classList.contains('hidden'));
}

function cerrarMenuContextoEvento() {
  const menu = $('#evento-context-menu');
  if (menu) menu.classList.add('hidden');
  contextMenuEventoActivo = null;
}

function crearFilaMenuContextoEvento({ ev, idx, fecha, clienteId = null, incluirCliente = false }) {
  const meta = TIPOS_EVENTO[ev.tipo];
  const row = document.createElement('div');
  row.className = 'context-menu-row';

  const split = ev.tipo === 'vacaciones-entrenador';
  const swatch = document.createElement('span');
  swatch.className = 'context-menu-swatch' + (split ? ' context-menu-swatch-split' : '');
  if (!split) swatch.style.background = meta?.color || '#999';

  const label = document.createElement('span');
  label.className = 'context-menu-label';
  label.textContent = lineaEvento(ev, incluirCliente);

  const acciones = document.createElement('span');
  acciones.className = 'context-menu-actions';

  const btnEdit = document.createElement('button');
  btnEdit.type = 'button';
  btnEdit.className = 'context-menu-edit';
  btnEdit.title = 'Editar evento';
  btnEdit.setAttribute('aria-label', 'Editar evento');
  btnEdit.textContent = '✎';
  btnEdit.addEventListener('click', (evClick) => {
    evClick.stopPropagation();
    const cl = clienteId ? obtenerClientePorId(clienteId) : obtenerCliente();
    if (!cl) return;
    cerrarMenuContextoEvento();
    abrirModalEditarEvento(fecha, ev.tipo, ev.detalle || '', { clienteId: cl.id, eventoIdx: idx });
  });

  const btnDelete = document.createElement('button');
  btnDelete.type = 'button';
  btnDelete.className = 'context-menu-delete';
  btnDelete.title = 'Eliminar evento';
  btnDelete.setAttribute('aria-label', 'Eliminar evento');
  btnDelete.textContent = '×';
  btnDelete.addEventListener('click', (evClick) => {
    evClick.stopPropagation();
    if (clienteId) eliminarEventoCliente(clienteId, fecha, idx);
    else {
      const cl = obtenerCliente();
      if (cl) eliminarEventoDia(cl, fecha, idx);
    }
    refrescarMenuContextoEvento();
    toast('Evento eliminado', 2000);
  });

  acciones.appendChild(btnEdit);
  acciones.appendChild(btnDelete);
  row.appendChild(swatch);
  row.appendChild(label);
  row.appendChild(acciones);
  return row;
}

function refrescarMenuContextoEvento() {
  if (!contextMenuEventoActivo) return;
  const { fecha, global } = contextMenuEventoActivo;
  if (global) renderContenidoMenuContextoGlobal(fecha);
  else renderContenidoMenuContextoEvento(fecha);
}

function renderContenidoMenuContextoEvento(fecha) {
  const cl = obtenerCliente();
  const menu = $('#evento-context-menu');
  const list = $('#evento-context-menu-list');
  if (!cl || !menu || !list) return false;

  const rawEventos = eventosDelDia(cl.calendario, fecha);
  list.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'context-menu-header';
  header.textContent = fechaLegible(fecha);
  list.appendChild(header);

  if (!rawEventos.length) {
    const empty = document.createElement('div');
    empty.className = 'context-menu-empty';
    empty.textContent = 'Sin eventos en este día';
    list.appendChild(empty);
    return true;
  }

  const items = rawEventos.map((ev, idx) => ({ ev, idx }));
  ordenarItemsEvento(items).forEach(({ ev, idx }) => {
    list.appendChild(crearFilaMenuContextoEvento({ ev, idx, fecha }));
  });

  return true;
}

function renderContenidoMenuContextoGlobal(fecha) {
  const menu = $('#evento-context-menu');
  const list = $('#evento-context-menu-list');
  if (!menu || !list) return false;

  const lista = contextMenuEventoActivo?.clientesLista || clientes;
  const rawEventos = agregarEventosGlobales(lista)[fecha] || [];
  list.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'context-menu-header';
  header.textContent = fechaLegible(fecha);
  list.appendChild(header);

  if (!rawEventos.length) {
    const empty = document.createElement('div');
    empty.className = 'context-menu-empty';
    empty.textContent = 'Sin eventos en este día';
    list.appendChild(empty);
    return true;
  }

  const items = rawEventos.map((ev) => ({
    ev,
    idx: ev.eventoIdx,
    clienteId: ev.clienteId
  }));
  ordenarItemsEvento(items, true).forEach(({ ev, idx, clienteId }) => {
    list.appendChild(crearFilaMenuContextoEvento({
      ev,
      idx,
      fecha,
      clienteId,
      incluirCliente: true
    }));
  });

  return true;
}

function abrirMenuContextoEvento(e, fecha, { global = false, clientesLista = null } = {}) {
  const lista = clientesLista || clientes;
  const rawEventos = global
    ? (agregarEventosGlobales(lista)[fecha] || [])
    : eventosDelDia(obtenerCliente()?.calendario, fecha);
  if (!rawEventos.length) return;
  if (!global && !obtenerCliente()) return;

  e.preventDefault();
  e.stopPropagation();

  const menu = $('#evento-context-menu');
  if (!menu) return;

  contextMenuEventoActivo = { fecha, global, clientesLista: global ? lista : null };
  if (global) renderContenidoMenuContextoGlobal(fecha);
  else renderContenidoMenuContextoEvento(fecha);

  menu.classList.remove('hidden');
  menu.style.left = `${Math.min(e.clientX, window.innerWidth - 300)}px`;
  menu.style.top = `${Math.min(e.clientY, window.innerHeight - 280)}px`;
}

function enlazarCeldaCalendarioGlobal(cell, fecha, opts = {}) {
  cell.dataset.fecha = fecha;
  const clientesLista = opts.clientesLista || null;

  cell.addEventListener('click', () => {
    if (arrastreEventoActivo?.moved) return;
    if (tipoActivo === 'borrar') {
      borrarDiaCalendario(fecha, { global: true });
      return;
    }
    insertarEventoEnCalendario(fecha, tipoActivo, { global: true });
  });

  cell.addEventListener('contextmenu', (e) => {
    const eventos = clientesLista
      ? (agregarEventosGlobales(clientesLista)[fecha] || [])
      : obtenerEventosGlobalesDia(fecha);
    if (!eventos.length) return;
    abrirMenuContextoEvento(e, fecha, { global: true, clientesLista });
  });
}

function asegurarLeyendaGlobal() {
  asegurarLeyendaGlobalEn('#global-calendar-legend', { editable: true, legendKey: 'principal' });
}

const EVENTO_MODAL_AYUDA = {
  'renovacion-pagada': { label: 'Importe pagado (€)', placeholder: 'Ej. 120', hint: 'Importe ya cobrado por renovación.' },
  'renovacion-probable': { label: 'Importe previsto (€)', placeholder: 'Ej. 120', hint: 'Importe esperado de renovación.' },
  entrenamiento: { label: 'Duración / notas', placeholder: 'Ej. 45 minutos', hint: 'Duración de la sesión u observaciones.' },
  'valoracion-entrenamiento': { label: 'Notas de valoración', placeholder: 'Ej. Revisión técnica', hint: 'Detalle de la valoración.' },
  reserva: { label: 'Detalle de reserva', placeholder: 'Ej. Reserva mañana', hint: '' },
  baja: { label: 'Motivo / notas', placeholder: 'Ej. Baja temporal', hint: '' },
  'vacaciones-cliente': { label: 'Notas', placeholder: 'Ej. Vacaciones agosto', hint: '' },
  'vacaciones-entrenador': { label: 'Notas', placeholder: 'Ej. Ausencia entrenador', hint: '' },
  'mod-pesos': { label: 'Detalle', placeholder: 'Ej. Actualización PDF pesos', hint: '' },
  'mod-ejercicios': { label: 'Detalle', placeholder: 'Ej. Cambio rutina', hint: '' },
  'entrega-nutricion': { label: 'Detalle', placeholder: 'Ej. Entrega plan nutrición', hint: '' }
};

let eventoModalPendiente = null;

function fechaLegible(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return `${d} de ${MESES_FULL[m - 1]} de ${y}`;
}

function detalleSugeridoEvento(tipo, cliente) {
  const bono = normalizarBono(cliente?.bono);
  if (tipo === 'entrenamiento' && bono.duracionMinutos) {
    return `${bono.duracionMinutos} minutos`;
  }
  if ((tipo === 'renovacion-pagada' || tipo === 'renovacion-probable') && bono.coste) {
    return String(bono.coste);
  }
  return '';
}

function cerrarModalEvento() {
  const modal = $('#evento-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('evento-modal-editar');
  }
  eventoModalPendiente = null;
}

function rellenarModalEvento({ fecha, tipo, cl, detalleValor, tituloTexto, guardarTexto, modo }) {
  const meta = TIPOS_EVENTO[tipo];
  const ayuda = EVENTO_MODAL_AYUDA[tipo] || { label: 'Detalle', placeholder: 'Información del evento', hint: '' };

  const modal = $('#evento-modal');
  const titulo = $('#evento-modal-title');
  const fechaEl = $('#evento-modal-fecha');
  const label = $('#evento-modal-label');
  const hint = $('#evento-modal-hint');
  const detalle = $('#evento-modal-detalle');
  const btnGuardar = $('#evento-modal-guardar');

  if (titulo) titulo.textContent = tituloTexto || meta?.label || 'Evento';
  if (fechaEl) fechaEl.textContent = fechaLegible(fecha);
  if (label) label.textContent = ayuda.label;
  if (hint) {
    hint.textContent = ayuda.hint || '';
    hint.classList.toggle('hidden', !ayuda.hint);
  }
  if (detalle) {
    detalle.placeholder = ayuda.placeholder;
    detalle.value = detalleValor ?? '';
  }
  if (btnGuardar) btnGuardar.textContent = guardarTexto || 'Añadir evento';
  modal?.classList.toggle('evento-modal-editar', modo === 'editar');
  modal?.classList.remove('hidden');
  detalle?.focus();
  detalle?.select?.();
}

function abrirModalEvento(fecha, tipo, cliente = null) {
  const cl = cliente || obtenerCliente();
  if (!cl || !tipo || tipo === 'borrar') return;

  eventoModalPendiente = { fecha, tipo, clienteId: cl.id, modo: 'crear' };
  const meta = TIPOS_EVENTO[tipo];
  rellenarModalEvento({
    fecha,
    tipo,
    cl,
    detalleValor: detalleSugeridoEvento(tipo, cl),
    tituloTexto: meta?.label || 'Nuevo evento',
    guardarTexto: 'Añadir evento',
    modo: 'crear'
  });
}

function abrirModalEditarEvento(fecha, tipo, detalleActual, opts = {}) {
  const { clienteId = null, eventoIdx } = opts;
  const cl = clienteId ? obtenerClientePorId(clienteId) : obtenerCliente();
  if (!cl || !tipo || eventoIdx == null) return;

  eventoModalPendiente = { fecha, tipo, clienteId: cl.id, eventoIdx, modo: 'editar' };
  const meta = TIPOS_EVENTO[tipo];
  rellenarModalEvento({
    fecha,
    tipo,
    cl,
    detalleValor: detalleActual,
    tituloTexto: `Editar: ${meta?.label || tipo}`,
    guardarTexto: 'Guardar cambios',
    modo: 'editar'
  });
}

function confirmarModalEvento() {
  if (!eventoModalPendiente) return;
  const cl = eventoModalPendiente.clienteId
    ? obtenerClientePorId(eventoModalPendiente.clienteId)
    : obtenerCliente();
  if (!cl) return;

  const { fecha, tipo, modo, eventoIdx } = eventoModalPendiente;
  const detalle = $('#evento-modal-detalle')?.value?.trim() || '';

  if (modo === 'editar') {
    editarEventoDia(cl, fecha, eventoIdx, detalle);
    toast('Evento actualizado', 2000);
  } else {
    añadirEventoDia(cl, fecha, tipo, detalle);
    toast('Evento añadido', 2000);
  }

  sincronizarClienteEquipo(cl);
  debounceGuardar(cl.id);
  cerrarModalEvento();
  if (cl.id === clienteActivo) renderCalendario(cl);
  refrescarVistaGeneral();
}

function modoDesdeClicLegend(e, item) {
  const rect = item.getBoundingClientRect();
  const x = e.clientX - rect.left;
  return x < rect.width / 2 ? 'rapido' : 'detallado';
}

function insertarEventoEnCalendario(fecha, tipo, opts = {}) {
  const { global = false, modo = modoInsercionEvento, clienteId = null } = opts;
  if (!tipo || tipo === 'borrar') return;

  const cl = clienteId ? obtenerClientePorId(clienteId) : obtenerCliente();
  if (!cl) {
    toast('Asigna un cliente manteniendo el evento sobre su nombre', 3500);
    return;
  }

  if (modo === 'rapido') {
    añadirEventoDia(cl, fecha, tipo, '');
    sincronizarClienteEquipo(cl);
    debounceGuardar(cl.id);
    if (cl.id === clienteActivo) renderCalendario(cl);
    refrescarVistaGeneral();
    toast('Evento añadido', 2000);
    return;
  }

  abrirModalEvento(fecha, tipo, cl);
}

function borrarDiaCalendario(fecha, opts = { global: false }) {
  const cl = obtenerCliente();
  if (!cl) {
    if (opts.global) toast('Selecciona un cliente en la lista para borrar eventos', 3500);
    return;
  }
  delete cl.calendario[fecha];
  sincronizarClienteEquipo(cl);
  debounceGuardar(cl.id);
  if (cl.id === clienteActivo) renderCalendario(cl);
  refrescarVistaGeneral();
}

let arrastreEventoActivo = null;

function mitadLegendDesdeClic(e, item) {
  return modoDesdeClicLegend(e, item) === 'rapido' ? 'izquierda' : 'derecha';
}

function clientesParaPicker() {
  if (vistaActual === 'equipo' && equipoPaso === 'miembro' && miembroEquipoActivo && esMiembroEquipoPropio()) {
    return clientesVistaMiembro();
  }
  return clientes;
}

function renderPickerClientesLista() {
  const list = $('#evento-picker-list');
  if (!list) return;
  list.innerHTML = '';

  const filtrados = [...clientesParaPicker()].sort(
    (a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es')
  );

  if (!filtrados.length) {
    const li = document.createElement('li');
    li.className = 'evento-picker-empty';
    li.textContent = 'No hay clientes';
    list.appendChild(li);
    return;
  }

  filtrados.forEach((c) => {
    const li = document.createElement('li');
    li.className = 'evento-picker-cliente';
    li.dataset.clienteId = c.id;
    li.innerHTML = `<span class="evento-picker-nombre">${esc(nombreCompleto(c))}</span>`;
    list.appendChild(li);
  });
}

function posicionarPickerClientes(x, y, mitadLegend) {
  const picker = $('#evento-cliente-picker');
  if (!picker) return;

  const w = picker.offsetWidth || 240;
  const h = picker.offsetHeight || 200;
  let left = mitadLegend === 'izquierda' ? x + 14 : x - w - 14;
  let top = y - 16;

  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - h - 8));

  picker.style.left = `${left}px`;
  picker.style.top = `${top}px`;
}

function abrirPickerClientesEvento(x, y, mitadLegend) {
  const picker = $('#evento-cliente-picker');
  if (!picker) return;
  renderPickerClientesLista();
  picker.classList.remove('hidden');
  posicionarPickerClientes(x, y, mitadLegend);
}

function cerrarPickerClientes() {
  const picker = $('#evento-cliente-picker');
  if (picker) picker.classList.add('hidden');
  $$('.evento-picker-cliente').forEach((row) => {
    row.classList.remove('asignando', 'asignado');
  });
}

function limpiarHoverPickerClientes() {
  if (!arrastreEventoActivo) return;
  if (arrastreEventoActivo.pickerHoverTimer) {
    clearTimeout(arrastreEventoActivo.pickerHoverTimer);
    arrastreEventoActivo.pickerHoverTimer = null;
  }
  if (arrastreEventoActivo.hoverClienteRow) {
    arrastreEventoActivo.hoverClienteRow.classList.remove('asignando');
    arrastreEventoActivo.hoverClienteRow = null;
  }
  arrastreEventoActivo.hoverClienteId = null;
}

function filaPickerClienteEnPunto(x, y) {
  const picker = $('#evento-cliente-picker');
  if (!picker || picker.classList.contains('hidden')) return null;

  for (const row of picker.querySelectorAll('.evento-picker-cliente')) {
    const r = row.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      return row;
    }
  }
  return null;
}

function asignarClienteArrastre(clienteId) {
  if (!arrastreEventoActivo || arrastreEventoActivo.clienteId) return;
  const cl = obtenerClientePorId(clienteId);
  if (!cl) return;

  arrastreEventoActivo.clienteId = clienteId;
  if (arrastreEventoActivo.hoverClienteRow) {
    arrastreEventoActivo.hoverClienteRow.classList.remove('asignando');
    arrastreEventoActivo.hoverClienteRow.classList.add('asignado');
  }

  seleccionarCliente(clienteId);
  cerrarPickerClientes();
  toast(`${nombreCompleto(cl)} asignado — arrastra al día`, 2200);
}

function actualizarHoverPickerClientes(x, y) {
  if (!arrastreEventoActivo || arrastreEventoActivo.clienteId) return;

  const picker = $('#evento-cliente-picker');
  if (!picker || picker.classList.contains('hidden')) return;

  const row = filaPickerClienteEnPunto(x, y);

  if (row?.dataset.clienteId) {
    if (arrastreEventoActivo.hoverClienteId !== row.dataset.clienteId) {
      limpiarHoverPickerClientes();
      arrastreEventoActivo.hoverClienteId = row.dataset.clienteId;
      arrastreEventoActivo.hoverClienteRow = row;
      row.classList.add('asignando');
      arrastreEventoActivo.pickerHoverTimer = setTimeout(() => {
        asignarClienteArrastre(row.dataset.clienteId);
      }, 500);
    }
  } else {
    limpiarHoverPickerClientes();
  }
}

function limpiarDropTargets() {
  $$('.day-cell.drop-target, .global-day-cell.drop-target').forEach((c) => c.classList.remove('drop-target'));
}

function seleccionarTipoEvento(tipo, item, modo = null) {
  if (!tipo) return;
  tipoActivo = tipo;
  if (modo) modoInsercionEvento = modo;
  $$('#calendar-legend .legend-item, #global-calendar-legend .legend-item').forEach((b) => {
    b.classList.remove('active', 'modo-rapido', 'modo-detallado');
    if (b.dataset.tipo === tipo) {
      b.classList.add('active');
      if (tipo !== 'borrar') {
        b.classList.add(modoInsercionEvento === 'rapido' ? 'modo-rapido' : 'modo-detallado');
      }
    }
  });
}

function crearGhostArrastre(tipo) {
  const meta = TIPOS_EVENTO[tipo];
  const ghost = document.createElement('div');
  ghost.className = 'evento-drag-ghost';
  const split = tipo === 'vacaciones-entrenador';
  const swatch = split
    ? '<span class="ghost-swatch ghost-swatch-split"></span>'
    : `<span class="ghost-swatch" style="background:${meta?.color || '#999'}"></span>`;
  ghost.innerHTML = `${swatch}<span>${esc(meta?.label || tipo)}</span>`;
  document.body.appendChild(ghost);
  return ghost;
}

function moverGhostArrastrePos(x, y) {
  if (!arrastreEventoActivo?.ghost) return;
  arrastreEventoActivo.ghost.style.left = `${x + 12}px`;
  arrastreEventoActivo.ghost.style.top = `${y + 12}px`;
}

function celdaCalendarioEnPunto(x, y) {
  const el = document.elementFromPoint(x, y);
  return el?.closest?.('.day-cell:not(.empty), .global-day-cell:not(.empty)') || null;
}

function actualizarDestinoCalendarioArrastre(x, y) {
  limpiarDropTargets();
  if (!arrastreEventoActivo?.clienteId) {
    arrastreEventoActivo.hoverCell = null;
    return;
  }
  const cell = celdaCalendarioEnPunto(x, y);
  if (cell?.dataset.fecha) {
    cell.classList.add('drop-target');
    arrastreEventoActivo.hoverCell = cell;
  } else {
    arrastreEventoActivo.hoverCell = null;
  }
}

function finalizarArrastreEvento(e) {
  if (!arrastreEventoActivo) return;
  const { tipo, item, moved, ghost, hoverCell, clienteId, modoInsercion } = arrastreEventoActivo;
  try { item?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  ghost?.remove();
  item?.classList.remove('dragging');
  limpiarDropTargets();
  limpiarHoverPickerClientes();
  cerrarPickerClientes();

  if (moved && hoverCell?.dataset.fecha) {
    if (!clienteId) {
      toast('Mantén el evento sobre un cliente 0,5 s antes de soltarlo en el calendario', 3500);
    } else {
      const esGlobal = hoverCell.classList.contains('global-day-cell');
      insertarEventoEnCalendario(hoverCell.dataset.fecha, tipo, {
        global: esGlobal,
        modo: modoInsercion || modoInsercionEvento,
        clienteId
      });
    }
  } else if (!moved) {
    seleccionarTipoEvento(tipo, item, modoInsercion);
  }

  arrastreEventoActivo = null;
}

function iniciarArrastreEvento(e, item, tipo) {
  if (e.button !== 0 || !tipo || tipo === 'borrar') return;
  e.preventDefault();
  try { item.setPointerCapture(e.pointerId); } catch { /* ignore */ }

  const modoInsercion = modoDesdeClicLegend(e, item);
  const mitadLegend = mitadLegendDesdeClic(e, item);

  const ghost = crearGhostArrastre(tipo);
  moverGhostArrastrePos(e.clientX, e.clientY);
  item.classList.add('dragging');

  arrastreEventoActivo = {
    tipo,
    item,
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
    ghost,
    hoverCell: null,
    modoInsercion,
    mitadLegend,
    clienteId: null,
    hoverClienteId: null,
    hoverClienteRow: null,
    pickerHoverTimer: null
  };

  seleccionarTipoEvento(tipo, item, modoInsercion);
  abrirPickerClientesEvento(e.clientX, e.clientY, mitadLegend);
}

function actualizarArrastreEvento(e) {
  if (!arrastreEventoActivo) return;

  arrastreEventoActivo.lastX = e.clientX;
  arrastreEventoActivo.lastY = e.clientY;
  moverGhostArrastrePos(e.clientX, e.clientY);
  actualizarHoverPickerClientes(e.clientX, e.clientY);

  const dx = e.clientX - arrastreEventoActivo.startX;
  const dy = e.clientY - arrastreEventoActivo.startY;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
    arrastreEventoActivo.moved = true;
  }

  actualizarDestinoCalendarioArrastre(e.clientX, e.clientY);
}

function enlazarCeldaCalendario(cell, fecha) {
  cell.dataset.fecha = fecha;

  cell.addEventListener('click', () => {
    if (arrastreEventoActivo?.moved) return;
    if (tipoActivo === 'borrar') {
      borrarDiaCalendario(fecha);
      return;
    }
    insertarEventoEnCalendario(fecha, tipoActivo);
  });

  cell.addEventListener('contextmenu', (e) => {
    if (arrastreEventoActivo?.moved) return;
    const cl = obtenerCliente();
    if (!cl) return;
    if (!eventosDelDia(cl.calendario, fecha).length) return;
    abrirMenuContextoEvento(e, fecha);
  });
}

function miniCalendarioHTML(c) {
  if (!c.mesContratacion) return '<span class="cell-muted">—</span>';

  const { year, month } = parseMes(c.mesContratacion);
  let html = '<div class="mini-cal">';

  for (let m = 0; m < 3; m++) {
    const d = new Date(year, month + m, 1);
    const y = d.getFullYear();
    const mo = d.getMonth();
    const daysInMonth = new Date(y, mo + 1, 0).getDate();

    html += `<div class="mini-month"><span class="mini-month-label">${MESES[mo]}</span><div class="mini-days">`;

    for (let day = 1; day <= daysInMonth; day++) {
      const fecha = formatFecha(y, mo, day);
      const eventos = eventosDelDia(c.calendario, fecha);
      const n = eventos.length;
      const dot = n
        ? `<span class="mini-dot" style="--dot-size:${Math.min(10, 4 + n)}px" title="${esc(eventos.map((ev) => lineaEvento(ev)).join(', '))}"></span>`
        : '';
      html += `<span class="mini-day${n ? ' has-events' : ''}">${dot}</span>`;
    }

    html += '</div></div>';
  }

  html += '</div>';
  return html;
}

function asegurarLeyendaGlobalEn(legendSel, { editable = true, legendKey = 'principal' } = {}) {
  const legend = typeof legendSel === 'string' ? $(legendSel) : legendSel;
  if (!legend) return;

  const bound = legend.dataset.leyendaKey === legendKey;
  const wasEditable = legend.dataset.leyendaEditable === '1';
  const needsRebuild = !bound || wasEditable !== editable;

  legend.classList.toggle('legend-readonly', !editable);
  if (!needsRebuild) return;

  legend.classList.add('legend', 'legend-global');
  legend.innerHTML = htmlLeyendaCalendarioInteractiva({ incluirTitulo: editable });
  legend.dataset.leyendaKey = legendKey;
  legend.dataset.leyendaEditable = editable ? '1' : '0';
  if (editable) vincularLeyendaItems(legend);
}

function renderCalendarioGlobal(opts = {}) {
  const container = typeof opts.container === 'string' ? $(opts.container) : (opts.container || $('#global-calendar-container'));
  const legend = typeof opts.legend === 'string' ? $(opts.legend) : (opts.legend || $('#global-calendar-legend'));
  const title = typeof opts.title === 'string' ? $(opts.title) : (opts.title || $('#global-calendar-title'));
  if (!container) return;

  const clientesLista = opts.clientesLista || clientes;
  const mesKey = opts.mes || mesGlobalCalendario;
  const editable = opts.editable !== false;
  const legendKey = opts.legendKey || 'principal';

  asegurarLeyendaGlobalEn(legend, { editable, legendKey });

  const { year, month } = parseMes(mesKey);
  if (title) title.textContent = `${MESES_FULL[month]} ${year}`;

  const eventosPorDia = agregarEventosGlobales(clientesLista);
  container.innerHTML = '';

  const block = document.createElement('div');
  block.className = 'global-month-block';

  const weekdays = document.createElement('div');
  weekdays.className = 'global-weekdays';
  DIAS_SEMANA.forEach((dia) => {
    const span = document.createElement('span');
    span.textContent = dia;
    weekdays.appendChild(span);
  });
  block.appendChild(weekdays);

  const grid = document.createElement('div');
  grid.className = 'global-days-grid';

  const firstDay = new Date(year, month, 1);
  let startCol = firstDay.getDay();
  startCol = startCol === 0 ? 6 : startCol - 1;

  for (let i = 0; i < startCol; i++) {
    const empty = document.createElement('div');
    empty.className = 'global-day-cell empty';
    grid.appendChild(empty);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const fecha = formatFecha(year, month, day);
    const eventos = eventosPorDia[fecha] || [];

    const cell = document.createElement('div');
    cell.className = 'global-day-cell' + (eventos.length ? ' has-events' : '');

    const num = document.createElement('span');
    num.className = 'global-day-num';
    num.textContent = day;
    cell.appendChild(num);

    if (eventos.length) {
      cell.appendChild(crearHostBurbuja(eventos, { editable, fecha: editable ? fecha : null, global: true }));
    }

    if (editable) {
      enlazarCeldaCalendarioGlobal(cell, fecha, { clientesLista });
    } else {
      cell.dataset.fecha = fecha;
    }

    grid.appendChild(cell);
  }

  block.appendChild(grid);
  container.appendChild(block);
}

function cambiarMesGlobal(delta) {
  const { year, month } = parseMes(mesGlobalCalendario);
  const d = new Date(year, month + delta, 1);
  mesGlobalCalendario = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderCalendarioGlobal();
}

function statusChip(ok, labelOk = '✓', labelNo = 'Pend.') {
  return `<span class="status-chip ${ok ? 'ok' : 'pending'}">${ok ? labelOk : labelNo}</span>`;
}

function renderDashboard() {
  const tbody = $('#overview-body');
  const filtrados = filtrarClientes();

  $('#client-count').textContent = `${filtrados.length} cliente${filtrados.length !== 1 ? 's' : ''}`;
  $('#dashboard-empty').classList.toggle('hidden', filtrados.length > 0);
  $('.table-wrap').classList.toggle('hidden', filtrados.length === 0);


  renderCalendarioGlobal();
  renderPanelEquipo();
  tbody.innerHTML = '';

  filtrados.forEach((c) => {
    const ses = resumenSesiones(c);
    const ejPend = contarPendientes(c.ejercicios);
    const pePend = contarPendientes(c.pesos);
    const bonoTxt = textoBono(c.bono);

    const tr = document.createElement('tr');
    tr.dataset.clienteId = c.id;
    tr.innerHTML = `
      <td class="cell-name cliente-perfil"><strong>${esc(nombreCompleto(c))}</strong></td>
      <td class="cell-bono">${esc(bonoTxt)}</td>
      <td class="cell-cal">${miniCalendarioHTML(c)}</td>
      <td class="cell-sesiones">
        <span class="progress-pill ${ses.pendientes === 0 && ses.total > 0 ? 'ok' : ses.pendientes > 0 ? 'warn' : ''}">
          ${ses.done}/${ses.total}
        </span>
      </td>
      <td class="cell-check">${statusChip(c.confirmacionHorario)}</td>
      <td class="cell-check">${statusChip(c.pdf1.entregado)}</td>
      <td class="cell-check">${statusChip(c.pdf2.entregado)}</td>
      <td class="cell-todo">${ejPend > 0 ? `<span class="count-badge">${ejPend}</span>` : statusChip(true, '—', '0')}</td>
      <td class="cell-todo">${pePend > 0 ? `<span class="count-badge">${pePend}</span>` : statusChip(true, '—', '0')}</td>
      <td class="cell-actions">
        <button type="button" class="btn-table" data-action="edit" data-id="${c.id}">Editar</button>
      </td>
    `;

    tr.querySelector('[data-action="edit"]').addEventListener('click', () => {
      abrirDetalleCliente(c.id);
    });

    enlazarContextoCliente(tr, c.id);
    etiquetarFilasTablaMovil(tr);

    const checks = [
      { col: 4, field: 'confirmacionHorario', key: null },
      { col: 5, field: 'pdf1', key: 'entregado' },
      { col: 6, field: 'pdf2', key: 'entregado' }
    ];

    checks.forEach(({ col, field, key }) => {
      const td = tr.children[col];
      td.style.cursor = 'pointer';
      td.title = 'Clic para cambiar';
      td.addEventListener('click', () => {
        if (key) {
          const obj = { ...c[field], [key]: !c[field][key] };
          actualizarCliente({ [field]: obj }, c.id);
        } else {
          actualizarCliente({ [field]: !c[field] }, c.id);
        }
        renderDashboard();
      });
    });

    tbody.appendChild(tr);
  });
}

function renderFormulario() {
  const c = obtenerCliente();
  const form = $('#client-form');
  const empty = $('#empty-state');
  const soloLectura = Boolean(clienteLecturaEquipo);

  if (!c) {
    form.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  form.classList.remove('hidden');
  form.classList.toggle('form-readonly', soloLectura);
  $('#form-title').textContent = nombreCompleto(c) + (soloLectura ? ' (solo lectura)' : '');

  $('#btn-guardar-cliente')?.classList.toggle('hidden', soloLectura);
  $('#btn-eliminar')?.classList.toggle('hidden', soloLectura);
  $('#btn-add-sesion')?.classList.toggle('hidden', soloLectura);
  $('#btn-add-ejercicio')?.classList.toggle('hidden', soloLectura);
  $('#btn-add-peso')?.classList.toggle('hidden', soloLectura);

  const btnVolver = $('#btn-volver-dashboard');
  if (btnVolver) {
    btnVolver.textContent = origenDetalleEquipo ? '← Cartera del miembro' : '← Vista general';
  }

  $('#apellidos').value = c.apellidos;
  $('#nombre').value = c.nombre;
  const bono = normalizarBono(c.bono);
  $('#bono-modalidad').value = bono.modalidad;
  $('#bono-sesiones-semana').value = bono.sesionesSemanales;
  $('#bono-duracion').value = bono.duracionMinutos;
  $('#bono-coste').value = bono.coste;
  actualizarCamposBonoUI(bono.modalidad);
  $('#mes-contratacion').value = c.mesContratacion;
  $('#sesiones-total').value = c.sesionesTotal || '';
  $('#confirmacion-horario').checked = c.confirmacionHorario;
  $('#horario-notas').value = c.horarioNotas;
  $('#pdf1-entregado').checked = c.pdf1.entregado;
  $('#pdf1-fecha').value = c.pdf1.fecha;
  $('#pdf2-entregado').checked = c.pdf2.entregado;
  $('#pdf2-fecha').value = c.pdf2.fecha;

  renderCalendario(c, { soloLectura });
  renderTodoList('sesiones-list', c.sesiones, 'sesiones', !soloLectura);
  renderTodoList('ejercicios-list', c.ejercicios, 'ejercicios', false);
  renderTodoList('pesos-list', c.pesos, 'pesos', false);
  actualizarProgresoSesiones(c);
}

function renderTodoList(containerId, items, field, showRemove) {
  const ul = $(`#${containerId}`);
  ul.innerHTML = '';

  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (item.done ? ' done' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.done;
    cb.addEventListener('change', () => {
      const cl = obtenerCliente();
      cl[field][i].done = cb.checked;
      debounceGuardar(cl.id);
      li.classList.toggle('done', cb.checked);
      if (field === 'sesiones') actualizarProgresoSesiones(cl);
      refrescarVistaGeneral();
    });

    const input = document.createElement('input');
    input.type = 'text';
    input.value = item.text;
    input.placeholder = field === 'sesiones' ? `Sesión ${i + 1}` : 'Descripción…';
    input.addEventListener('input', () => {
      const cl = obtenerCliente();
      cl[field][i].text = input.value;
      debounceGuardar(cl.id);
      renderLista();
    });

    li.appendChild(cb);
    li.appendChild(input);

    if (showRemove) {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn-remove';
      rm.textContent = '×';
      rm.addEventListener('click', () => {
        const cl = obtenerCliente();
        cl[field].splice(i, 1);
        debounceGuardar(cl.id);
        renderFormulario();
        refrescarVistaGeneral();
      });
      li.appendChild(rm);
    }

    ul.appendChild(li);
  });
}

function actualizarProgresoSesiones(c) {
  const ses = resumenSesiones(c);
  $('#sesiones-progress').textContent = `${ses.done} / ${ses.total} completadas`;
}

function renderCalendario(c, opts = {}) {
  const container = opts.container || $('#calendar-container');
  if (!container) return;
  const soloLectura = Boolean(opts.soloLectura);
  container.innerHTML = '';
  if (!c.mesContratacion) return;

  const { year, month } = parseMes(c.mesContratacion);
  const MESES_FULL = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  for (let m = 0; m < 3; m++) {
    const d = new Date(year, month + m, 1);
    const y = d.getFullYear();
    const mo = d.getMonth();

    const block = document.createElement('div');
    block.className = 'month-block';

    const title = document.createElement('div');
    title.className = 'month-title';
    title.textContent = `${MESES_FULL[mo]} ${y}`;
    block.appendChild(title);

    const weekdays = document.createElement('div');
    weekdays.className = 'weekdays';
    DIAS_SEMANA.forEach((dia) => {
      const span = document.createElement('span');
      span.className = 'weekday';
      span.textContent = dia;
      weekdays.appendChild(span);
    });
    block.appendChild(weekdays);

    const grid = document.createElement('div');
    grid.className = 'days-grid';

    const firstDay = new Date(y, mo, 1);
    let startCol = firstDay.getDay();
    startCol = startCol === 0 ? 6 : startCol - 1;

    for (let i = 0; i < startCol; i++) {
      const empty = document.createElement(soloLectura ? 'div' : 'button');
      if (!soloLectura) {
        empty.type = 'button';
        empty.disabled = true;
      }
      empty.className = 'day-cell empty';
      grid.appendChild(empty);
    }

    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const fecha = formatFecha(y, mo, day);
      const eventos = eventosDelDia(c.calendario, fecha);

      const cell = document.createElement(soloLectura ? 'div' : 'button');
      if (!soloLectura) cell.type = 'button';
      cell.className = 'day-cell' + (eventos.length ? ' has-events' : '');

      const num = document.createElement('span');
      num.className = 'day-num';
      num.textContent = day;
      cell.appendChild(num);

      if (eventos.length) {
        cell.appendChild(crearHostBurbuja(eventos, {
          compact: true,
          editable: !soloLectura,
          fecha: soloLectura ? null : fecha
        }));
      }

      if (!soloLectura) enlazarCeldaCalendario(cell, fecha);

      grid.appendChild(cell);
    }

    block.appendChild(grid);
    container.appendChild(block);
  }
}

function añadirTodoItem(field, defaultText) {
  const c = obtenerCliente();
  if (!c) return;
  c[field].push({ text: defaultText || '', done: false });
  debounceGuardar(c.id);
  renderFormulario();
}

function vincularCampos() {
  const campos = [
    ['#apellidos', (v, c) => ({ apellidos: v })],
    ['#nombre', (v) => ({ nombre: v })],
    ['#bono-modalidad', (v, c) => {
      actualizarCamposBonoUI(v);
      const bono = normalizarBono({ ...c.bono, modalidad: v });
      if (v === 'planificacion') bono.coste = String(BONO_PLANIFICACION_COSTE);
      if (v !== 'entrenamiento-4sem') {
        bono.sesionesSemanales = '';
        bono.duracionMinutos = '';
      }
      return { bono };
    }],
    ['#bono-sesiones-semana', (v, c) => ({ bono: { ...normalizarBono(c.bono), sesionesSemanales: v } })],
    ['#bono-duracion', (v, c) => ({ bono: { ...normalizarBono(c.bono), duracionMinutos: v } })],
    ['#bono-coste', (v, c) => ({ bono: { ...normalizarBono(c.bono), coste: v } })],
    ['#mes-contratacion', (v) => ({ mesContratacion: v })],
    ['#sesiones-total', (v) => ({ sesionesTotal: Number(v) || 0 })],
    ['#confirmacion-horario', (v) => ({ confirmacionHorario: v })],
    ['#horario-notas', (v) => ({ horarioNotas: v })],
    ['#pdf1-entregado', (v, c) => ({ pdf1: { ...c.pdf1, entregado: v } })],
    ['#pdf1-fecha', (v, c) => ({ pdf1: { ...c.pdf1, fecha: v } })],
    ['#pdf2-entregado', (v, c) => ({ pdf2: { ...c.pdf2, entregado: v } })],
    ['#pdf2-fecha', (v, c) => ({ pdf2: { ...c.pdf2, fecha: v } })],
  ];

  campos.forEach(([sel, mapper]) => {
    const el = $(sel);
    if (!el) return;
    const evento = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(evento, () => {
      if (!clienteActivo) return;
      const c = obtenerCliente();
      const val = el.type === 'checkbox' ? el.checked : el.value;
      actualizarCliente(mapper(val, c));
      if (sel === '#apellidos' || sel === '#nombre') {
        $('#form-title').textContent = nombreCompleto(obtenerCliente());
      }
      if (sel === '#mes-contratacion') renderCalendario(obtenerCliente());
    });
  });
}

function vincularLeyendaItems(container) {
  const root = typeof container === 'string' ? $(container) : container;
  if (!root) return;

  root.querySelectorAll('.legend-item').forEach((item) => {
    if (item.dataset.boundDrag === '1') return;
    item.dataset.boundDrag = '1';

    const tipo = item.dataset.tipo;
    const esBorrar = tipo === 'borrar';

    if (!esBorrar) {
      item.addEventListener('pointerdown', (e) => iniciarArrastreEvento(e, item, tipo));
    }

    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        seleccionarTipoEvento(tipo, item, esBorrar ? null : 'detallado');
      }
    });

    if (esBorrar) {
      item.addEventListener('click', (e) => {
        if (arrastreEventoActivo?.moved) {
          e.preventDefault();
          return;
        }
        seleccionarTipoEvento(tipo, item);
      });
    }
  });
}

function initLeyenda() {
  if (!window.__cuzcoPointerDragBound) {
    window.__cuzcoPointerDragBound = true;
    document.addEventListener('pointermove', actualizarArrastreEvento);
    document.addEventListener('pointerup', finalizarArrastreEvento);
    document.addEventListener('pointercancel', finalizarArrastreEvento);
  }

  vincularLeyendaItems('#calendar-legend');
  asegurarLeyendaGlobal();
  seleccionarTipoEvento(tipoActivo, null, modoInsercionEvento);

  if (!window.__cuzcoContextMenuBound) {
    window.__cuzcoContextMenuBound = true;

    const menu = $('#evento-context-menu');
    menu?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const cerrarSiClicFuera = (e) => {
      const menuCliente = $('#cliente-context-menu');
      if (menuContextoEventoAbierto() && !menu?.contains(e.target)) {
        cerrarMenuContextoEvento();
      }
      if (menuContextoClienteAbierto() && !menuCliente?.contains(e.target)) {
        cerrarMenuContextoCliente();
      }
    };

    document.addEventListener('click', cerrarSiClicFuera);
    document.addEventListener('contextmenu', cerrarSiClicFuera);
  }

  initMenuContextoCliente();

  if (!window.__cuzcoEventoModalBound) {
    window.__cuzcoEventoModalBound = true;
    $('#evento-modal-backdrop')?.addEventListener('click', cerrarModalEvento);
    $('#evento-modal-cancelar')?.addEventListener('click', cerrarModalEvento);
    $('#evento-modal-guardar')?.addEventListener('click', confirmarModalEvento);
    $('#evento-modal-detalle')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmarModalEvento();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#evento-modal')?.classList.contains('hidden')) {
        cerrarModalEvento();
      }
    });
  }
}

function mostrarAuth(mostrar = true) {
  $('#auth-screen').classList.toggle('hidden', !mostrar);
  $('#app').classList.toggle('hidden', mostrar);
}

function mostrarError(id, msg) {
  const el = $(id);
  if (!el) {
    if (msg) toast(msg, 5000);
    return;
  }
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
  if (msg) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function mostrarExitoRegistro(msg) {
  const el = $('#register-success');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const err = $('#register-error');
  if (err) err.classList.add('hidden');
}

function ocultarExitoRegistro() {
  const el = $('#register-success');
  if (el) el.classList.add('hidden');
}

async function cargarPerfil(userId) {
  const { data } = await sb.from('perfiles').select('nombre').eq('id', userId).single();
  return data;
}

function actualizarPanelUsuario() {
  const nombre = perfil?.nombre || usuario?.email?.split('@')[0] || 'Usuario';
  $('#user-name').textContent = nombre;
  $('#user-email').textContent = usuario?.email || '';
  $('#user-avatar').textContent = iniciales(nombre);
}

async function entrarApp(session) {
  if (!session?.user) return;
  usuario = session.user;
  try {
    const perfilData = await cargarPerfil(usuario.id);
    perfil = perfilData || { nombre: usuario.user_metadata?.nombre || usuario.email?.split('@')[0] };
  } catch {
    perfil = { nombre: usuario.user_metadata?.nombre || usuario.email?.split('@')[0] || 'Usuario' };
  }
  actualizarPanelUsuario();
  mostrarAuth(false);
  await cargarMiembrosEquipo();
  await cargarEquipoConfig();
  await cargarClientes();
  await cargarClientesEquipo();
  setVista('dashboard');
}

async function entrarAppLocal(user) {
  usuario = { id: user.id, email: user.email };
  perfil = { nombre: user.nombre };
  localStorage.setItem(LOCAL_SESSION_KEY, user.id);
  actualizarPanelUsuario();
  mostrarAuth(false);
  await cargarMiembrosEquipo();
  await cargarEquipoConfig();
  await cargarClientes();
  await cargarClientesEquipo();
  setVista('dashboard');
}

function cerrarSesion() {
  usuario = null;
  perfil = null;
  clientes = [];
  clientesEquipo = [];
  miembrosEquipo = [];
  equipoConfig = null;
  clienteActivo = null;
  miembroEquipoActivo = null;
  equipoPaso = 'miembros';
  busquedaEquipoMiembro = '';
  origenDetalleEquipo = null;
  clienteLecturaEquipo = false;
  if (modoLocal) localStorage.removeItem(LOCAL_SESSION_KEY);
  mostrarAuth(true);
}

function cuentaLocalExistente(email) {
  const normalizado = (email || '').trim().toLowerCase();
  return getLocalUsers().some((u) => u.email === normalizado);
}

let emailRegistroCheckToken = 0;
let emailRegistroTimer = null;

function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

function mostrarAvisoEmailRegistro(mostrar) {
  const el = $('#register-email-hint');
  const input = $('#register-email');
  if (!el) return;
  el.classList.toggle('hidden', !mostrar);
  if (input) input.classList.toggle('field-email-exists', mostrar);
}

function ocultarAvisoEmailRegistro() {
  mostrarAvisoEmailRegistro(false);
}

function irALoginDesdeRegistro() {
  const email = $('#register-email')?.value?.trim();
  const tabLogin = $('#tab-login');
  if (tabLogin) tabLogin.checked = true;
  const loginEmail = $('#login-email');
  if (loginEmail && email) loginEmail.value = email;
  ocultarAvisoEmailRegistro();
  mostrarError('#register-error', '');
  loginEmail?.focus();
}

async function emailYaRegistrado(email) {
  const normalizado = email.trim().toLowerCase();
  if (!esEmailValido(normalizado)) return false;

  if (modoLocal) {
    return cuentaLocalExistente(normalizado);
  }

  const listo = await asegurarSupabase();
  if (!listo) return false;

  const { data, error } = await sb.rpc('email_registrado', { check_email: normalizado });
  if (error) {
    console.warn('No se pudo comprobar el email:', error.message);
    return false;
  }
  return Boolean(data);
}

async function comprobarEmailRegistroEnCampo() {
  const input = $('#register-email');
  if (!input) return;

  const email = input.value.trim().toLowerCase();
  ocultarAvisoEmailRegistro();

  if (!email || !esEmailValido(email)) return;

  const token = ++emailRegistroCheckToken;
  input.classList.add('field-checking');

  try {
    const existe = await emailYaRegistrado(email);
    if (token !== emailRegistroCheckToken) return;
    mostrarAvisoEmailRegistro(existe);
  } finally {
    if (token === emailRegistroCheckToken) {
      input.classList.remove('field-checking');
    }
  }
}

function programarComprobacionEmailRegistro() {
  clearTimeout(emailRegistroTimer);
  const input = $('#register-email');
  const email = input?.value?.trim() || '';

  if (!email) {
    emailRegistroCheckToken += 1;
    ocultarAvisoEmailRegistro();
    input?.classList.remove('field-checking');
    return;
  }

  if (!esEmailValido(email)) {
    ocultarAvisoEmailRegistro();
    return;
  }

  emailRegistroTimer = setTimeout(comprobarEmailRegistroEnCampo, 450);
}

function mensajeErrorLogin(error, email = '') {
  const code = (error?.code || '').toLowerCase();
  const msg = (error?.message || '').toLowerCase();

  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return 'Debes confirmar tu cuenta desde el email que te enviamos (revisa Gmail y spam).';
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login') || msg.includes('invalid credentials')) {
    if (!modoLocal && cuentaLocalExistente(email)) {
      return 'Esa cuenta se creó solo en este navegador antes de conectar Supabase. Usa «Crear cuenta» con el mismo email para registrarla en la nube.';
    }
    return 'Email o contraseña incorrectos. Si acabas de registrarte, confirma el email desde tu bandeja de entrada.';
  }
  return error?.message || 'No se pudo iniciar sesión.';
}

function ocultarPanelesAuthExtra() {
  $('#panel-forgot')?.classList.add('hidden');
  $('#panel-reset-password')?.classList.add('hidden');
  mostrarError('#forgot-error', '');
  mostrarError('#forgot-success', '');
  mostrarError('#reset-error', '');
  const forgotSuccess = $('#forgot-success');
  if (forgotSuccess) {
    forgotSuccess.textContent = '';
    forgotSuccess.classList.add('hidden');
  }
}

function restaurarFormulariosAuth() {
  ocultarPanelesAuthExtra();
  $('#form-login')?.classList.remove('hidden');
  $('#form-register')?.classList.remove('hidden');
}

function volverAlLogin() {
  restaurarFormulariosAuth();
  const tabLogin = $('#tab-login');
  if (tabLogin) tabLogin.checked = true;
}

function mostrarPanelOlvido() {
  ocultarPanelesAuthExtra();
  $('#form-login')?.classList.add('hidden');
  $('#form-register')?.classList.add('hidden');
  const panel = $('#panel-forgot');
  if (panel) panel.classList.remove('hidden');
  const emailLogin = $('#login-email')?.value?.trim();
  const forgotEmail = $('#forgot-email');
  if (forgotEmail && emailLogin) forgotEmail.value = emailLogin;
  panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function mostrarPanelNuevaPassword() {
  ocultarPanelesAuthExtra();
  $('#form-login')?.classList.add('hidden');
  $('#form-register')?.classList.add('hidden');
  $('#panel-reset-password')?.classList.remove('hidden');
  mostrarAuth(true);
}

async function manejarRecuperarPassword() {
  mostrarError('#forgot-error', '');
  const forgotSuccess = $('#forgot-success');
  if (forgotSuccess) {
    forgotSuccess.textContent = '';
    forgotSuccess.classList.add('hidden');
  }

  const email = $('#forgot-email')?.value?.trim().toLowerCase();
  if (!email) {
    mostrarError('#forgot-error', 'Introduce tu email');
    return;
  }

  if (modoLocal) {
    mostrarError('#forgot-error', 'En modo local no hay recuperación por email. Crea una cuenta nueva o conecta Supabase.');
    return;
  }

  const btn = $('#btn-forgot-enviar');
  const btnText = btn?.textContent || 'Enviar enlace';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Enviando…';
  }

  try {
    const listo = await asegurarSupabase();
    if (!listo) throw new Error('Servicio no disponible. Recarga la página.');

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: urlRedireccionEmail()
    });
    if (error) throw error;

    const msg = `Te hemos enviado un enlace a ${email}. Revisa tu bandeja de entrada y spam.`;
    if (forgotSuccess) {
      forgotSuccess.textContent = msg;
      forgotSuccess.classList.remove('hidden');
    }
    mostrarEstadoAuth(msg, 'success');
    toast(msg, 8000);
  } catch (err) {
    const msg = err.message || 'No se pudo enviar el enlace';
    mostrarError('#forgot-error', msg);
    mostrarEstadoAuth(msg, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btnText;
    }
  }
}

async function manejarNuevaPassword() {
  mostrarError('#reset-error', '');

  const password = $('#reset-password')?.value || '';
  if (password.length < 6) {
    mostrarError('#reset-error', 'La contraseña debe tener al menos 6 caracteres');
    return;
  }

  const btn = $('#btn-reset-guardar');
  const btnText = btn?.textContent || 'Guardar contraseña';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando…';
  }

  try {
    const listo = await asegurarSupabase();
    if (!listo) throw new Error('Servicio no disponible. Recarga la página.');

    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;

    const msg = 'Contraseña actualizada. Ya puedes iniciar sesión.';
    mostrarEstadoAuth(msg, 'success');
    toast(msg, 5000);
    $('#reset-password').value = '';
    volverAlLogin();
    window.history.replaceState({}, '', window.location.pathname);
  } catch (err) {
    const msg = err.message || 'No se pudo guardar la contraseña';
    mostrarError('#reset-error', msg);
    mostrarEstadoAuth(msg, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btnText;
    }
  }
}

async function manejarLogin(e) {
  if (e) e.preventDefault();
  mostrarError('#login-error', '');

  const btn = $('#btn-login-submit');
  const btnText = btn?.textContent || 'Entrar';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Entrando…';
  }

  try {
    const email = $('#login-email').value.trim().toLowerCase();
    const password = $('#login-password').value;

    if (!email || !password) {
      const msg = 'Introduce email y contraseña';
      mostrarError('#login-error', msg);
      mostrarEstadoAuth(msg, 'error');
      return;
    }

    if (modoLocal) {
      const users = getLocalUsers();
      const user = users.find((u) => u.email === email);
      if (!user) {
        mostrarError('#login-error', 'No existe una cuenta con ese email');
        mostrarEstadoAuth('No existe una cuenta con ese email', 'error');
        return;
      }
      const hash = await hashPassword(password);
      if (user.passwordHash !== hash) {
        mostrarError('#login-error', 'Email o contraseña incorrectos');
        mostrarEstadoAuth('Email o contraseña incorrectos', 'error');
        return;
      }
      await entrarAppLocal(user);
      return;
    }

    const listo = await asegurarSupabase();
    if (!listo) {
      const msg = 'Servicio no disponible. Espera un momento y recarga la página.';
      mostrarError('#login-error', msg);
      mostrarEstadoAuth(msg, 'error');
      return;
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = mensajeErrorLogin(error, email);
      mostrarError('#login-error', msg);
      mostrarEstadoAuth(msg, 'error');
      return;
    }

    if (data.session) {
      await entrarApp(data.session);
    }
  } catch (err) {
    console.error(err);
    const msg = err.message || 'Error al iniciar sesión';
    mostrarError('#login-error', msg);
    mostrarEstadoAuth(msg, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btnText;
    }
  }
}

async function manejarRegistro(e) {
  if (e) e.preventDefault();
  mostrarError('#register-error', '');
  ocultarExitoRegistro();

  const btn = $('#btn-register-submit');
  const btnText = btn?.textContent || 'Crear cuenta';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creando cuenta…';
  }

  try {
    const nombre = $('#register-nombre').value.trim();
    const email = $('#register-email').value.trim().toLowerCase();
    const password = $('#register-password').value;

    if (!nombre || !email || !password) {
      const msg = 'Completa todos los campos';
      mostrarError('#register-error', msg);
      mostrarEstadoAuth(msg, 'error');
      return;
    }

    if (password.length < 6) {
      const msg = 'La contraseña debe tener al menos 6 caracteres';
      mostrarError('#register-error', msg);
      mostrarEstadoAuth(msg, 'error');
      return;
    }

    if (await emailYaRegistrado(email)) {
      const msg = 'Ya existe una cuenta con ese email. Prueba a iniciar sesión.';
      mostrarAvisoEmailRegistro(true);
      mostrarError('#register-error', msg);
      mostrarEstadoAuth(msg, 'error');
      return;
    }

    if (modoLocal) {
      const users = getLocalUsers();
      const user = {
        id: uid(),
        nombre,
        email,
        passwordHash: await hashPassword(password)
      };
      users.push(user);
      saveLocalUsers(users);
      finalizarRegistro(email, password, nombre, () => entrarAppLocal(user));
      return;
    }

    const listo = await asegurarSupabase();
    if (!listo) {
      throw new Error('Servicio no disponible. Recarga la página.');
    }

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
        emailRedirectTo: urlRedireccionEmail()
      }
    });

    if (error) {
      mostrarError('#register-error', error.message);
      mostrarEstadoAuth(error.message, 'error');
      return;
    }

    if (data.user) {
      if (!data.user.identities?.length) {
        const msg = 'Ya existe una cuenta con ese email. Prueba a iniciar sesión.';
        mostrarAvisoEmailRegistro(true);
        mostrarError('#register-error', msg);
        mostrarEstadoAuth(msg, 'error');
        return;
      }

      if (data.session) {
        finalizarRegistro(email, password, nombre, () => entrarApp(data.session));
        return;
      }

      solicitarGuardadoNativo(email, password, nombre);
      const msg = `Cuenta creada. Te hemos enviado un email de confirmación a ${email}. Revisa tu Gmail y la carpeta de spam.`;
      mostrarEstadoAuth(msg, 'success');
      mostrarExitoRegistro(msg);
      toast(msg, 10000);

      const tabLogin = $('#tab-login');
      if (tabLogin) tabLogin.checked = true;
      const loginEmail = $('#login-email');
      if (loginEmail) loginEmail.value = email;
      $('#form-register')?.reset();
      ocultarAvisoEmailRegistro();
    }
  } catch (err) {
    console.error(err);
    const msg = err.message || 'No se pudo crear la cuenta. Inténtalo de nuevo.';
    mostrarError('#register-error', msg);
    mostrarEstadoAuth(msg, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btnText;
    }
  }
}

async function asegurarSupabase() {
  if (modoLocal || !supabaseConfigurado()) return false;
  if (sb) return true;
  await cargarSupabaseScript();
  sb = initSupabase();
  return Boolean(sb);
}

function enlazarAuthInmediato() {
  if (window.__cuzcoAuthBound) return;
  window.__cuzcoAuthBound = true;

  initTogglePassword();
  window.cuzcoLogin = manejarLogin;
  window.cuzcoRegistrar = manejarRegistro;

  const limpiarFormularioAuth = () => {
    restaurarFormulariosAuth();
    mostrarError('#login-error', '');
    mostrarError('#register-error', '');
    ocultarExitoRegistro();
    ocultarAvisoEmailRegistro();
  };

  const tabLogin = $('#tab-login');
  const tabRegister = $('#tab-register');
  if (tabLogin) tabLogin.addEventListener('change', limpiarFormularioAuth);
  if (tabRegister) tabRegister.addEventListener('change', limpiarFormularioAuth);

  $('#btn-show-forgot')?.addEventListener('click', mostrarPanelOlvido);
  $('#btn-forgot-volver')?.addEventListener('click', volverAlLogin);
  $('#btn-reset-volver')?.addEventListener('click', volverAlLogin);
  $('#btn-forgot-enviar')?.addEventListener('click', manejarRecuperarPassword);
  $('#btn-reset-guardar')?.addEventListener('click', manejarNuevaPassword);

  const registerEmail = $('#register-email');
  if (registerEmail) {
    registerEmail.addEventListener('blur', comprobarEmailRegistroEnCampo);
    registerEmail.addEventListener('input', programarComprobacionEmailRegistro);
  }
  $('#btn-register-go-login')?.addEventListener('click', irALoginDesdeRegistro);
}

function vincularAuthFormularios() {
  enlazarAuthInmediato();
}

async function probarConexionSupabase(url, key) {
  await cargarSupabaseScript();
  const urlNormalizada = normalizarUrlSupabase(url, key);

  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(urlNormalizada)) {
    throw new Error('URL incorrecta. Usa https://TU-PROYECTO.supabase.co (Settings → API), no la URL del dashboard.');
  }

  if (!window.supabase?.createClient) {
    throw new Error('Supabase no está cargado. Recarga la página e inténtalo de nuevo.');
  }

  const res = await fetch(`${urlNormalizada}/auth/v1/health`, {
    headers: { apikey: key.trim(), Authorization: `Bearer ${key.trim()}` }
  });

  if (!res.ok) throw new Error('No se pudo conectar con el proyecto. Revisa la URL y la clave anon.');
  return window.supabase.createClient(urlNormalizada, key.trim());
}

function initSetupWizard() {
  const btn = $('#btn-setup-guardar');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  const config = getConfig();
  if (config.SUPABASE_URL && esUrlSupabaseValida(config.SUPABASE_URL)) {
    $('#setup-url').value = config.SUPABASE_URL;
  }
  if (config.SUPABASE_ANON_KEY) $('#setup-key').value = config.SUPABASE_ANON_KEY;

  btn.addEventListener('click', async () => {
    const url = $('#setup-url')?.value?.trim();
    const key = $('#setup-key')?.value?.trim();
    const errEl = $('#setup-error');

    if (!url || !key) {
      if (errEl) {
        errEl.textContent = 'Introduce la URL y la clave anon public';
        errEl.classList.remove('hidden');
      }
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Conectando…';
    if (errEl) errEl.classList.add('hidden');
    toast('Conectando con Supabase…', 3000);

    try {
      const urlNormalizada = normalizarUrlSupabase(url, key);
      await probarConexionSupabase(url, key);
      guardarConfigSupabase(url, key);
      $('#setup-url').value = urlNormalizada;
      mostrarEstadoAuth('Supabase conectado correctamente. Recargando…', 'success');
      toast('Supabase conectado. Recargando…', 4000);
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      const msg = err.message || 'No se pudo conectar. Revisa la URL y la clave.';
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
      }
      mostrarEstadoAuth(msg, 'error');
      toast(msg, 6000);
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Conectar Supabase';
    }
  });
}

async function restaurarSesion() {
  if (modoLocal) {
    const setup = $('#auth-setup');
    if (setup) setup.classList.remove('hidden');
    initSetupWizard();
    try {
      const sessionId = localStorage.getItem(LOCAL_SESSION_KEY);
      if (sessionId) {
        const user = getLocalUsers().find((u) => u.id === sessionId);
        if (user) await entrarAppLocal(user);
      }
    } catch (err) {
      console.error(err);
    }
    return;
  }

  const setup = $('#auth-setup');
  if (setup) setup.classList.add('hidden');

  try {
    await cargarSupabaseScript();
    sb = initSupabase();

    const params = new URLSearchParams(window.location.search);
    if (params.get('type') === 'signup' || params.get('type') === 'email') {
      toast('Email confirmado. Ya puedes iniciar sesión.', 6000);
      const tabLogin = $('#tab-login');
      if (tabLogin) tabLogin.checked = true;
      window.history.replaceState({}, '', window.location.pathname);
    }

    const { data: { session } } = await sb.auth.getSession();
    if (session) await entrarApp(session);

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (hashParams.get('type') === 'recovery') {
      mostrarPanelNuevaPassword();
    }

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        mostrarPanelNuevaPassword();
        return;
      }
      if (event === 'SIGNED_IN' && session) {
        if ($('#panel-reset-password') && !$('#panel-reset-password').classList.contains('hidden')) {
          return;
        }
        await entrarApp(session);
      } else if (event === 'SIGNED_OUT') {
        cerrarSesion();
      }
    });
  } catch (err) {
    console.error(err);
    if (!supabaseConfigurado()) modoLocal = true;
    const setupEl = $('#auth-setup');
    if (setupEl) setupEl.classList.remove('hidden');
    initSetupWizard();
    mostrarEstadoAuth(`No se pudo conectar a Supabase: ${err.message}`, 'error');
  }
}

async function initAuth() {
  modoLocal = !supabaseConfigurado();
  const siteUrlEl = $('#setup-site-url');
  if (siteUrlEl) siteUrlEl.textContent = urlRedireccionEmail();
  vincularAuthFormularios();
  await restaurarSesion();
  const setup = $('#auth-setup');
  if (setup && !setup.classList.contains('hidden')) {
    initSetupWizard();
  }
}

function on(id, event, handler) {
  const el = $(id);
  if (el) el.addEventListener(event, handler);
}

function initBotones() {
  on('#btn-nuevo-cliente', 'click', async () => {
    const c = clienteVacio();
    clientes.unshift(c);
    clienteActivo = c.id;

    if (modoLocal) {
      guardarClientesLocal();
    } else if (sb && usuario) {
      const { id, ...data } = c;
      await sb.from('clientes').insert({ id, user_id: usuario.id, data });
    }

    renderTodo();
    setVista('detalle');
  });

  on('#btn-guardar-cliente', 'click', () => guardarClienteCompleto());

  on('#btn-eliminar', 'click', async () => {
    const c = obtenerCliente();
    if (!c) return;
    await confirmarYEliminarCliente(c.id);
  });

  on('#btn-add-sesion', 'click', () => {
    const c = obtenerCliente();
    añadirTodoItem('sesiones', `Sesión ${c.sesiones.length + 1}`);
  });

  on('#btn-add-ejercicio', 'click', () => añadirTodoItem('ejercicios', ''));
  on('#btn-add-peso', 'click', () => añadirTodoItem('pesos', ''));

  on('#btn-cal-prev', 'click', () => cambiarMesGlobal(-1));
  on('#btn-cal-next', 'click', () => cambiarMesGlobal(1));

  on('#btn-logout', 'click', async () => {
    if (modoLocal) {
      cerrarSesion();
    } else if (sb) {
      await sb.auth.signOut();
    }
  });

  on('#nav-dashboard', 'click', async () => {
    if (vistaActual === 'detalle' && clienteActivo && !clienteLecturaEquipo) {
      await guardarClienteCompleto({ silencioso: true });
    }
    origenDetalleEquipo = null;
    clienteLecturaEquipo = false;
    setVista('dashboard');
  });
  on('#nav-detalle', 'click', () => setVista('detalle'));
  on('#btn-volver-dashboard', 'click', async () => {
    if (clienteActivo && !clienteLecturaEquipo) await guardarClienteCompleto({ silencioso: true });
    if (origenDetalleEquipo) {
      const miembroId = origenDetalleEquipo.miembroId;
      miembroEquipoActivo = miembroId;
      equipoPaso = 'miembro';
      origenDetalleEquipo = null;
      clienteLecturaEquipo = false;
      setVista('equipo');
      return;
    }
    setVista('dashboard');
  });

  on('#dashboard-search', 'input', (e) => {
    busqueda = e.target.value;
    renderDashboard();
    renderLista();
  });

  on('#btn-exportar', 'click', () => {
    const blob = new Blob([JSON.stringify(clientes, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cuzco-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  on('#input-importar', 'change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error();

        if (clientes.length && !confirm('¿Importar y fusionar con tus clientes actuales?')) return;

        for (const item of data) {
          const nuevo = normalizarCliente({ ...clienteVacio(), ...item, id: uid() });
          clientes.push(nuevo);
          if (modoLocal) {
            guardarClientesLocal();
          } else if (sb && usuario) {
            const { id, ...payload } = nuevo;
            await sb.from('clientes').insert({ id, user_id: usuario.id, data: payload });
          }
        }

        if (modoLocal) guardarClientesLocal();
        renderTodo();
        toast(`${data.length} clientes importados`);
      } catch {
        toast('Archivo no válido');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

async function init() {
  try {
    await initAuth();
    vincularCampos();
    initLeyenda();
    initVistaEquipo();
    initMobileNav();
    initBotones();
  } catch (err) {
    console.error(err);
    const card = document.querySelector('.auth-card');
    if (card) {
      const msg = document.createElement('p');
      msg.className = 'auth-error';
      msg.textContent = `Error al iniciar la app: ${err.message}. Recarga la página.`;
      card.prepend(msg);
    }
    mostrarEstadoAuth(`Error: ${err.message}`, 'error');
  }
}

function arrancar() {
  enlazarAuthInmediato();
  init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar);
} else {
  arrancar();
}
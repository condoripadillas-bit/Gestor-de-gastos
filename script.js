//Premium Spend Manager - with Categories, Graph, Export and Toast

// ---------- CLASE PRINCIPAL ----------
class GestorGastos {
    constructor() {
        this.transacciones = this.cargarTransacciones();
    }

    cargarTransacciones() {
        const guardadas = localStorage.getItem('gestor_premium');
        if (guardadas) return JSON.parse(guardadas);
        return [];
    }

    guardarTransacciones() {
        localStorage.setItem('gestor_premium', JSON.stringify(this.transacciones));
    }

    agregarTransaccion(concepto, monto, tipo, categoria = 'otros') {
        if (!concepto.trim() || isNaN(monto) || monto <= 0) {
            this.mostrarToast('❌ Concepto inválido o monto debe ser > 0', 'error');
            return false;
        }
        if (tipo === 'gasto' && !categoria) categoria = 'otros';
        
        const nueva = {
            id: Date.now(),
            concepto: concepto.trim(),
            monto: parseFloat(monto),
            tipo: tipo,
            categoria: (tipo === 'gasto') ? categoria : null,
            fecha: new Date().toLocaleString()
        };
        this.transacciones.push(nueva);
        this.guardarTransacciones();
        this.mostrarToast(`✅ ${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} agregado correctamente`);
        return true;
    }

    eliminarTransaccion(id) {
        this.transacciones = this.transacciones.filter(t => t.id !== id);
        this.guardarTransacciones();
        this.mostrarToast('🗑️ Transacción eliminada');
    }

    obtenerTotales() {
        let totalIngresos = 0, totalGastos = 0;
        this.transacciones.forEach(t => {
            if (t.tipo === 'ingreso') totalIngresos += t.monto;
            else totalGastos += t.monto;
        });
        return { saldo: totalIngresos - totalGastos, totalIngresos, totalGastos };
    }

    getTransaccionesFiltradas(filtroCategoria) {
        if (filtroCategoria === 'todas') return [...this.transacciones].reverse();
        if (filtroCategoria === 'ingreso') 
            return this.transacciones.filter(t => t.tipo === 'ingreso').reverse();
        return this.transacciones.filter(t => t.tipo === 'gasto' && t.categoria === filtroCategoria).reverse();
    }

    getGastosPorCategoria() {
        const categorias = ['comida', 'transporte', 'ocio', 'salud', 'educacion', 'otros'];
        const gastosCat = {};
        categorias.forEach(cat => gastosCat[cat] = 0);
        this.transacciones.forEach(t => {
            if (t.tipo === 'gasto' && t.categoria) {
                gastosCat[t.categoria] += t.monto;
            }
        });
        return gastosCat;
    }

    mostrarToast(mensaje, tipo = 'ok') {
        const toast = document.getElementById('toast');
        toast.textContent = mensaje;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
}

// ---------- INSTANCIA GLOBAL ----------
const gestor = new GestorGastos();

// ---------- ELEMENTOS DOM ----------
const balanceEl = document.getElementById('balance');
const totalIngresosEl = document.getElementById('total-ingresos');
const totalGastosEl = document.getElementById('total-gastos');
const transactionListEl = document.getElementById('transaction-list');
const form = document.getElementById('transaction-form');
const categoriaSelect = document.getElementById('categoria');
const tipoRadios = document.querySelectorAll('input[name="tipo"]');
const filtroSelect = document.getElementById('filtro-cat');
const exportarBtn = document.getElementById('exportar-csv');

// ---------- UTILIDADES ----------
function escapeHTML(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Habilitar/deshabilitar categoría según tipo
function toggleCategoria() {
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    if (tipo === 'gasto') {
        categoriaSelect.disabled = false;
        document.getElementById('categoria-group').style.opacity = '1';
    } else {
        categoriaSelect.disabled = true;
        document.getElementById('categoria-group').style.opacity = '0.6';
    }
}
tipoRadios.forEach(radio => radio.addEventListener('change', toggleCategoria));
toggleCategoria();

// ---------- ACTUALIZAR UI (lista + totales + gráfico) ----------
let chartInstance = null;

function actualizarUI() {
    // Totales
    const { saldo, totalIngresos, totalGastos } = gestor.obtenerTotales();
    balanceEl.textContent = `$${saldo.toFixed(2)}`;
    totalIngresosEl.textContent = `$${totalIngresos.toFixed(2)}`;
    totalGastosEl.textContent = `$${totalGastos.toFixed(2)}`;

    // Filtrar transacciones
    const filtro = filtroSelect.value;
    const transacciones = gestor.getTransaccionesFiltradas(filtro);
    
    if (transacciones.length === 0) {
        transactionListEl.innerHTML = '<p class="empty-message">📭 No hay movimientos con este filtro.</p>';
    } else {
        transactionListEl.innerHTML = '';
        transacciones.forEach(trans => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `transaction-item ${trans.tipo}`;
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'transaction-info';
            let categoriaHtml = '';
            if (trans.tipo === 'gasto' && trans.categoria) {
                const nombresCat = { comida:'🍔 Comida', transporte:'🚗 Transporte', ocio:'🎬 Ocio', salud:'🏥 Salud', educacion:'📚 Educación', otros:'📦 Otros' };
                categoriaHtml = `<div class="transaction-categoria">${nombresCat[trans.categoria] || trans.categoria}</div>`;
            }
            infoDiv.innerHTML = `
                <div class="transaction-concepto">${escapeHTML(trans.concepto)}</div>
                <div class="transaction-monto">${trans.tipo === 'ingreso' ? '+' : '-'}$${trans.monto.toFixed(2)}</div>
                <div class="transaction-fecha">${trans.fecha}</div>
                ${categoriaHtml}
            `;
            
            const btnEliminar = document.createElement('button');
            btnEliminar.textContent = '✖';
            btnEliminar.className = 'btn-eliminar';
            btnEliminar.title = 'Eliminar transacción';
            btnEliminar.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('¿Eliminar este movimiento?')) {
                    gestor.eliminarTransaccion(trans.id);
                    actualizarUI();
                }
            });
            
            itemDiv.appendChild(infoDiv);
            itemDiv.appendChild(btnEliminar);
            transactionListEl.appendChild(itemDiv);
        });
    }
    
    // Actualizar gráfico de torta
    const gastosPorCategoria = gestor.getGastosPorCategoria();
    const ctx = document.getElementById('grafico-gastos').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    const categoriasNombres = {
        comida: '🍔 Comida',
        transporte: '🚗 Transporte',
        ocio: '🎬 Ocio',
        salud: '🏥 Salud',
        educacion: '📚 Educación',
        otros: '📦 Otros'
    };
    const labels = [];
    const data = [];
    for (let [cat, valor] of Object.entries(gastosPorCategoria)) {
        if (valor > 0) {
            labels.push(categoriasNombres[cat]);
            data.push(valor);
        }
    }
    if (data.length === 0) {
        labels.push('Sin gastos');
        data.push(1);
    }
    chartInstance = new Chart(ctx, {
        type: 'pie',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#f97316','#3b82f6','#8b5cf6','#10b981','#ef4444','#6b7280'] }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }
    });
}

// ---------- AGREGAR TRANSACCIÓN ----------
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const concepto = document.getElementById('concepto').value;
    const monto = parseFloat(document.getElementById('monto').value);
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    let categoria = document.getElementById('categoria').value;
    if (tipo === 'ingreso') categoria = null;
    
    const exito = gestor.agregarTransaccion(concepto, monto, tipo, categoria);
    if (exito) {
        form.reset();
        document.querySelector('input[name="tipo"][value="ingreso"]').checked = true;
        toggleCategoria();
        actualizarUI();
    }
});

// ---------- FILTRAR AL CAMBIAR ----------
filtroSelect.addEventListener('change', () => actualizarUI());

// ---------- EXPORTAR A CSV ----------
function exportarCSV() {
    const todas = gestor.transacciones;
    if (todas.length === 0) {
        gestor.mostrarToast('No hay datos para exportar', 'error');
        return;
    }
    let csv = "ID,Concepto,Monto,Tipo,Categoría,Fecha\n";
    todas.forEach(t => {
        const categoriaTexto = t.categoria ? t.categoria : (t.tipo === 'ingreso' ? 'Ingreso' : '');
        csv += `"${t.id}","${escapeCSV(t.concepto)}",${t.monto},"${t.tipo}","${categoriaTexto}","${t.fecha}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'mis_transacciones.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    gestor.mostrarToast('📁 CSV exportado correctamente');
}
function escapeCSV(str) {
    return str.replace(/"/g, '""');
}
exportarBtn.addEventListener('click', exportarCSV);

// ---------- INICIALIZAR ----------
actualizarUI();
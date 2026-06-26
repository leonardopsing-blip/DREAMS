const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyWGKHVeP9RjWTu8Blo_44AOYtk-13DncwF2YSe8jJAEL2_h1BD5l8mQvUq4h1KYSao/exec';

let cart = [];
let localData = JSON.parse(localStorage.getItem('dreams_db_v10')) || [];

window.addEventListener('load', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) splash.remove();
    }, 2000);
    renderDB();
    updateDashboard();
});

function showModal(title, message, type = 'alert', confirmCallback = null) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    
    const actionsContainer = document.getElementById('modal-actions');
    actionsContainer.innerHTML = '';
    
    if (type === 'alert') {
        const btnOk = document.createElement('button');
        btnOk.className = 'modal-btn modal-btn-ok';
        btnOk.innerText = 'Entendido';
        btnOk.onclick = closeModal;
        actionsContainer.appendChild(btnOk);
    } else if (type === 'confirm') {
        const btnCancel = document.createElement('button');
        btnCancel.className = 'modal-btn modal-btn-cancel';
        btnCancel.innerText = 'Cancelar';
        btnCancel.onclick = closeModal;
        
        const btnConfirm = document.createElement('button');
        btnConfirm.className = 'modal-btn modal-btn-confirm';
        btnConfirm.innerText = 'Sí, continuar';
        btnConfirm.onclick = () => { closeModal(); if(confirmCallback) confirmCallback(); };
        
        actionsContainer.appendChild(btnCancel);
        actionsContainer.appendChild(btnConfirm);
    }
    document.getElementById('custom-modal').classList.add('active');
}

function closeModal() { 
    document.getElementById('custom-modal').classList.remove('active'); 
}

function toggleDrawer() { 
    document.getElementById('mobile-drawer').classList.toggle('open'); 
    document.getElementById('mobile-overlay').classList.toggle('open'); 
}

function navigateToMobile(segmentId) {
    document.querySelectorAll('#sec-dashboard, #sec-ventas, #sec-gastos, #sec-historial').forEach(sec => sec.classList.remove('mobile-active'));
    document.getElementById('sec-' + segmentId).classList.add('mobile-active');
    document.querySelectorAll('.drawer-item').forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    if (segmentId === 'ventas' || segmentId === 'gastos') {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('sec-ventas').style.display = (segmentId === 'ventas') ? 'block' : 'none';
        document.getElementById('sec-gastos').style.display = (segmentId === 'gastos') ? 'block' : 'none';
        const pcBtn = document.querySelector(`.tab-btn[onclick*="${segmentId}"]`);
        if(pcBtn) pcBtn.classList.add('active');
    }
    toggleDrawer();
}

function switchTabPC(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-ventas').style.display = 'none';
    document.getElementById('sec-gastos').style.display = 'none';
    event.target.classList.add('active');
    document.getElementById('sec-' + tabId).style.display = 'block';
}

function addCartItem() {
    const name = document.getElementById('v-prod').value.trim();
    const price = parseFloat(document.getElementById('v-precio').value);
    const qty = parseInt(document.getElementById('v-cant').value);
    
    if (!name || isNaN(price) || isNaN(qty)) { 
        showModal("Información Incompleta", "Ingresa nombre, precio y cantidad.", "alert"); 
        return; 
    }
    
    cart.push({ name, price, qty, subtotal: price * qty });
    renderCart();
    document.getElementById('v-prod').value = ''; 
    document.getElementById('v-precio').value = '';
}

function renderCart() {
    let total = 0;
    document.getElementById('cart-body').innerHTML = cart.map((item, i) => {
        total += item.subtotal;
        return `<tr><td>${item.name}</td><td>$${item.price.toFixed(2)}</td><td>${item.qty}</td><td>$${item.subtotal.toFixed(2)}</td><td><button style="color:var(--danger); font-size:1.1rem; border:none; background:none; cursor:pointer;" onclick="removeCartItem(${i})">✖</button></td></tr>`;
    }).join('');
    document.getElementById('v-total-text').innerText = `$${total.toFixed(2)}`;
}

function removeCartItem(index) { 
    cart.splice(index, 1); 
    renderCart(); 
}

function processSale() {
    const cliente = document.getElementById('v-cliente').value.trim();
    if (!cliente || cart.length === 0) { 
        showModal("Faltan Datos", "Ingresa el cliente y productos.", "alert"); 
        return; 
    }
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const folio = "ING-" + Date.now().toString().slice(-6);
    
    const record = { 
        id: folio, 
        fecha: new Date().toLocaleString('es-EC'), 
        cliente: cliente, 
        tipoTransaccion: "Ingreso", 
        condicion: document.getElementById('v-pago').value, 
        producto: cart.map(i => `${i.qty}x ${i.name}`).join(', '), 
        cartItems: [...cart], 
        totalVenta: total, 
        totalEgreso: 0 
    };
    
    sendToSheets(record); 
    cart = []; 
    renderCart(); 
    document.getElementById('v-cliente').value = ''; 
    printDocument(record);
}

function processExpense() {
    const cliente = document.getElementById('g-cliente').value.trim();
    const producto = document.getElementById('g-producto').value.trim();
    const monto = parseFloat(document.getElementById('g-monto').value);
    
    if (!cliente || !producto || isNaN(monto)) { 
        showModal("Faltan Datos", "Completa proveedor, detalle y monto.", "alert"); 
        return; 
    }
    
    const folio = "EGR-" + Date.now().toString().slice(-6);
    const record = { 
        id: folio, 
        fecha: new Date().toLocaleString('es-EC'), 
        cliente: cliente, 
        tipoTransaccion: "Egreso", 
        condicion: document.getElementById('g-motivo').value, 
        producto: producto, 
        cartItems: null, 
        totalVenta: 0, 
        totalEgreso: monto 
    };
    
    sendToSheets(record); 
    document.getElementById('g-cliente').value = ''; 
    document.getElementById('g-producto').value = ''; 
    document.getElementById('g-monto').value = ''; 
    printDocument(record);
}

function sendToSheets(record) {
    localData.push(record); 
    localStorage.setItem('dreams_db_v10', JSON.stringify(localData)); 
    renderDB(); 
    updateDashboard();
    fetch(WEBHOOK_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify(record) 
    }).catch(e => console.error("Error:", e));
}

function printDocument(record) {
    document.body.className = '';
    if (record.tipoTransaccion === 'Ingreso') {
        document.body.classList.add('print-sale');
        document.getElementById('p-s-folio').innerText = record.id;
        document.getElementById('p-s-date').innerText = record.fecha;
        document.getElementById('p-s-client').innerText = record.cliente;
        document.getElementById('p-s-type').innerText = record.condicion;
        document.getElementById('p-s-total').innerText = `$${record.totalVenta.toFixed(2)}`;
        if(record.cartItems) {
            document.getElementById('p-s-items').innerHTML = record.cartItems.map(i => `<tr><td>${i.qty}</td><td>${i.name}</td><td class="print-right">$${i.subtotal.toFixed(2)}</td></tr>`).join('');
        } else {
            document.getElementById('p-s-items').innerHTML = `<tr><td>1</td><td>${record.producto}</td><td class="print-right">$${record.totalVenta.toFixed(2)}</td></tr>`;
        }
    } else {
        document.body.classList.add('print-expense');
        document.getElementById('p-e-folio').innerText = record.id;
        document.getElementById('p-e-date').innerText = record.fecha;
        document.getElementById('p-e-client').innerText = record.cliente;
        document.getElementById('p-e-type').innerText = record.condicion;
        document.getElementById('p-e-desc').innerText = record.producto;
        document.getElementById('p-e-total').innerText = `$${record.totalEgreso.toFixed(2)}`;
    }
    window.print();
    setTimeout(() => { document.body.className = ''; }, 500);
}

function triggerReprint(folioID) { 
    const record = localData.find(r => r.id === folioID); 
    if(record) printDocument(record); 
}

function deleteRecord(folioID) { 
    showModal("Eliminar Registro", "¿Seguro que quieres eliminar este registro visualmente?", "confirm", () => { 
        localData = localData.filter(r => r.id !== folioID); 
        localStorage.setItem('dreams_db_v10', JSON.stringify(localData)); 
        renderDB(); 
        updateDashboard(); 
    }); 
}

function clearAllHistory() { 
    showModal("Borrar Historial", "¿Limpiar la tabla visual local?", "confirm", () => { 
        localData = []; 
        localStorage.removeItem('dreams_db_v10'); 
        renderDB(); 
        updateDashboard(); 
    }); 
}

function renderDB() {
    const tbody = document.getElementById('db-body'); 
    tbody.innerHTML = '';
    localData.slice().reverse().forEach(rec => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="font-size:0.8rem; color:#64748b;">${rec.id}</td><td>${rec.fecha.split(',')[0]}</td><td>${rec.cliente}</td><td><span style="background: ${rec.tipoTransaccion === 'Ingreso' ? '#d1fae5' : '#fee2e2'}; color: ${rec.tipoTransaccion === 'Ingreso' ? '#065f46' : '#991b1b'}; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">${rec.tipoTransaccion}</span></td><td style="color:var(--success); font-weight:bold;">${rec.totalVenta > 0 ? '$'+rec.totalVenta.toFixed(2) : '-'}</td><td style="color:var(--danger); font-weight:bold;">${rec.totalEgreso > 0 ? '$'+rec.totalEgreso.toFixed(2) : '-'}</td><td style="display:flex; gap:5px; flex-wrap: wrap;"><button class="btn-action btn-reprint" onclick="triggerReprint('${rec.id}')">🖨️</button><button class="btn-action btn-delete" onclick="deleteRecord('${rec.id}')">🗑️</button></td>`;
        tbody.appendChild(tr);
    });
}

function updateDashboard() {
    let sumIn = 0; let sumOut = 0; 
    localData.forEach(r => { sumIn += r.totalVenta; sumOut += r.totalEgreso; });
    document.getElementById('dash-ingresos').innerText = `$${sumIn.toFixed(2)}`;
    document.getElementById('dash-egresos').innerText = `$${sumOut.toFixed(2)}`;
    document.getElementById('dash-utilidad').innerText = `$${(sumIn - sumOut).toFixed(2)}`;
}
// ==================== گلوبل ویری ایبلز (کلاؤڈ سرور ورژن) ====================
let currentUser = null;
let scanner = null;
let editingId = null;

// کلاؤڈ ڈیٹا کے لیے لوکل اریے (Arrays)
let products = [];
let sales = [];
let activities = [];

// فائر بیس ویب کلاؤڈ ایپ کنفیگریشن
const firebaseConfig = {
    apiKey: "AIzaSyAsbS-6T2fQW1XF3_PxlY7R80fH3rRE9io",
    authDomain: "mobile-inventory-b8c1f.firebaseapp.com",
    projectId: "mobile-inventory-b8c1f",
    storageBucket: "mobile-inventory-b8c1f.appspot.com",
    messagingSenderId: "685100228769",
    appId: "1:685100228769:web:9d1244b2ffb153de3d10e0",
    measurementId: "G-E643SC87CW"
};

// فائر بیس کو شروع کرنا (اگر پہلے سے شروع نہ ہو)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ==================== پیج لوڈ ایونٹ اور سیشن بحالی ====================
document.addEventListener("DOMContentLoaded", function() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        loadUserData();
        showMainApp();
        if (typeof showNotification === 'function') {
            showNotification('✅ سیشن خود بخود بحال ہو گیا!');
        }
    }

    // پروڈکٹ دستی اندراج کے انٹر کی (Enter Key) ہینڈلرز
    document.getElementById('manualBarcode')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('manualName')?.focus();
        }
    });

    document.getElementById('manualName')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const costPriceInput = document.getElementById('costPrice');
            if (costPriceInput && currentUser && (currentUser.role === 'owner' || currentUser.role === 'account_owner')) {
                costPriceInput.focus();
            } else {
                const staffPrice = document.getElementById('staffSalePrice');
                if (staffPrice) staffPrice.focus();
                else document.getElementById('salePrice')?.focus();
            }
        }
    });

    // سیلز فارم کے لیے انٹر کی (Enter Key) ہینڈلرز
    document.getElementById('saleBarcode')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            findProductForSale();
            setTimeout(() => document.getElementById('saleQuantity')?.focus(), 200);
        }
    });

    document.getElementById('saleQuantity')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            makeSale();
        }
    });
});

// لائیو اتھینٹیکیشن کی تبدیلیوں کو مانیٹر کرنا
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        currentUser = {
            id: user.uid,
            uid: user.uid,
            email: user.email,
            fullName: user.displayName || "اسٹور مالک",
            username: user.email ? user.email.toLowerCase() : "owner",
            photoURL: user.photoURL,
            role: 'account_owner'
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        console.log("👋 صارف کامیابی سے کلاؤڈ پر تصدیق شدہ ہو گیا");
        
        hideAuthScreens();
        updateHeaderUI();
        
        if (typeof fetchProductsFromCloud === 'function') fetchProductsFromCloud();
        if (typeof fetchSalesFromCloud === 'function') fetchSalesFromCloud();
    }
});

// ==================== نوٹیفیکیشن سسٹم ====================
function showNotification(message, type = 'success') {
    const notif = document.getElementById('notification');
    if (!notif) {
        alert(message);
        return;
    }
    notif.textContent = message;
    notif.style.background = type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#28a745';
    notif.style.color = type === 'warning' ? '#333' : 'white';
    notif.style.display = 'block';
    setTimeout(() => { notif.style.display = 'none'; }, 3000);
}

// ==================== رجسٹریشن اور لاگ ان لاجک ====================
function showOwnerRegister() {
    document.getElementById('ownerRegisterModal').style.display = 'flex';
}

function closeOwnerRegister() {
    document.getElementById('ownerRegisterModal').style.display = 'none';
    document.getElementById('ownerRegName').value = '';
    document.getElementById('ownerRegUsername').value = '';
    document.getElementById('ownerRegPassword').value = '';
    document.getElementById('ownerRegConfirm').value = '';
}

function registerOwner() {
    const fullName = document.getElementById('ownerRegName').value.trim();
    const username = document.getElementById('ownerRegUsername').value.trim().toLowerCase();
    const password = document.getElementById('ownerRegPassword').value;
    const confirm = document.getElementById('ownerRegConfirm').value;

    if (!fullName || !username || !password) {
        showNotification('❌ تمام فیلڈز ضروری ہیں', 'error');
        return;
    }
    if (password !== confirm) {
        showNotification('❌ پاس ورڈ میچ نہیں ہو رہا', 'error');
        return;
    }
    if (password.length < 4) {
        showNotification('❌ پاس ورڈ کم از کم 4 حروف کا ہونا چاہیے', 'error');
        return;
    }

    showNotification('⏳ کلاؤڈ پر اکاؤنٹ بن رہا ہے...', 'warning');
    
    db.collection("users").doc(username).get()
        .then((doc) => {
            if (doc.exists) {
                showNotification('❌ یہ صارف نام (Username) پہلے سے موجود ہے!', 'error');
            } else {
                const newUser = {
                    id: username,
                    fullName: fullName,
                    username: username,
                    password: password,
                    role: 'account_owner',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                db.collection("users").doc(username).set(newUser)
                    .then(() => {
                        showNotification('🚀 اکاؤنٹ کامیابی سے بن گیا! اب لاگ ان کریں');
                        closeOwnerRegister();
                    })
                    .catch(() => showNotification('❌ کلاؤڈ سیونگ فیل!', 'error'));
            }
        })
        .catch(() => showNotification('❌ سرور کنکشن ایرر!', 'error'));
}

function loginWithGoogle() {
    showNotification('⏳ جی میل سے رابطہ ہو رہا ہے...', 'warning');
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            const userEmail = user.email.toLowerCase();
            const userData = {
                id: 'owner_' + user.uid,
                name: user.displayName,
                username: userEmail,
                role: 'account_owner',
                email: userEmail,
                createdAt: new Date().toISOString()
            };
            db.collection("users").doc(user.uid).set(userData, { merge: true })
                .then(() => {
                    currentUser = userData;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    loadUserData();
                    showMainApp();
                    showNotification(`🚀 خوش آمدید، ${user.displayName}!`);
                })
                .catch((err) => { console.error(err); showNotification('❌ ڈیٹا بیس ایرر!', 'error'); });
        })
        .catch((err) => { console.error(err); showNotification('❌ گوگل لاگ ان کینسل یا فیل ہو گیا!', 'error'); });
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    if (scanner) stopScanner();
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    showNotification('👋 لاگ آؤٹ ہو گیا');
}

// ==================== لائیو کلاؤڈ ڈیٹا لوڈنگ ====================
function loadUserData() {
    if (!currentUser) return;
    const targetOwnerId = (currentUser.role === 'manager' || currentUser.role === 'salesman') ? currentUser.ownerId : currentUser.id;
    
    // ۱۔ کلاؤڈ سے پروڈکٹس لوڈ کرنا
    db.collection("products").where("ownerId", "==", targetOwnerId).get()
        .then((querySnapshot) => {
            products = [];
            querySnapshot.forEach((doc) => { products.push(doc.data()); });
            if (typeof renderProducts === 'function') renderProducts();
            if (typeof updateDashboard === 'function') updateDashboard();
        });

    // ۲۔ کلاؤڈ سے سیلز ریکارڈز لوڈ کرنا
    db.collection("sales").where("ownerId", "==", targetOwnerId).get()
        .then((querySnapshot) => {
            sales = [];
            querySnapshot.forEach((doc) => { sales.push(doc.data()); });
            if (typeof renderSales === 'function') renderSales();
            if (typeof updateDashboard === 'function') updateDashboard();
        });
}

function saveUserData() {
    if (!currentUser) return;
    const targetOwnerId = (currentUser.role === 'manager' || currentUser.role === 'salesman') ? currentUser.ownerId : currentUser.id;
    const prefix = targetOwnerId + '_';
    localStorage.setItem(prefix + 'products', JSON.stringify(products));
    localStorage.setItem(prefix + 'sales', JSON.stringify(sales));
}

function addActivity(action, details) {
    if (!currentUser) return;
    const targetOwnerId = (currentUser.role === 'manager' || currentUser.role === 'salesman') ? currentUser.ownerId : currentUser.id;
    const newActivity = {
        id: Date.now(),
        ownerId: targetOwnerId,
        user: currentUser.username,
        action: action,
        details: details,
        time: new Date().toLocaleTimeString()
    };
    activities.unshift(newActivity);
    db.collection("activities").add(newActivity);
}

// ==================== UI لے آؤٹ اور ٹیبز کنٹرول ====================
function hideAuthScreens() {
    document.getElementById('loginScreen').classList.add('hidden');
}

function showMainApp() {
    document.getElementById('mainApp').classList.remove('hidden');
    const isOwner = currentUser.role === 'owner' || currentUser.role === 'account_owner';
    if (isOwner) {
        document.querySelectorAll('.owner-tab').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.owner-only-stat').forEach(el => el.classList.remove('hidden'));
    }
}

function updateHeaderUI() {
    if (!currentUser) return;
    const nameElement = document.getElementById('userName');
    const roleElement = document.getElementById('userRole');
    if (nameElement) nameElement.textContent = currentUser.fullName || currentUser.username;
    if (roleElement) {
        roleElement.textContent = currentUser.role === 'account_owner' ? '👑 اونر / مالک' : '🧑‍ staff / سیلزمین';
    }
}

function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById('tab-' + tabName).classList.add('active');
    
    if (tabName === 'products') renderProducts();
    if (tabName === 'sales') renderSales();
    if (tabName === 'dashboard') updateDashboard();
}

function updateDashboard() {
    document.getElementById('dashTotalProducts').textContent = products.length;
    document.getElementById('dashTotalItems').textContent = products.reduce((s, p) => s + (parseInt(p.quantity) || 0), 0);
    const cats = [...new Set(products.map(p => p.category))];
    document.getElementById('dashCategories').textContent = cats.length;
}

// ==================== بارکوڈ اسکینر کنٹرول ====================
function startScanner() {
    const status = document.getElementById('cameraStatus');
    status.className = 'camera-status status-success';
    status.textContent = '⏳ کیمرہ شروع ہو رہا ہے...';

    scanner = new Html5Qrcode("reader");
    scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => { handleScan(decodedText); },
        (errorMessage) => { /* اسکیننگ لاگ کو نظر انداز کریں */ }
    ).then(() => {
        status.textContent = '✅ کیمرہ کام کر رہا ہے - اب اسکین کریں!';
    }).catch(err => {
        status.className = 'camera-status status-error';
        status.textContent = '❌ کیمرہ ناکام: ' + err.message;
        scanner = null;
    });
}

function stopScanner() {
    if (scanner) {
        scanner.stop().then(() => {
            scanner = null;
            const status = document.getElementById('cameraStatus');
            status.className = 'camera-status status-info';
            status.textContent = '🔘 کیمرہ بند ہو گیا';
        });
    }
}

function handleScan(barcode) {
    const existing = products.find(p => p.barcode === barcode);
    if (existing) {
        const newQty = (parseInt(existing.quantity) || 0) + 1;
        db.collection("products").doc(barcode).update({
            quantity: newQty,
            updatedAt: new Date().toISOString()
        }).then(() => {
            showNotification(`"${existing.name}" کی مقدار کلاؤڈ پر اپڈیٹ ہو گئی: ${newQty}`);
            loadUserData();
        });
    } else {
        document.getElementById('manualBarcode').value = barcode;
        showNotification('📦 نیا بارکوڈ ملا! تفصیلات درج کریں');
    }
    stopScanner();
}

// ==================== انوینٹری مینجمنٹ (CRUD) ====================
function addProduct() {
    const barcode = document.getElementById('manualBarcode').value.trim();
    const name = document.getElementById('manualName').value.trim();
    const category = document.getElementById('manualCategory').value;
    const quantity = parseInt(document.getElementById('manualQuantity').value) || 0;
    const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
    const salePrice = parseFloat(document.getElementById('salePrice').value) || 0;

    if (!barcode || !name || quantity <= 0 || salePrice <= 0) {
        showNotification('❌ تمام معلومات صحیح طریقے سے درج کریں', 'error');
        return;
    }

    const targetOwnerId = currentUser.id;
    const newProduct = {
        barcode: barcode,
        name: name,
        category: category,
        quantity: quantity,
        costPrice: costPrice,
        salePrice: salePrice,
        ownerId: targetOwnerId,
        updatedAt: new Date().toISOString()
    };

    db.collection("products").doc(barcode).set(newProduct)
        .then(() => {
            showNotification('✅ پراڈکٹ کلاؤڈ پر محفوظ ہو گیا!');
            loadUserData();
        });
}

function renderProducts() {
    const container = document.getElementById('productsTable');
    if (!container) return;
    if (products.length === 0) {
        container.innerHTML = '<div class="empty-state">📭 کوئی پراڈکٹ نہیں</div>';
        return;
    }
    let html = `<table><thead><tr><th>بارکوڈ</th><th>نام</th><th>کیٹیگری</th><th>اسٹاک</th><th>قیمت</th></tr></thead><tbody>`;
    products.forEach(p => {
        html += `<tr><td>${p.barcode}</td><td>${p.name}</td><td>${p.category}</td><td>${p.quantity}</td><td>₹${p.salePrice}</td></tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ==================== سیلز کاؤنٹر لاگ ان ====================
function findProductForSale() {
    const barcode = document.getElementById('saleBarcode').value.trim();
    const p = products.find(x => String(x.barcode).trim() === String(barcode).trim());
    if (p) {
        document.getElementById('saleProductName').value = p.name;
        document.getElementById('saleUnitPrice').value = p.salePrice || 0;
        calculateSaleTotal();
        showNotification('✅ پراڈکٹ مل گیا');
    } else {
        showNotification('❌ پراڈکٹ نہیں ملا', 'error');
    }
}

function calculateSaleTotal() {
    const qty = parseInt(document.getElementById('saleQuantity').value) || 1;
    const price = parseFloat(document.getElementById('saleUnitPrice').value) || 0;
    document.getElementById('saleTotal').textContent = '₹' + (qty * price).toFixed(2);
}

function makeSale() {
    const barcode = document.getElementById('saleBarcode').value.trim();
    const qty = parseInt(document.getElementById('saleQuantity').value) || 1;
    const p = products.find(x => x.barcode === barcode);

    if (!p || p.quantity < qty) {
        showNotification('❌ اسٹاک ناکافی ہے یا پراڈکٹ غائب ہے', 'error');
        return;
    }

    const total = qty * parseFloat(p.salePrice);
    const newSale = {
        id: 'sale_' + Date.now(),
        barcode: barcode,
        name: p.name,
        quantity: qty,
        total: total,
        date: new Date().toISOString(),
        ownerId: currentUser.id
    };

    db.collection("sales").add(newSale).then(() => {
        db.collection("products").doc(barcode).update({
            quantity: firebase.firestore.FieldValue.increment(-qty)
        }).then(() => {
            showNotification(`💰 سیل مکمل! رقم: ₹${total.toFixed(2)}`);
            loadUserData();
        });
    });
}

function renderSales() {
    const container = document.getElementById('salesHistory');
    if (!container) return;
    if (sales.length === 0) {
        container.innerHTML = '<div class="empty-state">کوئی سیل ریکارڈ نہیں</div>';
        return;
    }
    let html = `<table><thead><tr><th>پراڈکٹ</th><th>مقدار</th><th>رقم</th></tr></thead><tbody>`;
    sales.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.quantity}</td><td>₹${s.total}</td></tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}
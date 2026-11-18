import { db, auth } from "./firebase-config.js";
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

let allTenantsData = [];
let allUsersCache = [];

// تحميل المنشآت للسوبر أدمن
window.loadTenants = async function() {
    const listEl = document.getElementById('tenants-list');
    const selectEl = document.getElementById('admin-tenant-select');
    if (!listEl || !selectEl) return;

    const snap = await getDocs(collection(db, "tenants"));
    allTenantsData = [];
    let total = 0, active = 0, trial = 0, inactive = 0;

    if (snap.empty) {
        listEl.innerHTML = '<p class="text-gray-400 py-4">لا توجد منشآت مسجلة حالياً.</p>';
        selectEl.innerHTML = '<option value="">لا توجد منشآت متاحة</option>';
        return;
    }

    let selectHtml = '<option value="">-- اختر المنشأة --</option>';

    snap.forEach((d) => {
        total++;
        const data = d.data();
        if (data.isActive) active++; else inactive++;
        if (data.isTrial) trial++;
        allTenantsData.push({ id: d.id, ...data });
        selectHtml += `<option value="${d.id}">${data.businessName || data.name} (${data.country || 'السعودية'})</option>`;
    });

    renderTenantsTable(allTenantsData);
    selectEl.innerHTML = selectHtml;
    
    if(document.getElementById('stat-total-tenants')) document.getElementById('stat-total-tenants').innerText = total;
    if(document.getElementById('stat-active-tenants')) document.getElementById('stat-active-tenants').innerText = active;
    if(document.getElementById('stat-trial-tenants')) document.getElementById('stat-trial-tenants').innerText = trial;
    if(document.getElementById('stat-inactive-tenants')) document.getElementById('stat-inactive-tenants').innerText = inactive;
};

window.filterTenants = function() {
    const searchInput = document.getElementById('search-tenants-input');
    const statusFilterEl = document.getElementById('filter-tenants-status');
    if (!searchInput || !statusFilterEl) return;

    const search = searchInput.value.toLowerCase();
    const statusFilter = statusFilterEl.value;

    const filtered = allTenantsData.filter(t => {
        const bName = t.businessName || t.name || '';
        const matchSearch = bName.toLowerCase().includes(search) || t.id.toLowerCase().includes(search) || (t.country && t.country.toLowerCase().includes(search));
        const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && t.isActive) || (statusFilter === 'inactive' && !t.isActive);
        return matchSearch && matchStatus;
    });
    renderTenantsTable(filtered);
};

function renderTenantsTable(tenants) {
    const listEl = document.getElementById('tenants-list');
    if (!listEl) return;

    if (tenants.length === 0) {
        listEl.innerHTML = '<p class="text-gray-400 py-4 text-center">لا توجد نتائج مطابقة للبحث.</p>';
        return;
    }

    let html = `<table class="w-full text-right border-collapse">
        <thead><tr class="border-b bg-gray-50 text-xs text-gray-600">
            <th class="p-3">اسم المنشأة</th><th class="p-3">المعرف والدولة</th><th class="p-3">الباقة والعملة</th><th class="p-3">الحالة</th><th class="p-3">إجراءات</th>
        </tr></thead><tbody class="divide-y divide-gray-100">`;

    tenants.forEach(data => {
        let planBadge = '<span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">دائم</span>';
        if (data.isTrial) planBadge = `<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-semibold">تجريبي</span>`;
        
        const bName = data.businessName || data.name || '--';
        html += `<tr class="hover:bg-gray-50">
            <td class="p-3 font-semibold">${bName}</td>
            <td class="p-3 text-xs"><span class="font-mono text-indigo-600">${data.id}</span><br><span class="text-gray-500">${data.country || 'المملكة العربية السعودية'}</span></td>
            <td class="p-3 text-xs">${planBadge} (${data.currency || 'ريال'})</td>
            <td class="p-3">${data.isActive ? '<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">نشطة</span>' : '<span class="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs font-bold">موقوفة</span>'}</td>
            <td class="p-3 flex gap-1.5 flex-wrap">
                <button onclick="toggleTenantStatus('${data.id}', ${data.isActive})" class="px-2 py-1 rounded text-xs text-white ${data.isActive ? 'bg-amber-500' : 'bg-emerald-600'} cursor-pointer">${data.isActive ? 'إيقاف' : 'تنشيط'}</button>
                <button onclick="extendTenantDays('${data.id}', 30)" class="px-2 py-1 rounded text-xs bg-indigo-100 text-indigo-700 cursor-pointer">+30 يوم</button>
                <button onclick="window.previewTenantTheme('${data.theme || 'indigo'}')" class="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700 cursor-pointer">معاينة السكيم</button>
                <button onclick="deleteTenant('${data.id}', '${bName}')" class="px-2 py-1 rounded text-xs bg-red-100 text-red-700 cursor-pointer">حذف</button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    listEl.innerHTML = html;
}

// دالة إنشاء منشأة جديدة مع حفظ السكيم المختار
window.createTenant = async function(event) {
    event.preventDefault();
    
    const tenantIdInput = document.getElementById('tenant-id-input');
    const tenantNameInput = document.getElementById('tenant-name-input');
    const countryInput = document.getElementById('tenant-country-input');
    const currencyInput = document.getElementById('tenant-currency-input');
    const planInput = document.getElementById('tenant-plan-input');
    const themeInput = document.getElementById('tenant-theme-input');

    if (!tenantIdInput || !tenantNameInput) return;

    const tenantId = tenantIdInput.value.trim().toLowerCase();
    const businessName = tenantNameInput.value.trim();
    const country = countryInput ? countryInput.value : "المملكة العربية السعودية";
    const currency = currencyInput ? currencyInput.value : "ريال سعودي";
    const plan = planInput ? planInput.value : "unlimited";
    const theme = themeInput ? themeInput.value : "indigo";

    try {
        const tenantRef = doc(db, "tenants", tenantId);
        const tenantSnap = await getDoc(tenantRef);

        if (tenantSnap.exists()) {
            alert('خطأ: معرف المنشأة هذا موجود مسبقاً، الرجاء اختيار معرف آخر.');
            return;
        }

        await setDoc(tenantRef, {
            businessName,
            name: businessName,
            country,
            currency,
            plan,
            theme,
            isActive: true,
            isTrial: plan.startsWith('trial'),
            createdAt: new Date().toISOString()
        });

        alert('تم إنشاء المنشأة بنجاح وتحديد هويتها البصرية!');
        tenantIdInput.value = '';
        tenantNameInput.value = '';
        
        if (typeof window.loadTenants === 'function') {
            window.loadTenants();
        }
    } catch (err) {
        console.error("Error creating tenant:", err);
        alert('حدث خطأ أثناء إنشاء المنشأة: ' + err.message);
    }
};

window.toggleTenantStatus = async function(tenantId, currentStatus) {
    await updateDoc(doc(db, "tenants", tenantId), { isActive: !currentStatus });
    if (typeof window.loadTenants === 'function') window.loadTenants();
};

window.extendTenantDays = async function(tenantId, days) {
    const tDoc = await getDoc(doc(db, "tenants", tenantId));
    if (!tDoc.exists()) return;
    const data = tDoc.data();
    let currentExp = data.expiresAt ? new Date(data.expiresAt) : new Date();
    if (currentExp < new Date()) currentExp = new Date();
    currentExp.setDate(currentExp.getDate() + days);

    await updateDoc(doc(db, "tenants", tenantId), { expiresAt: currentExp.toISOString() });
    alert(`تم تمديد اشتراك المنشأة بـ ${days} يوماً بنجاح!`);
    if (typeof window.loadTenants === 'function') window.loadTenants();
};

window.deleteTenant = async function(tenantId, businessName) {
    if (!confirm(`هل أنت متأكد من حذف المنشأة "${businessName}"؟`)) return;
    await deleteDoc(doc(db, "tenants", tenantId));
    if (typeof window.loadTenants === 'function') window.loadTenants();
};

// إدارة المستخدمين والصلاحيات
window.loadUsers = async function() {
    const listEl = document.getElementById('users-list');
    if (!listEl) return;
    const snap = await getDocs(collection(db, "users"));
    allUsersCache = [];

    if (snap.empty) {
        listEl.innerHTML = '<p class="text-gray-400 py-4 text-center">لا يوجد مستخدمون.</p>';
        return;
    }

    snap.forEach((d) => {
        const u = d.data();
        allUsersCache.push({ id: d.id, ...u });
    });

    renderAdminUsersTable(allUsersCache);
};

window.filterAdminUsers = function() {
    const searchInput = document.getElementById('search-users-input');
    const roleFilterEl = document.getElementById('filter-users-role');
    if (!searchInput || !roleFilterEl) return;

    const search = searchInput.value.toLowerCase();
    const roleFilter = roleFilterEl.value;

    const filtered = allUsersCache.filter(u => {
        const matchSearch = (u.name && u.name.toLowerCase().includes(search)) || 
                          (u.phone && u.phone.toLowerCase().includes(search)) || 
                          (u.secondaryPhone && u.secondaryPhone.toLowerCase().includes(search)) || 
                          (u.email && u.email.toLowerCase().includes(search));
        const matchRole = roleFilter === 'all' || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    renderAdminUsersTable(filtered);
};

function renderAdminUsersTable(users) {
    const listEl = document.getElementById('users-list');
    if (!listEl) return;

    if (users.length === 0) {
        listEl.innerHTML = '<p class="text-gray-400 py-4 text-center">لا توجد نتائج مطابقة للبحث أو الفلتر.</p>';
        return;
    }

    let html = `<table class="w-full text-right border-collapse">
        <thead><tr class="border-b bg-gray-50 text-xs text-gray-600">
            <th class="p-3">الاسم</th><th class="p-3">الهواتف</th><th class="p-3">النوع والدولة والمدينة</th><th class="p-3">الدور والمنشأة</th><th class="p-3">المناسبات والاهتمامات</th><th class="p-3">الإجراءات والبيانات</th>
        </tr></thead><tbody class="divide-y divide-gray-100">`;
    
    users.forEach((u) => {
        html += `<tr class="hover:bg-gray-50">
            <td class="p-3 font-semibold">${u.name || '--'}</td>
            <td class="p-3 text-xs" dir="ltr">${u.phone || '--'}<br><span class="text-gray-400">${u.secondaryPhone || ''}</span></td>
            <td class="p-3 text-xs">${u.gender || '--'} | ${u.country || '--'} - ${u.city || '--'}<br><span class="text-gray-400">${u.address || ''}</span></td>
            <td class="p-3 text-xs font-mono">${u.role} (${u.tenantId || u.registeredTenant || 'عام'})</td>
            <td class="p-3 text-xs">🎂 ${u.birthdate || 'غير مسجل'}<br>💍 ${u.anniversary || 'غير مسجل'}<br>💡 ${u.hobbies || '--'}</td>
            <td class="p-3 flex flex-col gap-1.5">
                <button onclick="viewCustomerFullProfile('${u.id}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap">
                    👁️ عرض البيانات الشخصية
                </button>
                <button onclick="adminUpdateUserPassword('${u.email}')" class="px-3 py-1 rounded text-xs bg-amber-100 text-amber-800 font-semibold hover:bg-amber-200 cursor-pointer whitespace-nowrap">
                    🔑 إعادة تعيين الباسورد
                </button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    listEl.innerHTML = html;
}

window.adminUpdateUserPassword = async function(userEmail) {
    try {
        await sendPasswordResetEmail(auth, userEmail);
        alert(`تم إرسال رابط إعادة تعيين وتنبيه الأمان إلى البريد: ${userEmail}`);
    } catch (err) {
        alert('فشل الإرسال: ' + err.message);
    }
};

window.createTenantStaff = async function(e) {
    e.preventDefault();
    const selectEl = document.getElementById('admin-tenant-select');
    const roleEl = document.getElementById('staff-role-select');
    const nameEl = document.getElementById('admin-name-input');
    const phoneEl = document.getElementById('admin-phone-input');
    const secPhoneEl = document.getElementById('admin-secondary-phone-input');
    const emailEl = document.getElementById('admin-email-input');
    const passEl = document.getElementById('admin-pass-input');

    if (!selectEl || !roleEl || !nameEl || !emailEl || !passEl) return;

    const tenantId = selectEl.value;
    const role = roleEl.value;
    const name = nameEl.value.trim();
    const phone = phoneEl ? phoneEl.value.trim() : '';
    const secondaryPhone = secPhoneEl ? secPhoneEl.value.trim() : '';
    const email = emailEl.value.trim();
    const password = passEl.value.trim();

    if (!tenantId) return alert('الرجاء اختيار المنشأة أولاً.');
    if (!phone) return alert('الرجاء إدخال رقم الهاتف الأساسي للموظف.');

    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCred.user.uid), {
            name, phone, secondaryPhone, email, role, tenantId, isBlocked: false, createdAt: new Date().toISOString()
        });
        alert(`تم إنشاء حساب الصلاحية (${name}) بنجاح!`);
        nameEl.value = '';
        if(phoneEl) phoneEl.value = '';
        if(secPhoneEl) secPhoneEl.value = '';
        emailEl.value = '';
        passEl.value = '';
        if (typeof window.loadUsers === 'function') window.loadUsers();
    } catch (error) {
        alert('خطأ أثناء إنشاء حساب الصلاحية: ' + error.message);
    }
};

// دالة عرض الملف الشخصي الكامل الموحدة للعملاء والمستخدمين
window.viewCustomerFullProfile = async function(customerId) {
    const modal = document.getElementById('customer-details-modal');
    const contentEl = document.getElementById('customer-details-content');
    if (!modal || !contentEl) return;

    contentEl.innerHTML = '<p class="text-gray-400 text-center py-4">جاري تحميل بيانات العميل...</p>';
    modal.classList.remove('hidden');

    try {
        const userDoc = await getDoc(doc(db, "users", customerId));
        if (!userDoc.exists()) {
            contentEl.innerHTML = '<p class="text-red-500 text-center py-4">عذراً، لم يتم العثور على بيانات هذا المستخدم.</p>';
            return;
        }

        const data = userDoc.data();
        contentEl.innerHTML = `
            <div class="space-y-3 bg-gray-50 p-4 rounded-xl border">
                <p><strong>الاسم الكامل:</strong> <span class="text-indigo-900 font-bold">${data.name || '--'}</span></p>
                <p><strong>رقم الهاتف الأساسي:</strong> <span class="font-mono" dir="ltr">${data.phone || '--'}</span></p>
                <p><strong>رقم الهاتف الإضافي:</strong> <span class="font-mono" dir="ltr">${data.secondaryPhone || '--'}</span></p>
                <p><strong>البريد الإلكتروني:</strong> <span class="font-mono" dir="ltr">${data.email || '--'}</span></p>
                <p><strong>الدور والصلاحية:</strong> <span class="font-mono">${data.role || 'عميل'}</span></p>
                <p><strong>النوع:</strong> ${data.gender || '--'}</p>
                <p><strong>الدولة والمدينة:</strong> ${data.country || '--'} / ${data.city || '--'}</p>
                <p><strong>العنوان بالتفصيل:</strong> ${data.address || '--'}</p>
                <p><strong>تاريخ الميلاد:</strong> ${data.birthdate ? `🎂 ${data.birthdate}` : '--'}</p>
                <p><strong>تاريخ المناسبة / الزواج:</strong> ${data.anniversary ? `💍 ${data.anniversary}` : '--'}</p>
                <p><strong>الهوايات والاهتمامات:</strong> ${data.hobbies || '--'}</p>
                <p class="text-xs text-gray-400 pt-2 border-t">معرف النظام (UID): <span class="font-mono">${customerId}</span></p>
            </div>
        `;
    } catch (err) {
        contentEl.innerHTML = `<p class="text-red-500 text-center py-4">حدث خطأ أثناء تحميل البيانات: ${err.message}</p>`;
    }
};

window.closeCustomerDetailsModal = function() {
    const modal = document.getElementById('customer-details-modal');
    if (modal) modal.classList.add('hidden');
};
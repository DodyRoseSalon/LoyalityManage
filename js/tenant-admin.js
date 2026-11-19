import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc, collection, getDocs, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

let allTenantCustomersCache = [];
let activeTenantReportTab = 'all';
let currentTenantIdActive = '';

// تحميل بيانات لوحة تحكم مدير المنشأة مع تطبيق السكيم
window.loadTenantAdminData = async function(tenantId) {
    if (!tenantId) return;
    currentTenantIdActive = tenantId;
    
    try {
        const tDoc = await getDoc(doc(db, "tenants", tenantId));
        if (!tDoc.exists()) return;

        const data = tDoc.data();
        document.getElementById('current-tenant-name').innerText = data.businessName || tenantId;
        document.getElementById('current-tenant-id-badge').innerText = tenantId;
        document.getElementById('tenant-country-badge').innerText = data.country || 'السعودية';
        document.getElementById('tenant-currency-badge').innerText = data.currency || 'ريال سعودي';
        
        // تطبيق السكيم البصري الخاص بالمنشأة فوراً
        const savedTheme = data.theme || 'indigo';
        if (typeof window.applyTenantTheme === 'function') {
            window.applyTenantTheme(savedTheme);
        }
        if (document.getElementById('rule-tenant-theme')) {
            document.getElementById('rule-tenant-theme').value = savedTheme;
        }

        if (data.loyaltyRules) {
            document.getElementById('rule-currency-per-point').value = data.loyaltyRules.currencyPerPoint || 10;
            document.getElementById('rule-point-value').value = data.loyaltyRules.pointValue || 1;
            document.getElementById('rule-min-redemption').value = data.loyaltyRules.minRedemption || 50;
            document.getElementById('rule-welcome-points').value = data.loyaltyRules.welcomePoints || 50;
            document.getElementById('rule-referral-points').value = data.loyaltyRules.referralPoints || 25;
            document.getElementById('rule-expiry-days').value = data.loyaltyRules.expiryDays || 365;
        }

        const directLink = `${window.location.origin}${window.location.pathname}?tenant=${tenantId}`;
        const directLinkInput = document.getElementById('tenant-direct-reg-link');
        if (directLinkInput) directLinkInput.value = directLink;

        const qrContainer = document.getElementById('tenant-reg-qrcode');
        if (qrContainer && typeof QRCode !== 'undefined') {
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: directLink,
                width: 140,
                height: 140,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }

        if (typeof window.loadTenantServices === 'function') window.loadTenantServices(tenantId);
        if (typeof window.loadTenantAbout === 'function') window.loadTenantAbout(tenantId);
        if (typeof window.loadTenantContact === 'function') window.loadTenantContact(tenantId);
        if (typeof window.loadTenantOffers === 'function') window.loadTenantOffers(tenantId);
        if (typeof window.loadTenantGallery === 'function') window.loadTenantGallery(tenantId);
        if (typeof window.loadTenantCustomers === 'function') window.loadTenantCustomers(tenantId);

    } catch (err) {
        console.error("Error loading tenant admin data:", err);
    }
};

// حفظ ضوابط الولاء والهوية البصرية للمنشأة
window.saveTenantLoyaltyRules = async function(e, tenantId) {
    e.preventDefault();
    if (!tenantId) return;

    const loyaltyRules = {
        currencyPerPoint: Number(document.getElementById('rule-currency-per-point').value),
        pointValue: Number(document.getElementById('rule-point-value').value),
        minRedemption: Number(document.getElementById('rule-min-redemption').value),
        welcomePoints: Number(document.getElementById('rule-welcome-points').value),
        referralPoints: Number(document.getElementById('rule-referral-points').value),
        expiryDays: Number(document.getElementById('rule-expiry-days').value)
    };

    const selectedTheme = document.getElementById('rule-tenant-theme')?.value || 'indigo';

    try {
        await updateDoc(doc(db, "tenants", tenantId), {
            loyaltyRules,
            theme: selectedTheme
        });
        
        if (typeof window.applyTenantTheme === 'function') {
            window.applyTenantTheme(selectedTheme);
        }
        alert('تم حفظ ضوابط الولاء والهوية البصرية بنجاح!');
    } catch (err) {
        console.error("Error saving rules:", err);
        alert('حدث خطأ أثناء الحفظ: ' + err.message);
    }
};

window.saveTenantAbout = async function(e, tenantId) {
    e.preventDefault();
    const about = document.getElementById('tenant-about-text').value.trim();
    try {
        await updateDoc(doc(db, "tenants", tenantId), { about });
        alert('تم حفظ النبذة التعريفية بنجاح!');
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
};

window.loadTenantAbout = async function(tenantId) {
    const tDoc = await getDoc(doc(db, "tenants", tenantId));
    if (tDoc.exists() && document.getElementById('tenant-about-text')) {
        document.getElementById('tenant-about-text').value = tDoc.data().about || '';
    }
};

window.saveTenantContact = async function(e, tenantId) {
    e.preventDefault();
    const contact = {
        phone: document.getElementById('contact-phone').value.trim(),
        email: document.getElementById('contact-email').value.trim(),
        web: document.getElementById('contact-web').value.trim(),
        whatsapp: document.getElementById('contact-whatsapp').value.trim(),
        facebook: document.getElementById('contact-facebook').value.trim(),
        instagram: document.getElementById('contact-instagram').value.trim(),
        snapchat: document.getElementById('contact-snapchat').value.trim(),
        tiktok: document.getElementById('contact-tiktok').value.trim(),
        googleReviews: document.getElementById('contact-google-reviews').value.trim()
    };
    try {
        await updateDoc(doc(db, "tenants", tenantId), { contact });
        alert('تم حفظ بيانات التواصل والسوشيال بنجاح!');
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
};

window.loadTenantContact = async function(tenantId) {
    const tDoc = await getDoc(doc(db, "tenants", tenantId));
    if (tDoc.exists() && tDoc.data().contact) {
        const c = tDoc.data().contact;
        if(document.getElementById('contact-phone')) document.getElementById('contact-phone').value = c.phone || '';
        if(document.getElementById('contact-email')) document.getElementById('contact-email').value = c.email || '';
        if(document.getElementById('contact-web')) document.getElementById('contact-web').value = c.web || '';
        if(document.getElementById('contact-whatsapp')) document.getElementById('contact-whatsapp').value = c.whatsapp || '';
        if(document.getElementById('contact-facebook')) document.getElementById('contact-facebook').value = c.facebook || '';
        if(document.getElementById('contact-instagram')) document.getElementById('contact-instagram').value = c.instagram || '';
        if(document.getElementById('contact-snapchat')) document.getElementById('contact-snapchat').value = c.snapchat || '';
        if(document.getElementById('contact-tiktok')) document.getElementById('contact-tiktok').value = c.tiktok || '';
        if(document.getElementById('contact-google-reviews')) document.getElementById('contact-google-reviews').value = c.googleReviews || '';
    }
};

window.addTenantService = async function(e, tenantId) {
    e.preventDefault();
    const name = document.getElementById('srv-name').value.trim();
    const price = Number(document.getElementById('srv-price').value);
    const notes = document.getElementById('srv-notes').value.trim();

    try {
        const srvRef = doc(collection(db, "tenants", tenantId, "services"));
        await setDoc(srvRef, { name, price, notes, isActive: true, createdAt: new Date().toISOString() });
        alert('تم إضافة الخدمة بنجاح!');
        document.getElementById('srv-name').value = '';
        document.getElementById('srv-price').value = '';
        document.getElementById('srv-notes').value = '';
        window.loadTenantServices(tenantId);
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
};

window.loadTenantServices = async function(tenantId) {
    const listEl = document.getElementById('admin-services-list');
    if (!listEl) return;
    try {
        const snap = await getDocs(collection(db, "tenants", tenantId, "services"));
        if (snap.empty) {
            listEl.innerHTML = '<p class="text-gray-400 text-sm">لا توجد خدمات مضافة حتى الآن.</p>';
            return;
        }
        let html = '<table class="w-full text-right border-collapse"><thead><tr class="bg-gray-50 border-b text-xs text-gray-500"><th class="p-2">الخدمة</th><th class="p-2">السعر</th><th class="p-2">ملاحظات</th><th class="p-2 text-center">إجراءات</th></tr></thead><tbody class="divide-y">';
        snap.forEach(d => {
            const s = d.data();
            html += `<tr class="hover:bg-gray-50">
                <td class="p-2 font-bold text-indigo-900">${s.name}</td>
                <td class="p-2 text-emerald-600 font-bold">${s.price}</td>
                <td class="p-2 text-gray-500">${s.notes || '--'}</td>
                <td class="p-2 text-center">
                    <button onclick="deleteTenantService('${tenantId}', '${d.id}')" class="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer inline-flex items-center gap-1"><i class="fa-solid fa-trash-can"></i><span>حذف</span></button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        listEl.innerHTML = html;
    } catch (err) {
        listEl.innerHTML = '<p class="text-red-500 text-sm">خطأ في التحميل.</p>';
    }
};

window.deleteTenantService = async function(tenantId, srvId) {
    if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;
    try {
        await deleteDoc(doc(db, "tenants", tenantId, "services", srvId));
        window.loadTenantServices(tenantId);
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
};

window.addTenantOffer = async function(e, tenantId) {
    e.preventDefault();
    const title = document.getElementById('offer-title').value.trim();
    const desc = document.getElementById('offer-desc').value.trim();
    const img = document.getElementById('offer-img').value.trim();

    try {
        await setDoc(doc(collection(db, "tenants", tenantId, "offers")), {
            title, desc, img, createdAt: new Date().toISOString()
        });
        alert('تم نشر العرض بنجاح!');
        document.getElementById('offer-title').value = '';
        document.getElementById('offer-desc').value = '';
        document.getElementById('offer-img').value = '';
        window.loadTenantOffers(tenantId);
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
};

window.loadTenantOffers = async function(tenantId) {
    const listEl = document.getElementById('admin-offers-list');
    if (!listEl) return;
    try {
        const snap = await getDocs(collection(db, "tenants", tenantId, "offers"));
        if (snap.empty) {
            listEl.innerHTML = '<p class="text-gray-400 text-sm">لا توجد عروض منشورة حالياً.</p>';
            return;
        }
        let html = '';
        snap.forEach(d => {
            const o = d.data();
            html += `<div class="p-3 bg-gray-50 border rounded-xl flex justify-between items-center">
                <div>
                    <h6 class="font-bold text-indigo-900">${o.title}</h6>
                    <p class="text-xs text-gray-500">${o.desc || ''}</p>
                </div>
                <button onclick="deleteTenantOffer('${tenantId}', '${d.id}')" class="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer inline-flex items-center gap-1"><i class="fa-solid fa-trash-can"></i><span>حذف</span></button>
            </div>`;
        });
        listEl.innerHTML = html;
    } catch (e) {
        listEl.innerHTML = '<p class="text-red-500 text-sm">فشل تحميل العروض.</p>';
    }
};

window.deleteTenantOffer = async function(tenantId, offerId) {
    if (!confirm('حذف هذا العرض؟')) return;
    await deleteDoc(doc(db, "tenants", tenantId, "offers", offerId));
    window.loadTenantOffers(tenantId);
};

window.addTenantGalleryImage = async function(e, tenantId) {
    e.preventDefault();
    const url = document.getElementById('gallery-img-url').value.trim();
    if (!url) return;
    try {
        await setDoc(doc(collection(db, "tenants", tenantId, "gallery")), {
            url, createdAt: new Date().toISOString()
        });
        alert('تم إضافة الصورة للمعرض بنجاح!');
        document.getElementById('gallery-img-url').value = '';
        window.loadTenantGallery(tenantId);
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
};

window.uploadGalleryTxtFile = async function(tenantId) {
    const fileInput = document.getElementById('gallery-txt-file');
    if (!fileInput.files || fileInput.files.length === 0) return alert('الرجاء اختيار ملف نصي (.txt).');
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        let count = 0;
        for (let line of lines) {
            const url = line.trim();
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                await setDoc(doc(collection(db, "tenants", tenantId, "gallery")), {
                    url, createdAt: new Date().toISOString()
                });
                count++;
            }
        }
        alert(`تم بنجاح رفع ${count} صورة إلى معرض المنشأة من الملف النصي!`);
        fileInput.value = '';
        window.loadTenantGallery(tenantId);
    };
    reader.readAsText(file);
};

window.loadTenantGallery = async function(tenantId) {
    const listEl = document.getElementById('admin-gallery-list');
    if (!listEl) return;
    try {
        const snap = await getDocs(collection(db, "tenants", tenantId, "gallery"));
        if (snap.empty) {
            listEl.innerHTML = '<p class="text-gray-400 text-sm col-span-4">لا توجد صور في المعرض.</p>';
            return;
        }
        let html = '';
        snap.forEach(d => {
            const img = d.data();
            html += `<div class="relative group rounded-xl overflow-hidden border shadow-xs bg-white">
                <img src="${img.url}" class="w-full h-32 object-cover">
                <button onclick="deleteTenantGalleryImage('${tenantId}', '${d.id}')" class="absolute top-2 left-2 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition shadow-md cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
            </div>`;
        });
        listEl.innerHTML = html;
    } catch (e) {
        listEl.innerHTML = '<p class="text-red-500 text-sm col-span-4">فشل تحميل المعرض.</p>';
    }
};

window.deleteTenantGalleryImage = async function(tenantId, imgId) {
    if (!confirm('حذف هذه الصورة من المعرض؟')) return;
    await deleteDoc(doc(db, "tenants", tenantId, "gallery", imgId));
    window.loadTenantGallery(tenantId);
};

// ==========================================
// العملاء والتقارير الأربعة لمدير المنشأة
// ==========================================
window.loadTenantCustomers = async function(tenantId) {
    const listEl = document.getElementById('tenant-customers-list');
    if (!listEl) return;
    try {
        const snap = await getDocs(collection(db, "tenants", tenantId, "customers"));
        allTenantCustomersCache = [];
        if (snap.empty) {
            listEl.innerHTML = '<p class="text-gray-400 text-sm py-4">لا توجد عملاء مسجلون في هذه المنشأة حتى الآن.</p>';
            if(document.getElementById('tenant-stat-customers')) document.getElementById('tenant-stat-customers').innerText = '0';
            if(document.getElementById('tenant-stat-points')) document.getElementById('tenant-stat-points').innerText = '0';
            window.renderTenantReportsDashboard(tenantId, activeTenantReportTab);
            return;
        }
        let totalPts = 0;
        snap.forEach(d => {
            const c = d.data();
            const pts = Number(c.points || 0);
            totalPts += pts;
            allTenantCustomersCache.push({ id: d.id, ...c, points: pts });
        });
        if(document.getElementById('tenant-stat-customers')) document.getElementById('tenant-stat-customers').innerText = allTenantCustomersCache.length;
        if(document.getElementById('tenant-stat-points')) document.getElementById('tenant-stat-points').innerText = totalPts;

        renderTenantCustomersTable(allTenantCustomersCache);
        window.renderTenantReportsDashboard(tenantId, activeTenantReportTab);
    } catch (err) {
        listEl.innerHTML = '<p class="text-red-500 text-sm">خطأ في تحميل عملاء المنشأة.</p>';
    }
};

window.renderTenantReportsDashboard = function(tenantId = currentTenantIdActive, reportTab = activeTenantReportTab) {
    activeTenantReportTab = reportTab;
    const reportsBox = document.getElementById('tenant-admin-reports-box');
    if (!reportsBox) return;

    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

    const birthdayCustomers = allTenantCustomersCache.filter(c => {
        if (!c.birthdate) return false;
        const parts = String(c.birthdate).split('-');
        return parts[1] === currentMonth;
    });

    const anniversaryCustomers = allTenantCustomersCache.filter(c => {
        if (!c.anniversary) return false;
        const parts = String(c.anniversary).split('-');
        return parts[1] === currentMonth;
    });

    const sortedByPointsAndActivity = [...allTenantCustomersCache].sort((a, b) => {
        const dateA = a.updatedAt || a.lastVisitAt || a.createdAt || '';
        const dateB = b.updatedAt || b.lastVisitAt || b.createdAt || '';
        if (dateA && dateB && dateA !== dateB) return String(dateB).localeCompare(String(dateA));
        return Number(b.points || 0) - Number(a.points || 0);
    });

    const totalPointsAll = allTenantCustomersCache.reduce((sum, c) => sum + Number(c.points || 0), 0);

    let listToShow = allTenantCustomersCache;
    let titleText = '1. تقرير العملاء والمحافظ';
    if (reportTab === 'birthdays') {
        listToShow = birthdayCustomers;
        titleText = `2. تقرير أعياد ميلاد الشهر (شهر ${currentMonth})`;
    } else if (reportTab === 'anniversaries') {
        listToShow = anniversaryCustomers;
        titleText = `3. تقرير تواريخ الزواج والمناسبات بالشهر (شهر ${currentMonth})`;
    } else if (reportTab === 'activity') {
        listToShow = sortedByPointsAndActivity;
        titleText = '4. تقرير حركة ونشاط النقاط للعملاء المرتبطين';
    }

    let rowsHtml = '';
    if (!listToShow.length) {
        rowsHtml = '<tr><td colspan="5" class="p-4 text-center text-gray-400">لا توجد سجلات مطابقة لهذا التقرير حالياً.</td></tr>';
    } else {
        listToShow.forEach(c => {
            const activityDateRaw = c.updatedAt || c.lastVisitAt || c.createdAt || '';
            const activityLabel = activityDateRaw && !isNaN(new Date(activityDateRaw).getTime())
                ? new Date(activityDateRaw).toLocaleDateString('ar-SA')
                : 'مسجل';
            rowsHtml += `
                <tr class="hover:bg-gray-50 text-xs">
                    <td class="p-2.5 font-bold text-indigo-950">${c.name || '--'}</td>
                    <td class="p-2.5 font-mono" dir="ltr">${c.phone || '--'}</td>
                    <td class="p-2.5 font-extrabold text-emerald-700">${c.points || 0} نقطة</td>
                    <td class="p-2.5 text-gray-600">${c.birthdate || '--'} / ${c.anniversary || '--'}</td>
                    <td class="p-2.5 text-gray-500">${activityLabel}</td>
                </tr>
            `;
        });
    }

    reportsBox.innerHTML = `
        <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <div>
                    <h4 class="font-extrabold text-sm text-indigo-950">${titleText}</h4>
                    <p class="text-[11px] text-gray-500">عدد السجلات: ${listToShow.length} • إجمالي نقاط المنشأة: ${totalPointsAll}</p>
                </div>
                <button type="button" onclick="window.exportTenantCustomersCSV('${reportTab}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5">
                    <i class="fa-solid fa-file-csv"></i>
                    <span>تصدير CSV</span>
                </button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-right">
                <button type="button" onclick="window.renderTenantReportsDashboard('${tenantId}', 'all')" class="p-2.5 rounded-xl border text-xs transition cursor-pointer ${reportTab === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-950'}">
                    <div class="font-bold">1. العملاء والمحافظ</div>
                    <div class="text-sm font-extrabold mt-0.5">${allTenantCustomersCache.length} عميل</div>
                </button>
                <button type="button" onclick="window.renderTenantReportsDashboard('${tenantId}', 'birthdays')" class="p-2.5 rounded-xl border text-xs transition cursor-pointer ${reportTab === 'birthdays' ? 'bg-pink-600 text-white border-pink-600' : 'bg-pink-50/70 hover:bg-pink-100 text-pink-950'}">
                    <div class="font-bold">2. أعياد ميلاد الشهر</div>
                    <div class="text-sm font-extrabold mt-0.5">${birthdayCustomers.length} عميل</div>
                </button>
                <button type="button" onclick="window.renderTenantReportsDashboard('${tenantId}', 'anniversaries')" class="p-2.5 rounded-xl border text-xs transition cursor-pointer ${reportTab === 'anniversaries' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50/70 hover:bg-amber-100 text-amber-950'}">
                    <div class="font-bold">3. تواريخ الزواج بالشهر</div>
                    <div class="text-sm font-extrabold mt-0.5">${anniversaryCustomers.length} عميل</div>
                </button>
                <button type="button" onclick="window.renderTenantReportsDashboard('${tenantId}', 'activity')" class="p-2.5 rounded-xl border text-xs transition cursor-pointer ${reportTab === 'activity' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-950'}">
                    <div class="font-bold">4. حركة ونشاط النقاط</div>
                    <div class="text-sm font-extrabold mt-0.5">${totalPointsAll} نقطة</div>
                </button>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-right border-collapse">
                    <thead>
                        <tr class="bg-gray-50 border-b text-[11px] text-gray-600">
                            <th class="p-2.5">العميل</th>
                            <th class="p-2.5">الهاتف</th>
                            <th class="p-2.5">رصيد النقاط</th>
                            <th class="p-2.5">الميلاد / الزواج</th>
                            <th class="p-2.5">آخر نشاط</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">${rowsHtml}</tbody>
                </table>
            </div>
        </div>
    `;
};

window.exportTenantCustomersCSV = function(reportTab = activeTenantReportTab) {
    if (!allTenantCustomersCache.length) return alert('لا توجد بيانات عملاء لتصديرها.');
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    let rows = allTenantCustomersCache;

    if (reportTab === 'birthdays') {
        rows = allTenantCustomersCache.filter(c => c.birthdate && String(c.birthdate).split('-')[1] === currentMonth);
    } else if (reportTab === 'anniversaries') {
        rows = allTenantCustomersCache.filter(c => c.anniversary && String(c.anniversary).split('-')[1] === currentMonth);
    }

    const headers = ['الاسم', 'الهاتف', 'البريد', 'رصيد النقاط', 'تاريخ الميلاد', 'تاريخ الزواج'];
    const lines = [headers.join(',')];

    rows.forEach(c => {
        lines.push([
            `"${String(c.name || '').replace(/"/g, '""')}"`,
            `"${String(c.phone || '').replace(/"/g, '""')}"`,
            `"${String(c.email || '').replace(/"/g, '""')}"`,
            Number(c.points || 0),
            `"${String(c.birthdate || '').replace(/"/g, '""')}"`,
            `"${String(c.anniversary || '').replace(/"/g, '""')}"`
        ].join(','));
    });

    const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenant_${currentTenantIdActive || 'report'}_${reportTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

window.renderTenantCustomersTable = function(customers) {
    const listEl = document.getElementById('tenant-customers-list');
    if (!listEl) return;
    if (customers.length === 0) {
        listEl.innerHTML = '<p class="text-gray-400 text-sm py-4">لا توجد نتائج مطابقة للبحث.</p>';
        return;
    }
    let html = `<table class="w-full text-right border-collapse">
        <thead>
            <tr class="bg-gray-50 border-b text-xs text-gray-500">
                <th class="p-3">اسم العميل</th>
                <th class="p-3">الهاتف</th>
                <th class="p-3">رصيد النقاط</th>
                <th class="p-3">تاريخ الميلاد</th>
                <th class="p-3">المناسبة / زواج</th>
                <th class="p-3 text-center">الإجراءات</th>
            </tr>
        </thead>
        <tbody class="divide-y">`;
    
    customers.forEach(c => {
        html += `<tr class="hover:bg-gray-50">
            <td class="p-3 font-bold text-indigo-900">${c.name || '--'}</td>
            <td class="p-3 font-mono text-xs" dir="ltr">${c.phone || '--'}</td>
            <td class="p-3 font-extrabold text-emerald-600">${c.points || 0} نقطة</td>
            <td class="p-3 text-xs text-gray-600">${c.birthdate ? `<i class="fa-solid fa-cake-candles text-pink-500 ml-1"></i>${c.birthdate}` : '--'}</td>
            <td class="p-3 text-xs text-gray-600">${c.anniversary ? `<i class="fa-solid fa-ring text-amber-500 ml-1"></i>${c.anniversary}` : '--'}</td>
            <td class="p-3 text-center">
                <button onclick="viewCustomerFullProfile('${c.id}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1"><i class="fa-regular fa-eye"></i><span>عرض الملف</span></button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    listEl.innerHTML = html;
};

window.filterAdminCustomers = function() {
    const query = document.getElementById('search-customers-input').value.toLowerCase().trim();
    const occasionFilter = document.getElementById('filter-customers-occasion').value;
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

    const filtered = allTenantCustomersCache.filter(c => {
        const matchText = (c.name || '').toLowerCase().includes(query) || 
                          (c.phone || '').includes(query) || 
                          (c.email || '').toLowerCase().includes(query);
        
        if (!matchText) return false;

        if (occasionFilter === 'birthday_this_month') {
            if (!c.birthdate) return false;
            const bMonth = c.birthdate.split('-')[1];
            return bMonth === currentMonth;
        }
        if (occasionFilter === 'anniversary_this_month') {
            if (!c.anniversary) return false;
            const aMonth = c.anniversary.split('-')[1];
            return aMonth === currentMonth;
        }
        return true;
    });
    renderTenantCustomersTable(filtered);
};

// عرض الملف الشخصي الكامل للعميل في النافذة المنبثقة (Modal)
window.viewCustomerFullProfile = async function(customerId) {
    const modal = document.getElementById('customer-details-modal');
    const contentEl = document.getElementById('customer-details-content');
    if (!modal || !contentEl) return;

    contentEl.innerHTML = '<p class="text-gray-400 text-center py-4">جاري تحميل بيانات العميل...</p>';
    modal.classList.remove('hidden');

    try {
        const userDoc = await getDoc(doc(db, "users", customerId));
        if (!userDoc.exists()) {
            contentEl.innerHTML = '<p class="text-red-500 text-center py-4">عذراً، لم يتم العثور على بيانات هذا العميل في النظام المركزي.</p>';
            return;
        }

        const data = userDoc.data();
        contentEl.innerHTML = `
            <div class="space-y-3 bg-gray-50 p-4 rounded-xl border">
                <p><strong>الاسم الكامل:</strong> <span class="text-indigo-900 font-bold">${data.name || '--'}</span></p>
                <p><strong>رقم الهاتف الأساسي:</strong> <span class="font-mono" dir="ltr">${data.phone || '--'}</span></p>
                <p><strong>رقم الهاتف الإضافي:</strong> <span class="font-mono" dir="ltr">${data.secondaryPhone || '--'}</span></p>
                <p><strong>البريد الإلكتروني:</strong> <span class="font-mono" dir="ltr">${data.email || '--'}</span></p>
                <p><strong>النوع:</strong> ${data.gender || '--'}</p>
                <p><strong>الدولة والمدينة:</strong> ${data.country || '--'} / ${data.city || '--'}</p>
                <p><strong>العنوان بالتفصيل:</strong> ${data.address || '--'}</p>
                <p><strong>تاريخ الميلاد:</strong> ${data.birthdate ? `<i class="fa-solid fa-cake-candles text-pink-500 ml-1"></i> ${data.birthdate}` : '--'}</p>
                <p><strong>تاريخ المناسبة / الزواج:</strong> ${data.anniversary ? `<i class="fa-solid fa-ring text-amber-500 ml-1"></i> ${data.anniversary}` : '--'}</p>
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
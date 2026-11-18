import { db, auth } from "./firebase-config.js";
import { collection, doc, getDoc, setDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { TENANT_THEMES } from "./utils.js";

window.saveCustomerProfile = async function(e) {
    e.preventDefault();
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const gender = document.getElementById('cust-gender').value;
    const secondaryPhone = document.getElementById('cust-secondary-phone').value.trim();
    const country = document.getElementById('cust-country').value.trim();
    const city = document.getElementById('cust-city').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const birthdate = document.getElementById('cust-birthdate').value;
    const anniversary = document.getElementById('cust-anniversary').value;
    const hobbies = document.getElementById('cust-hobbies').value.trim();

    try {
        await updateDoc(doc(db, "users", uid), { gender, secondaryPhone, country, city, address, birthdate, anniversary, hobbies });
        
        const tenantsSnap = await getDocs(collection(db, "tenants"));
        for (const tDoc of tenantsSnap.docs) {
            const custRef = doc(db, "tenants", tDoc.id, "customers", uid);
            const custSnap = await getDoc(custRef);
            if (custSnap.exists()) {
                await updateDoc(custRef, { gender, secondaryPhone, country, city, address, birthdate, anniversary, hobbies });
            }
        }

        alert('تم حفظ بياناتك الشخصية في تبويب الخصوصية بنجاح!');
    } catch (err) {
        alert('خطأ أثناء الحفظ: ' + err.message);
    }
};

window.openJoinTenantModal = function() {
    if(document.getElementById('join-tenant-id-input')) document.getElementById('join-tenant-id-input').value = '';
    if(document.getElementById('join-tenant-modal')) document.getElementById('join-tenant-modal').classList.remove('hidden');
    if(document.getElementById('join-tenant-id-input')) document.getElementById('join-tenant-id-input').focus();
};

window.closeJoinTenantModal = function() {
    if(document.getElementById('join-tenant-modal')) document.getElementById('join-tenant-modal').classList.add('hidden');
};

window.joinNewTenant = async function(e) {
    e.preventDefault();
    if (!auth.currentUser) return;

    const tenantId = document.getElementById('join-tenant-id-input').value.trim();
    if (!tenantId) return alert('الرجاء إدخال معرف المنشأة (Facility ID).');

    const btn = document.getElementById('join-tenant-submit-btn');
    btn.disabled = true;
    btn.innerText = 'جاري التحقق والانضمام...';

    try {
        const tenantRef = doc(db, "tenants", tenantId);
        const tenantSnap = await getDoc(tenantRef);

        if (!tenantSnap.exists()) {
            alert('عذراً، معرف المنشأة غير صحيح أو غير مسجل في النظام.');
            return;
        }

        const tenantData = tenantSnap.data();
        if (tenantData.isActive === false) {
            alert('عذراً، هذه المنشأة موقوفة حالياً ولا تستقبل اشتراكات جديدة.');
            return;
        }

        const uid = auth.currentUser.uid;
        const walletRef = doc(db, "tenants", tenantId, "customers", uid);
        const walletSnap = await getDoc(walletRef);

        if (walletSnap.exists()) {
            alert(`أنت مشترك بالفعل في (${tenantData.businessName})! سيتم فتح بطاقة المنشأة الآن.`);
            closeJoinTenantModal();
            openCustomerTenantPortal(tenantId);
            return;
        }

        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        const welcomePts = (tenantData.loyaltyRules && tenantData.loyaltyRules.welcomePoints !== undefined)
            ? Number(tenantData.loyaltyRules.welcomePoints)
            : 50;

        await setDoc(walletRef, {
            name: userData.name || '',
            phone: userData.phone || '',
            secondaryPhone: userData.secondaryPhone || '',
            email: userData.email || auth.currentUser.email || '',
            points: welcomePts,
            gender: userData.gender || '',
            country: userData.country || '',
            city: userData.city || '',
            address: userData.address || '',
            birthdate: userData.birthdate || '',
            anniversary: userData.anniversary || '',
            hobbies: userData.hobbies || '',
            joinedAt: new Date().toISOString(),
            lastVisit: new Date().toISOString()
        });

        const existingTenants = Array.isArray(userData.joinedTenants) ? userData.joinedTenants : [];
        if (!existingTenants.includes(tenantId)) {
            await updateDoc(userRef, {
                joinedTenants: [...existingTenants, tenantId]
            });
        }

        closeJoinTenantModal();
        alert(`🎉 مبروك! تم انضمامك إلى (${tenantData.businessName}) بنجاح وحصلت على ${welcomePts} نقطة ترحيبية.`);
        await loadCustomerDashboard(uid);
        openCustomerTenantPortal(tenantId);
    } catch (err) {
        alert('حدث خطأ أثناء الانضمام للمنشأة: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'تأكيد الانضمام وإنشاء المحفظة';
    }
};

window.loadCustomerDashboard = async function(userId) {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return;
    const userData = userDoc.data();
    if(document.getElementById('customer-welcome-name')) document.getElementById('customer-welcome-name').innerText = `أهلاً بك، ${userData.name || 'عميل الشبكة'}`;
    if(document.getElementById('customer-phone-display')) document.getElementById('customer-phone-display').innerText = userData.phone ? `📱 ${userData.phone}` : '';
    if(document.getElementById('customer-uid-badge')) document.getElementById('customer-uid-badge').innerText = userId;

    if(document.getElementById('cust-gender')) document.getElementById('cust-gender').value = userData.gender || '';
    if(document.getElementById('cust-secondary-phone')) document.getElementById('cust-secondary-phone').value = userData.secondaryPhone || '';
    if(document.getElementById('cust-country')) document.getElementById('cust-country').value = userData.country || '';
    if(document.getElementById('cust-city')) document.getElementById('cust-city').value = userData.city || '';
    if(document.getElementById('cust-address')) document.getElementById('cust-address').value = userData.address || '';
    if(document.getElementById('cust-birthdate')) document.getElementById('cust-birthdate').value = userData.birthdate || '';
    if(document.getElementById('cust-anniversary')) document.getElementById('cust-anniversary').value = userData.anniversary || '';
    if(document.getElementById('cust-hobbies')) document.getElementById('cust-hobbies').value = userData.hobbies || '';

    const qrContainer = document.getElementById('qrcode');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: userId,
            width: 140,
            height: 140,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    const walletsEl = document.getElementById('customer-wallets-list');
    if (!walletsEl) return;
    walletsEl.innerHTML = '<p class="text-gray-400 text-sm py-4">جاري تحميل بطاقات منشآتك...</p>';

    try {
        const tenantsSnap = await getDocs(collection(db, "tenants"));
        if (tenantsSnap.empty) {
            walletsEl.innerHTML = '<p class="text-gray-400 text-sm py-4">لا توجد منشآت متاحة حالياً.</p>';
            return;
        }

        let walletsHtml = '';
        let foundAny = false;
        let defaultTenantId = null;
        const syncedTenantIds = [];

        for (const tDoc of tenantsSnap.docs) {
            const tenantId = tDoc.id;
            const tenantData = tDoc.data();
            try {
                const custWalletDoc = await getDoc(doc(db, "tenants", tenantId, "customers", userId));
                if (custWalletDoc.exists()) {
                    foundAny = true;
                    syncedTenantIds.push(tenantId);
                    const wData = custWalletDoc.data();
                    const pts = wData.points || 0;
                    if (!defaultTenantId) defaultTenantId = tenantId;

                    // تلوين البطاقة المصرفية باللون المخصص للمنشأة
                    const themeKey = tenantData.theme || 'indigo';
                    const themeObj = TENANT_THEMES[themeKey] || TENANT_THEMES.indigo;
                    const gradientClass = themeObj.cardGradient;
                    const safeName = (tenantData.businessName || '').replace(/'/g, "\\'");

                    walletsHtml += `
                        <div onclick="openCustomerTenantPortal('${tenantId}')"
                             class="snap-start shrink-0 w-[280px] sm:w-[320px] h-[180px] bg-gradient-to-br ${gradientClass} text-white p-5 rounded-2xl border shadow-xl cursor-pointer transform transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between relative overflow-hidden">
                            
                            <div class="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>

                            <div class="flex justify-between items-center z-10">
                                <span class="bg-white/25 backdrop-blur-md text-white text-[10px] font-mono px-2.5 py-1 rounded-md tracking-wider">${tenantId}</span>
                                <span class="text-xs text-white/90 font-medium">${tenantData.country || ''}</span>
                            </div>

                            <div class="z-10 space-y-1">
                                <div class="w-9 h-7 bg-amber-200/90 rounded-md border border-amber-400/50 flex items-center justify-center shadow-xs mb-2">
                                    <div class="w-6 h-4 border border-amber-600/40 rounded-xs grid grid-cols-2 grid-rows-2 gap-px p-0.5">
                                        <div class="bg-amber-500/50"></div><div class="bg-amber-500/50"></div>
                                        <div class="bg-amber-500/50"></div><div class="bg-amber-500/50"></div>
                                    </div>
                                </div>
                                <h5 class="text-lg font-black tracking-wide truncate">${tenantData.businessName}</h5>
                            </div>

                            <div class="flex justify-between items-end z-10 pt-2 border-t border-white/15">
                                <div class="text-[11px] text-white/80">
                                    <span>انقر لاستعراض الخدمات</span>
                                </div>
                                <div class="text-left">
                                    <span class="text-2xl font-black leading-none">${pts}</span>
                                    <span class="text-[10px] text-white/90 block">نقطة ولاء</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } catch (e) {}
        }

        if (syncedTenantIds.length > 0) {
            const currentJoined = Array.isArray(userData.joinedTenants) ? userData.joinedTenants : [];
            if (JSON.stringify(currentJoined.sort()) !== JSON.stringify([...syncedTenantIds].sort())) {
                updateDoc(doc(db, "users", userId), { joinedTenants: syncedTenantIds }).catch(() => {});
            }
        }

        if (!foundAny) {
            walletsHtml = `
                <div class="w-full text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-300 space-y-2">
                    <p class="text-gray-600 text-sm font-semibold">لست مشتركاً في أي منشأة بعد.</p>
                    <p class="text-xs text-gray-500">اضغط على زر "+ انضمام لمنشأة جديدة" وأدخل معرف المنشأة للبدء.</p>
                </div>
            `;
        }
        walletsEl.innerHTML = walletsHtml;

        if (defaultTenantId) {
            openCustomerTenantPortal(defaultTenantId);
        }
    } catch (err) {
        walletsEl.innerHTML = '<p class="text-red-500 text-sm py-4">فشل تحميل بطاقات المنشآت.</p>';
    }
};

window.openCustomerTenantPortal = async function(tenantId) {
    const portalEl = document.getElementById('customer-tenant-portal');
    if (!portalEl) return;
    portalEl.classList.remove('hidden');
    document.getElementById('portal-tenant-id-label').innerText = tenantId;

    const currentUid = auth.currentUser ? auth.currentUser.uid : '';
    document.getElementById('portal-customer-uid-text').innerText = currentUid;

    const portalQrEl = document.getElementById('portal-customer-qrcode');
    if (portalQrEl) {
        portalQrEl.innerHTML = '';
        new QRCode(portalQrEl, {
            text: currentUid,
            width: 150,
            height: 150,
            colorDark: "#1e1b4b",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    const referralLink = `${window.location.origin}${window.location.pathname}?tenant=${tenantId}&ref=${currentUid}`;
    document.getElementById('cust-referral-link').value = referralLink;

    const refQrEl = document.getElementById('cust-referral-qrcode');
    if (refQrEl) {
        refQrEl.innerHTML = '';
        new QRCode(refQrEl, {
            text: referralLink,
            width: 130,
            height: 130,
            colorDark: "#065f46",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    let tenantCurrency = 'ريال';
    try {
        const tDoc = await getDoc(doc(db, "tenants", tenantId));
        if (tDoc.exists()) {
            const data = tDoc.data();
            tenantCurrency = data.currency || 'ريال';
            document.getElementById('portal-tenant-title').innerText = data.businessName || tenantId;

            // تطبيق السكيم البصري الخاص بالمنشأة فور فتح بوابتها
            const tenantTheme = data.theme || 'indigo';
            window.applyTenantTheme(tenantTheme);

            const refBonus = (data.loyaltyRules && data.loyaltyRules.referralPoints !== undefined) ? data.loyaltyRules.referralPoints : 25;
            document.getElementById('cust-referral-bonus-badge').innerText = refBonus;
            document.getElementById('portal-tab-about').innerText = data.about || 'لم تقم المنشأة بإضافة نبذة بعد.';
            
            const c = data.contact || {};
            document.getElementById('portal-tab-contact').innerHTML = `
                <div class="space-y-3">
                    <p><i class="fa-solid fa-phone text-indigo-600 theme-text-primary ml-2 w-5"></i><strong>الهاتف:</strong> ${c.phone ? `<a href="tel:${c.phone}" class="theme-text-primary underline">${c.phone}</a>` : '--'}</p>
                    <p><i class="fa-solid fa-envelope text-indigo-600 theme-text-primary ml-2 w-5"></i><strong>البريد الإلكتروني:</strong> ${c.email ? `<a href="mailto:${c.email}" class="theme-text-primary underline">${c.email}</a>` : '--'}</p>
                    <hr class="my-2 border-gray-100">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <p>${c.web ? `<i class="fa-solid fa-globe text-indigo-600 theme-text-primary ml-2 w-5"></i><strong>الموقع:</strong> <a href="${c.web}" target="_blank" class="theme-text-primary underline">زيارة الموقع</a>` : '<i class="fa-solid fa-globe text-gray-400 ml-2 w-5"></i><strong>الموقع:</strong> --'}</p>
                        <p>${c.whatsapp ? `<i class="fa-brands fa-whatsapp text-emerald-600 ml-2 w-5 text-base"></i><strong>واتساب:</strong> <a href="${c.whatsapp}" target="_blank" class="text-emerald-600 underline">مراسلة واتساب</a>` : '<i class="fa-brands fa-whatsapp text-gray-400 ml-2 w-5 text-base"></i><strong>واتساب:</strong> --'}</p>
                        <p>${c.facebook ? `<i class="fa-brands fa-facebook text-blue-600 ml-2 w-5 text-base"></i><strong>فيسبوك:</strong> <a href="${c.facebook}" target="_blank" class="text-blue-600 underline">رابط فيسبوك</a>` : '<i class="fa-brands fa-facebook text-gray-400 ml-2 w-5 text-base"></i><strong>فيسبوك:</strong> --'}</p>
                        <p>${c.instagram ? `<i class="fa-brands fa-instagram text-pink-600 ml-2 w-5 text-base"></i><strong>انستجرام:</strong> <a href="${c.instagram}" target="_blank" class="text-pink-600 underline">رابط انستجرام</a>` : '<i class="fa-brands fa-instagram text-gray-400 ml-2 w-5 text-base"></i><strong>انستجرام:</strong> --'}</p>
                        <p>${c.snapchat ? `<i class="fa-brands fa-snapchat text-yellow-500 ml-2 w-5 text-base"></i><strong>سناب شات:</strong> <a href="${c.snapchat}" target="_blank" class="text-yellow-600 underline">رابط سناب شات</a>` : '<i class="fa-brands fa-snapchat text-gray-400 ml-2 w-5 text-base"></i><strong>سناب شات:</strong> --'}</p>
                        <p>${c.tiktok ? `<i class="fa-brands fa-tiktok text-gray-900 ml-2 w-5 text-base"></i><strong>تيك توك:</strong> <a href="${c.tiktok}" target="_blank" class="text-gray-900 underline">رابط تيك توك</a>` : '<i class="fa-brands fa-tiktok text-gray-400 ml-2 w-5 text-base"></i><strong>تيك توك:</strong> --'}</p>
                    </div>
                    <p class="pt-2">${c.googleReviews ? `<i class="fa-solid fa-star text-amber-500 ml-2 w-5 text-base"></i><strong>تقييمات جوجل:</strong> <a href="${c.googleReviews}" target="_blank" class="text-amber-600 font-bold underline">اضغط هنا لكتابة تقييمك في جوجل</a>` : '<i class="fa-solid fa-star text-gray-400 ml-2 w-5 text-base"></i><strong>تقييمات جوجل:</strong> --'}</p>
                </div>
            `;
        }

        const walletSnap = await getDoc(doc(db, "tenants", tenantId, "customers", currentUid));
        if (walletSnap.exists()) {
            document.getElementById('portal-tenant-points-badge').innerText = `${walletSnap.data().points || 0} نقطة`;
        }
    } catch (e) {}

    const srvEl = document.getElementById('portal-tab-services');
    srvEl.innerHTML = 'جاري التحميل...';
    try {
        const srvSnap = await getDocs(collection(db, "tenants", tenantId, "services"));
        if (srvSnap.empty) {
            srvEl.innerHTML = '<p class="text-gray-400 text-sm">لا توجد خدمات متاحة حالياً.</p>';
        } else {
            let srvHtml = '';
            srvSnap.forEach(d => {
                const s = d.data();
                if (s.isActive !== false) {
                    srvHtml += `<div class="p-3 theme-bg-light rounded-xl border theme-border flex justify-between items-center">
                        <div>
                            <h6 class="font-bold theme-text-dark">${s.name}</h6>
                            <p class="text-xs text-gray-500">${s.notes || ''}</p>
                        </div>
                        <span class="font-bold text-emerald-600">${s.price} ${tenantCurrency}</span>
                    </div>`;
                }
            });
            srvEl.innerHTML = srvHtml || '<p class="text-gray-400 text-sm">لا توجد خدمات نشطة حالياً.</p>';
        }
    } catch (e) {
        srvEl.innerHTML = '<p class="text-red-500 text-sm">فشل تحميل الخدمات.</p>';
    }

    const offerEl = document.getElementById('portal-tab-offers');
    offerEl.innerHTML = 'جاري التحميل...';
    try {
        const offerSnap = await getDocs(collection(db, "tenants", tenantId, "offers"));
        if (offerSnap.empty) {
            offerEl.innerHTML = '<p class="text-gray-400 text-sm col-span-2">لا توجد عروض ترويجية حالياً.</p>';
        } else {
            let offerHtml = '';
            offerSnap.forEach(d => {
                const o = d.data();
                offerHtml += `<div class="bg-white border rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
                    ${o.img ? `<img src="${o.img}" class="w-full h-40 object-cover">` : ''}
                    <div class="p-4 space-y-2">
                        <h6 class="font-bold theme-text-dark text-base">${o.title}</h6>
                        <p class="text-xs text-gray-600 leading-relaxed">${o.desc || ''}</p>
                    </div>
                </div>`;
            });
            offerEl.innerHTML = offerHtml;
        }
    } catch (e) {
        offerEl.innerHTML = '<p class="text-red-500 text-sm col-span-2">فشل تحميل العروض.</p>';
    }

    const galleryEl = document.getElementById('portal-tab-gallery');
    galleryEl.innerHTML = 'جاري التحميل...';
    try {
        const gallerySnap = await getDocs(collection(db, "tenants", tenantId, "gallery"));
        if (gallerySnap.empty) {
            galleryEl.innerHTML = '<p class="text-gray-400 text-sm col-span-4">لا توجد صور في معرض المنشأة حالياً.</p>';
        } else {
            let galleryHtml = '';
            gallerySnap.forEach(d => {
                const img = d.data();
                galleryHtml += `<div class="rounded-xl overflow-hidden border shadow-xs bg-white">
                    <img src="${img.url}" class="w-full h-36 object-cover hover:scale-105 transition duration-300">
                </div>`;
            });
            galleryEl.innerHTML = galleryHtml;
        }
    } catch (e) {
        galleryEl.innerHTML = '<p class="text-red-500 text-sm col-span-4">فشل تحميل المعرض.</p>';
    }

    portalEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
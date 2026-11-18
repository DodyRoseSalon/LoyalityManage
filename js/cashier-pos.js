import { db } from "./firebase-config.js";
import { collection, doc, getDoc, setDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

let html5QrCode = null;
let activePosCustomerUid = null;
let activeTenantRules = { currencyPerPoint: 10, pointValue: 1, minRedemption: 50 };
let currentTenantCurrency = 'ريال سعودي';

window.loadCashierDashboard = async function(currentUserTenantId) {
    if (!currentUserTenantId) return;
    try {
        const tDoc = await getDoc(doc(db, "tenants", currentUserTenantId));
        if (tDoc.exists()) {
            const data = tDoc.data();
            if(document.getElementById('cashier-tenant-name')) {
                document.getElementById('cashier-tenant-name').innerText = data.businessName || currentUserTenantId;
            }
            currentTenantCurrency = data.currency || 'ريال سعودي';
            document.querySelectorAll('.pos-curr-text').forEach(el => el.innerText = currentTenantCurrency);
            if (data.loyaltyRules) activeTenantRules = data.loyaltyRules;

            // تطبيق السكيم الخاص بالمنشأة على واجهة الكاشير
            const tenantTheme = data.theme || 'indigo';
            window.applyTenantTheme(tenantTheme);
        }
    } catch (err) {
        console.error("Error loading cashier dashboard:", err);
    }
};

window.toggleCameraScanner = function(currentUserTenantId) {
    const readerDiv = document.getElementById('reader');
    const btn = document.getElementById('cam-toggle-btn');
    
    if (html5QrCode && html5QrCode.isScanning) {
        stopCamera();
        return;
    }

    readerDiv.classList.remove('hidden');
    btn.innerText = '⏹️ إيقاف الكاميرا';
    
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
            const cleanUid = decodedText.trim();
            document.getElementById('pos-customer-uid').value = cleanUid;
            stopCamera();
            posFindCustomer(currentUserTenantId);
        },
        () => {}
    ).catch(() => {
        alert('تعذر تشغيل الكاميرا: تأكد من السماح للمتصفح بالوصول للكاميرا.');
        readerDiv.classList.add('hidden');
        btn.innerText = '📷 تشغيل كاميرا المسح';
    });
};

function stopCamera() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            document.getElementById('reader').classList.add('hidden');
            document.getElementById('cam-toggle-btn').innerText = '📷 تشغيل كاميرا المسح';
        }).catch(err => console.error(err));
    } else {
        if(document.getElementById('reader')) document.getElementById('reader').classList.add('hidden');
        if(document.getElementById('cam-toggle-btn')) document.getElementById('cam-toggle-btn').innerText = '📷 تشغيل كاميرا المسح';
    }
}

window.posFindCustomer = async function(currentUserTenantId) {
    stopCamera();
    const searchVal = document.getElementById('pos-customer-uid').value.trim();
    if (!searchVal) return alert('الرجاء مسح الكود بالكاميرا أو إدخال معرف العميل أو رقم الهاتف.');

    try {
        let customerUid = searchVal;
        let userDoc = await getDoc(doc(db, "users", customerUid));

        if (!userDoc.exists() || userDoc.data().role !== 'customer') {
            const usersSnap = await getDocs(collection(db, "users"));
            let foundUser = null;
            usersSnap.forEach(d => {
                const u = d.data();
                if (u.role === 'customer' && (u.phone === searchVal || u.secondaryPhone === searchVal)) {
                    foundUser = { id: d.id, ...u };
                }
            });

            if (foundUser) {
                customerUid = foundUser.id;
                userDoc = await getDoc(doc(db, "users", customerUid));
            }
        }

        if (!userDoc.exists() || userDoc.data().role !== 'customer') {
            alert('لم يتم العثور على عميل بهذا المعرف أو رقم الهاتف في النظام المركزي.');
            return;
        }

        const userData = userDoc.data();
        activePosCustomerUid = customerUid;

        const walletRef = doc(db, "tenants", currentUserTenantId, "customers", customerUid);
        const walletDoc = await getDoc(walletRef);
        let currentPoints = walletDoc.exists() ? (walletDoc.data().points || 0) : 0;

        document.getElementById('pos-c-name').innerText = userData.name;
        document.getElementById('pos-c-phone').innerText = `هاتف: ${userData.phone || '--'} ${userData.secondaryPhone ? `| إضافي: ${userData.secondaryPhone}` : ''}`;
        document.getElementById('pos-c-email').innerText = userData.email;
        
        let detailsText = '';
        if (userData.gender) detailsText += `النوع: ${userData.gender} `;
        if (userData.city) detailsText += `| المدينة: ${userData.city} `;
        if (userData.birthdate) detailsText += `| 🎂 ميلاد: ${userData.birthdate} `;
        document.getElementById('pos-c-details').innerText = detailsText || 'لا توجد تفاصيل إضافية مسجلة';

        document.getElementById('pos-c-points').innerText = currentPoints;
        document.getElementById('pos-active-session').classList.remove('hidden');
    } catch (err) {
        alert('خطأ أثناء البحث عن العميل: ' + err.message);
    }
};

window.resetPosSession = function() {
    activePosCustomerUid = null;
    const input = document.getElementById('pos-customer-uid');
    input.value = '';
    document.getElementById('pos-active-session').classList.add('hidden');
    document.getElementById('pos-amount-input').value = '';
    document.getElementById('pos-service-price-input').value = '';
    input.focus();
};

window.posEarnPoints = async function(currentUserTenantId) {
    if (!activePosCustomerUid) return;
    const amount = Number(document.getElementById('pos-amount-input').value);
    if (amount <= 0) return alert('الرجاء إدخال مبلغ فاتورة صحيح.');

    const currencyPerPoint = activeTenantRules.currencyPerPoint || 10;
    const earnedPoints = Math.floor(amount / currencyPerPoint);

    const walletRef = doc(db, "tenants", currentUserTenantId, "customers", activePosCustomerUid);
    const walletDoc = await getDoc(walletRef);

    let newPoints = earnedPoints;
    const userDoc = await getDoc(doc(db, "users", activePosCustomerUid));
    const userData = userDoc.data();

    if (walletDoc.exists()) {
        newPoints += (walletDoc.data().points || 0);
    }

    await setDoc(walletRef, {
        name: userData.name,
        phone: userData.phone || '',
        secondaryPhone: userData.secondaryPhone || '',
        email: userData.email,
        gender: userData.gender || '',
        country: userData.country || '',
        city: userData.city || '',
        address: userData.address || '',
        birthdate: userData.birthdate || '',
        anniversary: userData.anniversary || '',
        hobbies: userData.hobbies || '',
        points: newPoints,
        lastVisit: new Date().toISOString()
    }, { merge: true });

    alert(`تم بنجاح منح العميل ${earnedPoints} نقطة! الرصيد الإجمالي بالمحفظة: ${newPoints} نقطة.`);
    document.getElementById('pos-c-points').innerText = newPoints;
    document.getElementById('pos-amount-input').value = '';
};

window.posRedeemPoints = async function(currentUserTenantId) {
    if (!activePosCustomerUid) return;
    const servicePrice = Number(document.getElementById('pos-service-price-input').value);
    if (servicePrice <= 0) return alert('الرجاء إدخال قيمة الخدمة الفعلية.');

    const pointValue = activeTenantRules.pointValue || 1;
    const minRedemption = activeTenantRules.minRedemption ?? 50;
    const requiredPoints = Math.ceil(servicePrice / pointValue);

    const walletRef = doc(db, "tenants", currentUserTenantId, "customers", activePosCustomerUid);
    const walletDoc = await getDoc(walletRef);

    if (!walletDoc.exists()) return alert('لا توجد محفظة لهذا العميل في الفرع.');
    const currentPts = walletDoc.data().points || 0;

    if (currentPts < minRedemption) {
        return alert(`عذراً، رصيد العميل الحالي (${currentPts} نقطة) أقل من الحد الأدنى المسموح للاستبدال وهو (${minRedemption} نقطة).`);
    }

    if (requiredPoints > currentPts) {
        return alert(`رصيد النقاط الحالي (${currentPts} نقطة) لا يكفي لتغطية هذه الخدمة. النقاط المطلوبة حسب السعر (${servicePrice} ${currentTenantCurrency}) هي: ${requiredPoints} نقطة.`);
    }

    const remainingPts = currentPts - requiredPoints;
    await updateDoc(walletRef, {
        points: remainingPts,
        lastVisit: new Date().toISOString()
    });

    alert(`تم استبدال وخصم ${requiredPoints} نقطة مقابل الخدمة بقيمة ${servicePrice} ${currentTenantCurrency}! الرصيد المتبقي: ${remainingPts} نقطة.`);
    document.getElementById('pos-c-points').innerText = remainingPts;
    document.getElementById('pos-service-price-input').value = '';
};
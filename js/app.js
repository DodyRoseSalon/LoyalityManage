import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { doc, setDoc, getDoc, collection, getDocs, increment, updateDoc } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import "./super-admin.js";
import "./tenant-admin.js";
import "./cashier-pos.js";
import "./customer.js";
import "./utils.js";

let isRegisterMode = false;
let isForgotMode = false;
let currentUserTenantId = null;

const urlParams = new URLSearchParams(window.location.search);
const paramTenantId = urlParams.get('tenant');
const paramReferrerUid = urlParams.get('ref');

if (paramTenantId || paramReferrerUid) {
    isRegisterMode = true;
    if(document.getElementById('register-fields')) document.getElementById('register-fields').classList.remove('hidden');
    if(document.getElementById('fullname')) document.getElementById('fullname').required = true;
    if(document.getElementById('phone')) document.getElementById('phone').required = true;
    if(document.getElementById('auth-title')) document.getElementById('auth-title').innerText = 'إنشاء حساب عميل جديد';
    if(document.getElementById('auth-btn')) document.getElementById('auth-btn').innerText = 'تسجيل وتفعيل الحساب';
    if(document.getElementById('toggle-auth-text')) document.getElementById('toggle-auth-text').innerText = 'لديك حساب بالفعل؟ سجل دخولك';
    if(document.getElementById('referral-banner')) document.getElementById('referral-banner').classList.remove('hidden');
}

window.toggleAuthMode = function() {
    isRegisterMode = !isRegisterMode;
    isForgotMode = false;
    if(document.getElementById('register-fields')) document.getElementById('register-fields').classList.toggle('hidden', !isRegisterMode);
    if(document.getElementById('password-field-container')) document.getElementById('password-field-container').classList.remove('hidden');
    if(document.getElementById('fullname')) document.getElementById('fullname').required = isRegisterMode;
    if(document.getElementById('phone')) document.getElementById('phone').required = isRegisterMode;
    if(document.getElementById('password')) document.getElementById('password').required = true;
    if(document.getElementById('auth-title')) document.getElementById('auth-title').innerText = isRegisterMode ? 'إنشاء حساب مركزي جديد' : 'تسجيل الدخول للنظام المركزي';
    if(document.getElementById('auth-btn')) document.getElementById('auth-btn').innerText = isRegisterMode ? 'تسجيل الحساب' : 'دخول';
    if(document.getElementById('toggle-auth-text')) document.getElementById('toggle-auth-text').innerText = isRegisterMode ? 'لديك حساب بالفعل؟ سجل دخولك' : 'ليس لديك حساب؟ انشئ حساباً كعميل جديد';
    if(document.getElementById('forgot-pass-btn')) document.getElementById('forgot-pass-btn').classList.remove('hidden');
};

window.toggleForgotPasswordMode = function() {
    isForgotMode = true;
    isRegisterMode = false;
    if(document.getElementById('register-fields')) document.getElementById('register-fields').classList.add('hidden');
    if(document.getElementById('password-field-container')) document.getElementById('password-field-container').classList.add('hidden');
    if(document.getElementById('password')) document.getElementById('password').required = false;
    if(document.getElementById('auth-title')) document.getElementById('auth-title').innerText = 'استعادة كلمة المرور';
    if(document.getElementById('auth-subtitle')) document.getElementById('auth-subtitle').innerText = 'نظام إدارة ولاء العملاء الذكي';
    if(document.getElementById('auth-btn')) document.getElementById('auth-btn').innerText = 'إرسال رابط الاستعادة';
    if(document.getElementById('toggle-auth-text')) document.getElementById('toggle-auth-text').innerText = 'العودة لتسجيل الدخول';
    if(document.getElementById('forgot-pass-btn')) document.getElementById('forgot-pass-btn').classList.add('hidden');
};

window.handleAuth = async function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    
    if (isForgotMode) {
        if (!email) return alert('الرجاء إدخال البريد الإلكتروني.');
        try {
            await sendPasswordResetEmail(auth, email);
            alert('تم إرسال رابط إعادة تعيين كلمة المرور وتنبيه الأمان إلى بريدك الإلكتروني بنجاح.');
            toggleAuthMode();
        } catch (err) {
            alert('خطأ: ' + err.message);
        }
        return;
    }

    const password = document.getElementById('password').value;

    try {
        if (isRegisterMode) {
            const name = document.getElementById('fullname').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const secondaryPhone = document.getElementById('secondary-phone').value.trim();
            if (!name || !phone) return alert('الرجاء إدخال الاسم الكامل ورقم الهاتف الأساسي.');

            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCred.user);

            const targetTenant = paramTenantId || "dody_rose";
            const referrerUid = paramReferrerUid || null;

            // تجهيز مصفوفة الصلاحيات الأولية للعميل الجديد
            const initialPermissions = [{
                facilityId: targetTenant,
                facilityName: 'المنشأة الرئيسية',
                role: 'customer'
            }];

            await setDoc(doc(db, "users", userCred.user.uid), {
                name,
                phone,
                secondaryPhone,
                email,
                role: 'customer',
                permissions: initialPermissions,
                isBlocked: false,
                registeredTenant: targetTenant,
                joinedTenants: [targetTenant],
                referredBy: referrerUid,
                gender: '',
                country: '',
                city: '',
                address: '',
                birthdate: '',
                anniversary: '',
                hobbies: '',
                createdAt: new Date().toISOString()
            });
            
            let welcomePts = 50;
            let referralPts = 25;
            const tenantDoc = await getDoc(doc(db, "tenants", targetTenant));
            if (tenantDoc.exists() && tenantDoc.data().loyaltyRules) {
                welcomePts = tenantDoc.data().loyaltyRules.welcomePoints ?? 50;
                referralPts = tenantDoc.data().loyaltyRules.referralPoints ?? 25;
            }

            await setDoc(doc(db, "tenants", targetTenant, "customers", userCred.user.uid), {
                name,
                phone,
                secondaryPhone,
                email,
                points: welcomePts,
                referredBy: referrerUid,
                gender: '',
                country: '',
                city: '',
                address: '',
                birthdate: '',
                anniversary: '',
                hobbies: '',
                lastVisit: new Date().toISOString()
            });

            if (referrerUid && referrerUid !== userCred.user.uid && referralPts > 0) {
                const refWalletRef = doc(db, "tenants", targetTenant, "customers", referrerUid);
                const refWalletSnap = await getDoc(refWalletRef);
                if (refWalletSnap.exists()) {
                    await updateDoc(refWalletRef, { points: increment(referralPts) });
                }
            }

            // إرسال البريد إلى تطبيق الأندرويد لتفعيل البصمة لاحقاً
            if (window.AndroidBridge && typeof window.AndroidBridge.saveUserEmail === 'function') {
                try {
                    window.AndroidBridge.saveUserEmail(email);
                } catch (bridgeErr) {
                    console.error("Bridge Error:", bridgeErr);
                }
            }

            alert('تم إنشاء الحساب بنجاح! تم إرسال رسالة تفعيل احترافية إلى بريدك الإلكتروني.');
        } else {
            // تسجيل الدخول العادي مع استدعاء نظام الصلاحيات المتعددة الذكي
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            // إرسال البريد إلى تطبيق الأندرويد لتفعيل البصمة لاحقاً عند نجاح الدخول
            if (window.AndroidBridge && typeof window.AndroidBridge.saveUserEmail === 'function') {
                try {
                    window.AndroidBridge.saveUserEmail(email);
                } catch (bridgeErr) {
                    console.error("Bridge Error:", bridgeErr);
                }
            }

            if (typeof window.handleUserLoginAndRoles === 'function') {
                await window.handleUserLoginAndRoles(userCredential);
            }
        }
    } catch (error) {
        alert('خطأ: ' + error.message);
    }
};

window.resendVerificationEmail = async function() {
    if (auth.currentUser) {
        try {
            await sendEmailVerification(auth.currentUser);
            alert('تم إعادة إرسال رابط التفعيل الاحترافي إلى بريدك الإلكتروني بنجاح.');
        } catch (err) {
            alert('تعذر الإرسال حالياً: ' + err.message);
        }
    }
};

window.checkEmailVerificationStatus = async function() {
    if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
            window.location.reload();
        } else {
            alert('لم يتم تفعيل البريد الإلكتروني بعد. الرجاء النقر على الرابط المرسل لبريدك.');
        }
    }
};

window.logout = function() { 
    signOut(auth); 
};

onAuthStateChanged(auth, async (user) => {
    const authSection = document.getElementById('auth-section');
    const verifySection = document.getElementById('verify-email-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const userInfo = document.getElementById('user-info');
    const roleBadge = document.getElementById('user-role-badge');

    if (user) {
        // تحديث إرسال البريد للأندرويد احتياطياً هنا أيضاً عند رصد حالة المستخدم المسجل
        if (user.email && window.AndroidBridge && typeof window.AndroidBridge.saveUserEmail === 'function') {
            try {
                window.AndroidBridge.saveUserEmail(user.email);
            } catch (e) {}
        }

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.isBlocked) { alert('الحساب محظور.'); signOut(auth); return; }

            // التحقق من الدور النشط الحالي في الجلسة أو الاعتماد على الدور الافتراضي
            let activeRole = localStorage.getItem("active_user_role") || data.role;
            let activeTenant = localStorage.getItem("active_facility_id") || data.tenantId || data.registeredTenant || "dody_rose";

            if (data.role === 'customer' && !user.emailVerified) {
                authSection.classList.add('hidden');
                dashboardSection.classList.add('hidden');
                userInfo.classList.add('hidden');
                verifySection.classList.remove('hidden');
                document.getElementById('verify-target-email').innerText = user.email;
                return;
            }

            verifySection.classList.add('hidden');
            authSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            userInfo.classList.remove('hidden');
            roleBadge.innerText = `الدور: ${activeRole} (${activeTenant})`;

            document.querySelectorAll('.role-view').forEach(el => el.classList.add('hidden'));
            
            if (activeRole === 'super_admin') {
                document.getElementById('super-admin-view').classList.remove('hidden');
                window.loadTenants();
                window.loadUsers();
            } else if (activeRole === 'tenant_admin' || activeRole === 'manager') {
                currentUserTenantId = activeTenant;
                document.getElementById('tenant-admin-view').classList.remove('hidden');
                window.loadTenantAdminData(currentUserTenantId);
            } else if (activeRole === 'cashier') {
                currentUserTenantId = activeTenant;
                document.getElementById('cashier-view').classList.remove('hidden');
                window.loadCashierDashboard(currentUserTenantId);
            } else {
                document.getElementById('customer-view').classList.remove('hidden');
                window.loadCustomerDashboard(user.uid);
            }
        }
    } else {
        verifySection.classList.add('hidden');
        authSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        userInfo.classList.add('hidden');
        currentUserTenantId = null;
        localStorage.clear(); // مسح السياق عند تسجيل الخروج
    }
});
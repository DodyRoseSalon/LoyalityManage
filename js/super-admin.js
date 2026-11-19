/**
 * نظام إدارة السوبر أدمن والصلاحيات المتعددة - Dody Rose Platform (النسخة الشاملة والتقارير)
 */

import { db, auth } from "./firebase-config.js";
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

let allTenantsData = [];
let allUsersCache = [];
let currentSuperReportFilter = 'all';

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS_BEFORE_EXPIRY = 3;

const SUBSCRIPTION_PLANS = {
    lifetime: {
        key: 'lifetime',
        label: 'اشتراك دائم',
        durationDays: null,
        graceDays: 0,
        isTrial: false,
        isLifetime: true,
        billingCycle: 'lifetime'
    },
    quarterly_90: {
        key: 'quarterly_90',
        label: 'ثلاثة أشهر (7 أيام سماح)',
        durationDays: 90,
        graceDays: 7,
        isTrial: false,
        isLifetime: false,
        billingCycle: 'quarterly'
    },
    monthly_30: {
        key: 'monthly_30',
        label: 'شهر (3 أيام سماح)',
        durationDays: 30,
        graceDays: 3,
        isTrial: false,
        isLifetime: false,
        billingCycle: 'monthly'
    },
    trial_30: {
        key: 'trial_30',
        label: 'شهر تجريبي',
        durationDays: 30,
        graceDays: 0,
        isTrial: true,
        isLifetime: false,
        billingCycle: 'trial'
    },
    trial_14: {
        key: 'trial_14',
        label: '14 يوم تجريبي',
        durationDays: 14,
        graceDays: 0,
        isTrial: true,
        isLifetime: false,
        billingCycle: 'trial'
    },
    trial_7: {
        key: 'trial_7',
        label: '7 أيام تجريبي',
        durationDays: 7,
        graceDays: 0,
        isTrial: true,
        isLifetime: false,
        billingCycle: 'trial'
    }
};

function getPlanConfig(planKey) {
    return SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.monthly_30;
}

// ==========================================
// أداة توليد أرقام المعرفات تلقائياً
// ==========================================
window.generateNextTenantId = function(setInput = true) {
    const usedIds = new Set(
        allTenantsData
            .map(t => String(t.id || '').trim())
            .filter(id => /^[0-9]+$/.test(id))
    );

    let maxNum = 1000;
    usedIds.forEach(id => {
        const num = parseInt(id, 10);
        if (!Number.isNaN(num) && num >= maxNum) {
            maxNum = num;
        }
    });

    let candidate = maxNum + 1;
    while (usedIds.has(String(candidate))) {
        candidate++;
    }

    const nextId = String(candidate);
    const inputEl = document.getElementById('tenant-id-input');
    if (setInput && inputEl) {
        inputEl.value = nextId;
    }
    return nextId;
};

function ensureAutoIdGeneratorButton() {
    const inputEl = document.getElementById('tenant-id-input');
    if (!inputEl || document.getElementById('auto-generate-tenant-id-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'auto-generate-tenant-id-btn';
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles ml-1"></i> توليد رقم تلقائي';
    btn.className = 'mt-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center';
    btn.onclick = () => window.generateNextTenantId(true);

    inputEl.insertAdjacentElement('afterend', btn);
    if (!inputEl.value.trim()) {
        window.generateNextTenantId(true);
    }
}

// ==========================================
// منطق الباقات الست وفترة السماح وإشعارات النهاية
// ==========================================
function computeSubscriptionState(tenantData, nowMs = Date.now()) {
    const planKey = tenantData.plan || tenantData.planKey || 'monthly_30';
    const planCfg = getPlanConfig(planKey);

    if (planCfg.isLifetime || tenantData.isLifetime || !tenantData.expiresAt) {
        if (planCfg.isLifetime || tenantData.isLifetime) {
            return {
                planKey: planCfg.key,
                planLabel: planCfg.label,
                isMonthly: false,
                isTrial: false,
                isLifetime: true,
                graceDays: 0,
                expiresAtMs: null,
                graceEndMs: null,
                daysUntilExpiry: null,
                isNearExpiry: false,
                shouldDeactivate: false,
                inGracePeriod: false,
                needsPreExpiryReminder: false,
                needsExpiryNotification: false,
                statusLabel: tenantData.isActive !== false ? 'نشط (اشتراك دائم)' : 'موقوف يدوياً',
                statusType: tenantData.isActive !== false ? 'active' : 'inactive'
            };
        }

        return {
            planKey: planCfg.key,
            planLabel: planCfg.label,
            isMonthly: planCfg.billingCycle === 'monthly' || planCfg.billingCycle === 'quarterly',
            isTrial: planCfg.isTrial,
            isLifetime: false,
            graceDays: planCfg.graceDays,
            expiresAtMs: null,
            graceEndMs: null,
            daysUntilExpiry: null,
            isNearExpiry: false,
            shouldDeactivate: false,
            inGracePeriod: false,
            needsPreExpiryReminder: false,
            needsExpiryNotification: false,
            statusLabel: tenantData.isActive !== false ? 'نشط' : 'موقوف',
            statusType: tenantData.isActive !== false ? 'active' : 'inactive'
        };
    }

    const expiresAtMs = new Date(tenantData.expiresAt).getTime();
    if (Number.isNaN(expiresAtMs)) {
        return {
            planKey: planCfg.key,
            planLabel: planCfg.label,
            isMonthly: false,
            isTrial: planCfg.isTrial,
            isLifetime: false,
            graceDays: planCfg.graceDays,
            expiresAtMs: null,
            graceEndMs: null,
            daysUntilExpiry: null,
            isNearExpiry: false,
            shouldDeactivate: false,
            inGracePeriod: false,
            needsPreExpiryReminder: false,
            needsExpiryNotification: false,
            statusLabel: tenantData.isActive !== false ? 'نشط' : 'موقوف',
            statusType: tenantData.isActive !== false ? 'active' : 'inactive'
        };
    }

    const graceDays = typeof tenantData.graceDays === 'number' ? tenantData.graceDays : planCfg.graceDays;
    const graceEndMs = expiresAtMs + (graceDays * DAY_MS);
    const msUntilExpiry = expiresAtMs - nowMs;
    const daysUntilExpiry = msUntilExpiry / DAY_MS;

    // 1. قبل انتهاء المدة الأساسية للاشتراك أو التجربة
    if (nowMs < expiresAtMs) {
        const daysLeft = Math.max(1, Math.ceil(daysUntilExpiry));
        const isNearExpiry = daysLeft <= REMINDER_DAYS_BEFORE_EXPIRY;
        const needsPreExpiryReminder = isNearExpiry && !tenantData.preExpiryNotifiedForCycle;

        return {
            planKey: planCfg.key,
            planLabel: planCfg.label,
            isMonthly: planCfg.billingCycle === 'monthly' || planCfg.billingCycle === 'quarterly',
            isTrial: planCfg.isTrial,
            isLifetime: false,
            graceDays,
            expiresAtMs,
            graceEndMs,
            daysUntilExpiry,
            isNearExpiry,
            shouldDeactivate: false,
            inGracePeriod: false,
            needsPreExpiryReminder,
            needsExpiryNotification: false,
            statusLabel: tenantData.isActive !== false
                ? (isNearExpiry ? `قريب الانتهاء (${daysLeft} يوم)` : (planCfg.isTrial ? `تجريبي نشط (${daysLeft} يوم)` : `نشط (${daysLeft} يوم)`))
                : 'موقوف',
            statusType: tenantData.isActive !== false ? 'active' : 'inactive'
        };
    }

    // 2. بعد انتهاء المدة الأساسية وضمن فترة السماح (للباقات التي لها أيام سماح فقط)
    if (graceDays > 0 && nowMs < graceEndMs) {
        const remainingGraceDays = Math.max(1, Math.ceil((graceEndMs - nowMs) / DAY_MS));
        return {
            planKey: planCfg.key,
            planLabel: planCfg.label,
            isMonthly: true,
            isTrial: false,
            isLifetime: false,
            graceDays,
            expiresAtMs,
            graceEndMs,
            daysUntilExpiry,
            isNearExpiry: true,
            shouldDeactivate: false,
            inGracePeriod: true,
            needsPreExpiryReminder: false,
            needsExpiryNotification: !tenantData.expiryNotifiedForCycle,
            statusLabel: `انتهى الاشتراك — فترة سماح (${remainingGraceDays} يوم)`,
            statusType: 'grace'
        };
    }

    // 3. الوصول لنهاية الاشتراك أو نهاية فترة السماح (أو نهاية الباقة التجريبية)
    return {
        planKey: planCfg.key,
        planLabel: planCfg.label,
        isMonthly: planCfg.billingCycle === 'monthly' || planCfg.billingCycle === 'quarterly',
        isTrial: planCfg.isTrial,
        isLifetime: false,
        graceDays,
        expiresAtMs,
        graceEndMs,
        daysUntilExpiry,
        isNearExpiry: false,
        shouldDeactivate: true,
        inGracePeriod: false,
        needsPreExpiryReminder: false,
        needsExpiryNotification: !tenantData.expiryNotifiedForCycle,
        statusLabel: 'منتهي / موقوف',
        statusType: 'inactive'
    };
}

async function recordSubscriptionNotification(tenantId, tenantData, subState, mode = 'pre_expiry') {
    const targetEmail = tenantData.managerEmail || tenantData.contactEmail || '';
    const businessName = tenantData.businessName || tenantData.name || tenantId;
    const expDateStr = subState.expiresAtMs ? new Date(subState.expiresAtMs).toLocaleDateString('ar-SA') : '--';
    const graceEndStr = (subState.graceDays > 0 && subState.graceEndMs)
        ? new Date(subState.graceEndMs).toLocaleDateString('ar-SA')
        : null;

    let type = 'pre_expiry_3_days';
    let message = `تنبيه: اشتراك منشأة (${businessName}) ضمن باقة (${subState.planLabel}) ينتهي بتاريخ ${expDateStr}.`;

    if (mode === 'grace_started') {
        type = 'subscription_ended_grace_period';
        message = `إشعار نهاية الاشتراك: وصلت منشأة (${businessName}) إلى نهاية مدة باقة (${subState.planLabel}) بتاريخ ${expDateStr}، وهي الآن ضمن فترة السماح (${subState.graceDays} أيام) حتى تاريخ ${graceEndStr} قبل الإيقاف التلقائي.`;
    } else if (mode === 'expired_deactivated') {
        type = 'subscription_ended_deactivated';
        message = subState.graceDays > 0
            ? `إشعار انتهاء الاشتراك والإيقاف: وصلت منشأة (${businessName}) ضمن باقة (${subState.planLabel}) إلى نهاية فترة السماح بتاريخ ${graceEndStr} وتم إيقاف المنشأة تلقائياً لحين التجديد.`
            : `إشعار نهاية الاشتراك والإيقاف: وصلت منشأة (${businessName}) إلى نهاية مدة باقة (${subState.planLabel}) بتاريخ ${expDateStr} وتم إيقاف المنشأة تلقائياً لحين التجديد.`;
    }

    const notifRef = doc(collection(db, "subscription_notifications"));
    await setDoc(notifRef, {
        tenantId,
        businessName,
        planKey: subState.planKey,
        planLabel: subState.planLabel,
        recipientEmail: targetEmail,
        type,
        expiresAt: subState.expiresAtMs ? new Date(subState.expiresAtMs).toISOString() : null,
        graceEndAt: subState.graceEndMs ? new Date(subState.graceEndMs).toISOString() : null,
        message,
        createdAt: new Date().toISOString(),
        status: targetEmail ? 'queued_for_email' : 'missing_manager_email'
    });

    const tenantUpdates = {
        lastNotificationMessage: message,
        lastNotificationAt: new Date().toISOString()
    };

    if (mode === 'pre_expiry') {
        tenantUpdates.preExpiryNotifiedForCycle = true;
    } else if (mode === 'grace_started' || mode === 'expired_deactivated') {
        tenantUpdates.expiryNotifiedForCycle = true;
    }

    await updateDoc(doc(db, "tenants", tenantId), tenantUpdates);
    Object.assign(tenantData, tenantUpdates);
}

window.runSubscriptionLifecycleCheck = async function(showSummaryAlert = false) {
    const nowMs = Date.now();
    let deactivatedCount = 0;
    let notificationsCount = 0;
    const endedNotices = [];

    for (const tenant of allTenantsData) {
        const state = computeSubscriptionState(tenant, nowMs);

        if (state.needsPreExpiryReminder) {
            await recordSubscriptionNotification(tenant.id, tenant, state, 'pre_expiry');
            notificationsCount++;
        }

        if (state.shouldDeactivate) {
            if (state.needsExpiryNotification) {
                await recordSubscriptionNotification(tenant.id, tenant, state, 'expired_deactivated');
                notificationsCount++;
            }
            if (tenant.isActive !== false) {
                await updateDoc(doc(db, "tenants", tenant.id), {
                    isActive: false,
                    deactivatedAt: new Date().toISOString(),
                    deactivationReason: state.planKey === 'quarterly_90'
                        ? 'quarterly_grace_period_ended'
                        : (state.planKey === 'monthly_30' ? 'monthly_grace_period_ended' : 'trial_period_ended')
                });
                tenant.isActive = false;
                deactivatedCount++;
            }
            endedNotices.push(`• ${tenant.businessName || tenant.name || tenant.id} (${state.planLabel}): تم الوصول لنهاية الاشتراك وإيقاف الحساب.`);
        } else if (state.inGracePeriod && state.needsExpiryNotification) {
            await recordSubscriptionNotification(tenant.id, tenant, state, 'grace_started');
            notificationsCount++;
            endedNotices.push(`• ${tenant.businessName || tenant.name || tenant.id} (${state.planLabel}): وصل إلى نهاية الاشتراك وهو الآن ضمن فترة السماح (${state.graceDays} أيام).`);
        }
    }

    if (showSummaryAlert) {
        const noticesBlock = endedNotices.length ? `\n\nإشعارات نهاية الاشتراك:\n${endedNotices.join('\n')}` : '';
        alert(`تم فحص الاشتراكات: تم إيقاف (${deactivatedCount}) منشأة منتهية، وتسجيل (${notificationsCount}) إشعار.${noticesBlock}`);
        if (typeof window.loadTenants === 'function') {
            await window.loadTenants();
        }
    }
};

// ==========================================
// تقرير السوبر أدمن: المنشآت والاشتراكات والتنبيهات
// ==========================================
window.renderSuperAdminReportsSummary = function(filterMode = currentSuperReportFilter) {
    currentSuperReportFilter = filterMode;
    const reportBox = document.getElementById('super-admin-reports-box');
    if (!reportBox) return;

    const nowMs = Date.now();
    const enriched = allTenantsData.map(t => ({ tenant: t, sub: computeSubscriptionState(t, nowMs) }));

    const activeCount = enriched.filter(x => x.tenant.isActive && x.sub.statusType === 'active').length;
    const graceCount = enriched.filter(x => x.tenant.isActive && x.sub.statusType === 'grace').length;
    const nearExpiryCount = enriched.filter(x => x.sub.isNearExpiry && !x.sub.inGracePeriod).length;
    const inactiveCount = enriched.filter(x => !x.tenant.isActive || x.sub.statusType === 'inactive').length;

    const endNotifications = enriched
        .filter(x => x.sub.inGracePeriod || x.sub.shouldDeactivate || x.tenant.lastNotificationMessage)
        .slice(0, 6);

    let filteredList = enriched;
    if (filterMode === 'active') {
        filteredList = enriched.filter(x => x.tenant.isActive && x.sub.statusType === 'active');
    } else if (filterMode === 'grace') {
        filteredList = enriched.filter(x => x.tenant.isActive && x.sub.statusType === 'grace');
    } else if (filterMode === 'near_expiry') {
        filteredList = enriched.filter(x => x.sub.isNearExpiry && !x.sub.inGracePeriod);
    } else if (filterMode === 'inactive') {
        filteredList = enriched.filter(x => !x.tenant.isActive || x.sub.statusType === 'inactive');
    }

    const filterLabelMap = {
        all: 'تقرير جميع المنشآت والاشتراكات',
        active: 'تقرير المنشآت النشطة',
        grace: 'تقرير المنشآت في فترة السماح',
        near_expiry: 'تقرير الاشتراكات القريبة من الانتهاء (خلال 3 أيام)',
        inactive: 'تقرير المنشآت الموقوفة والمنتهية'
    };

    let rowsHtml = '';
    if (filteredList.length === 0) {
        rowsHtml = '<tr><td colspan="5" class="p-4 text-center text-gray-400">لا توجد منشآت ضمن هذا التصنيف حالياً.</td></tr>';
    } else {
        filteredList.forEach(({ tenant, sub }) => {
            const name = tenant.businessName || tenant.name || '--';
            const expStr = sub.isLifetime
                ? 'بدون انتهاء (دائم)'
                : (tenant.expiresAt ? new Date(tenant.expiresAt).toLocaleDateString('ar-SA') : '--');
            const graceStr = sub.isLifetime
                ? 'لا ينطبق'
                : ((sub.graceDays > 0 && sub.graceEndMs)
                    ? `${new Date(sub.graceEndMs).toLocaleDateString('ar-SA')} (${sub.graceDays} أيام)`
                    : 'لا يوجد (إيقاف مباشر)');
            rowsHtml += `
                <tr class="hover:bg-gray-50 text-xs">
                    <td class="p-2.5 font-bold text-gray-800">${name} <span class="font-mono text-indigo-600">(${tenant.id})</span></td>
                    <td class="p-2.5">${sub.planLabel} • ${tenant.currency || 'ريال'}</td>
                    <td class="p-2.5 font-semibold">${sub.statusLabel}</td>
                    <td class="p-2.5">${expStr}</td>
                    <td class="p-2.5 text-gray-500">${graceStr}</td>
                </tr>
            `;
        });
    }

    const noticesHtml = endNotifications.length > 0
        ? `<div class="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
            <div class="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                <i class="fa-solid fa-bell"></i>
                <span>إشعارات نهاية الاشتراك وفترة السماح</span>
            </div>
            <ul class="text-[11px] text-amber-900 space-y-1 pr-3 list-disc">
                ${endNotifications.map(({ tenant, sub }) => {
                    const msg = tenant.lastNotificationMessage ||
                        (sub.shouldDeactivate
                            ? `منشأة (${tenant.businessName || tenant.name || tenant.id}) وصلت لنهاية باقة (${sub.planLabel}) وتم إيقافها.`
                            : `منشأة (${tenant.businessName || tenant.name || tenant.id}) وصلت لنهاية باقة (${sub.planLabel}) وهي ضمن فترة السماح.`);
                    return `<li>${msg}</li>`;
                }).join('')}
            </ul>
        </div>`
        : '';

    reportBox.innerHTML = `
        <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <div>
                    <h4 class="font-extrabold text-sm text-indigo-950">${filterLabelMap[filterMode] || filterLabelMap.all}</h4>
                    <p class="text-[11px] text-gray-500">إجمالي السجلات المعروضة: ${filteredList.length} من أصل ${allTenantsData.length} منشأة</p>
                </div>
                <button type="button" onclick="window.exportSuperAdminTenantsCSV()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5">
                    <i class="fa-solid fa-file-csv"></i>
                    <span>تصدير التقرير CSV</span>
                </button>
            </div>

            ${noticesHtml}

            <div class="grid grid-cols-2 md:grid-cols-5 gap-2 text-right">
                <button type="button" onclick="window.renderSuperAdminReportsSummary('all')" class="p-2.5 rounded-xl border text-xs transition cursor-pointer ${filterMode === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 hover:bg-gray-100 text-gray-800'}">
                    <div class="font-bold">الكل</div>
                    <div class="text-sm font-extrabold mt-0.5">${allTenantsData.length}</div>
                </button>
                <button type="button" onclick="window.renderSuperAdminReportsSummary('active')" class="p-2.5 rounded-xl border text-xs transition cursor-pointer ${filterMode === 'active' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50/60 hover:bg-emerald-100 text-emerald-900'}">
                    <div class="font-bold">نشط</div>
                    <div class="text-sm font-extrabold mt-0.5">${activeCount}</div>
                </button>
                <button type="button" onclick="window.renderSuperAdminReportsSummary('near_expiry')" class="p-2.5 rounded-xl border text-xs transition cursor-pointer ${filterMode === 'near_expiry' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50/70 hover:bg-amber-100 text-amber-900'}">
                    <div class="font-bold">قريب الانتهاء</div>
                    <div class="text-sm font-extrabold mt-0.5">${nearExpiryCount}</div>
                </button>
                <button type="button" onclick="window.renderSuperAdminReportsSummary('grace')" class="p-2.5 rounded-xl border text-xs transition cursor-pointer ${filterMode === 'grace' ? 'bg-orange-600 text-white border-orange-600' : 'bg-orange-50/70 hover:bg-orange-100 text-orange-900'}">
                    <div class="font-bold">فترة سماح</div>
                    <div class="text-sm font-extrabold mt-0.5">${graceCount}</div>
                </button>
                <button type="button" onclick="window.renderSuperAdminReportsSummary('inactive')" class="p-2.5 rounded-xl border text-xs transition cursor-pointer ${filterMode === 'inactive' ? 'bg-red-600 text-white border-red-600' : 'bg-red-50/60 hover:bg-red-100 text-red-900'}">
                    <div class="font-bold">موقوف / منتهي</div>
                    <div class="text-sm font-extrabold mt-0.5">${inactiveCount}</div>
                </button>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-right border-collapse">
                    <thead>
                        <tr class="bg-gray-50 border-b text-[11px] text-gray-600">
                            <th class="p-2.5">المنشأة</th>
                            <th class="p-2.5">الباقة والعملة</th>
                            <th class="p-2.5">حالة الاشتراك</th>
                            <th class="p-2.5">تاريخ الانتهاء</th>
                            <th class="p-2.5">نهاية فترة السماح</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">${rowsHtml}</tbody>
                </table>
            </div>
        </div>
    `;
};

window.exportSuperAdminTenantsCSV = function() {
    if (!allTenantsData.length) return alert('لا توجد بيانات منشآت لتصديرها.');
    const nowMs = Date.now();
    const headers = ['المعرف', 'اسم المنشأة', 'بريد المدير', 'الدولة', 'العملة', 'الباقة', 'الحالة', 'تاريخ الانتهاء'];
    const lines = [headers.join(',')];

    allTenantsData.forEach(t => {
        const sub = computeSubscriptionState(t, nowMs);
        const row = [
            `"${String(t.id || '').replace(/"/g, '""')}"`,
            `"${String(t.businessName || t.name || '').replace(/"/g, '""')}"`,
            `"${String(t.managerEmail || '').replace(/"/g, '""')}"`,
            `"${String(t.country || '').replace(/"/g, '""')}"`,
            `"${String(t.currency || '').replace(/"/g, '""')}"`,
            `"${String(sub.planLabel || '').replace(/"/g, '""')}"`,
            `"${String(sub.statusLabel || '').replace(/"/g, '""')}"`,
            `"${sub.isLifetime ? 'دائم' : (t.expiresAt ? new Date(t.expiresAt).toISOString().slice(0, 10) : '')}"`
        ];
        lines.push(row.join(','));
    });

    const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `super_admin_tenants_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

// ==========================================
// 1. نظام تسجيل الدخول ومعالجة الصلاحيات المتعددة
// ==========================================
window.handleUserLoginAndRoles = async function(userCredential) {
    try {
        const user = userCredential.user;
        const uid = user.uid;

        const userDocRef = doc(db, "users", uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
            alert("خطأ: حساب المستخدم غير مسجل في قاعدة البيانات.");
            return;
        }

        const userData = userSnap.data();
        let permissions = userData.permissions || [];
        if (permissions.length === 0 && userData.role) {
            permissions = [{
                facilityId: userData.tenantId || userData.registeredTenant || 'main',
                facilityName: userData.facilityName || 'المنشأة الرئيسية',
                role: userData.role
            }];
        }

        localStorage.setItem("current_user_uid", uid);
        localStorage.setItem("current_user_email", userData.email);
        localStorage.setItem("current_user_name", userData.name || "مستخدم");
        localStorage.setItem("user_permissions", JSON.stringify(permissions));

        if (permissions.length === 0) {
            alert("لا توجد أي صلاحيات مرتبطة بهذا الحساب. يرجى مراجعة الإدارة.");
            return;
        } else if (permissions.length === 1) {
            activateRoleAndRedirect(permissions[0]);
        } else {
            showRoleSelectionModal(permissions);
        }

    } catch (error) {
        console.error("خطأ أثناء تسجيل الدخول ومعالجة الصلاحيات:", error);
        alert("حدث خطأ غير متوقع أثناء تسجيل الدخول.");
    }
};

function showRoleSelectionModal(permissions) {
    let modal = document.getElementById("roleSwitcherModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "roleSwitcherModal";
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:9999;";
        document.body.appendChild(modal);
    }

    let optionsHtml = `
        <div style="background:#fff; padding:30px; border-radius:12px; width:90%; max-width:450px; box-shadow:0 5px 15px rgba(0,0,0,0.3); font-family:'Cairo', Tahoma, sans-serif; direction:rtl; text-align:right;">
            <h3 style="margin-top:0; color:#333; border-bottom:2px solid #eee; padding-bottom:10px; font-weight:bold;">اختر وضع الدخول الحالي</h3>
            <p style="color:#666; font-size:14px; margin-top:8px;">لديك عدة صلاحيات مرتبطة بحسابك، يرجى اختيار الصفة التي تريد العمل بها اليوم:</p>
            <div style="max-height:250px; overflow-y:auto; margin:15px 0;">
    `;

    permissions.forEach((perm, index) => {
        let roleNameArabic = getArabicRoleName(perm.role);
        let badgeColor = getRoleBadgeColor(perm.role);
        
        optionsHtml += `
            <div onclick="selectUserRole(${index})" style="background:#f9f9f9; border:1px solid #ddd; padding:12px; margin-bottom:8px; border-radius:8px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='#f1f1f1'" onmouseout="this.style.background='#f9f9f9'">
                <div style="font-weight:bold; color:#222; font-size:16px;">${perm.facilityName || 'منشأة تجارية'}</div>
                <div style="margin-top:5px;">
                    <span style="background:${badgeColor}; color:#fff; padding:3px 8px; border-radius:4px; font-size:12px;">${roleNameArabic}</span>
                    <span style="color:#888; font-size:12px; margin-right:8px;">ID: ${perm.facilityId}</span>
                </div>
            </div>
        `;
    });

    optionsHtml += `</div></div>`;
    modal.innerHTML = optionsHtml;
    window.tempUserPermissions = permissions;
}

window.selectUserRole = function(index) {
    const permissions = window.tempUserPermissions;
    if (!permissions || !permissions[index]) return;
    activateRoleAndRedirect(permissions[index]);
};

function activateRoleAndRedirect(perm) {
    localStorage.setItem("active_facility_id", perm.facilityId);
    localStorage.setItem("active_facility_name", perm.facilityName || "");
    localStorage.setItem("active_user_role", perm.role);

    const modal = document.getElementById("roleSwitcherModal");
    if (modal) modal.remove();

    window.location.reload();
}

function getArabicRoleName(role) {
    switch (role) {
        case 'super_admin': return 'مشرف عام (سوبر أدمن)';
        case 'manager':
        case 'tenant_admin': return 'مدير منشأة';
        case 'cashier': return 'كاشير';
        case 'customer': return 'عميل';
        default: return role;
    }
}

function getRoleBadgeColor(role) {
    switch (role) {
        case 'super_admin': return '#d9534f';
        case 'manager':
        case 'tenant_admin': return '#0275d8';
        case 'cashier': return '#f0ad4e';
        case 'customer': return '#5cb85c';
        default: return '#6c757d';
    }
}

// ==========================================
// 2. إدارة المنشآت (Tenants)
// ==========================================
window.loadTenants = async function() {
    const listEl = document.getElementById('tenants-list');
    const selectEl = document.getElementById('admin-tenant-select');
    const assignSelectEl = document.getElementById('assign-facility-id');
    if (!listEl) return;

    const snap = await getDocs(collection(db, "tenants"));
    allTenantsData = [];

    if (snap.empty) {
        listEl.innerHTML = '<p class="text-gray-400 py-4">لا توجد منشآت مسجلة حالياً.</p>';
        if (selectEl) selectEl.innerHTML = '<option value="">لا توجد منشآت متاحة</option>';
        if (assignSelectEl) assignSelectEl.innerHTML = '<option value="">لا توجد منشآت متاحة</option>';
        if (document.getElementById('stat-total-tenants')) document.getElementById('stat-total-tenants').innerText = 0;
        if (document.getElementById('stat-active-tenants')) document.getElementById('stat-active-tenants').innerText = 0;
        if (document.getElementById('stat-trial-tenants')) document.getElementById('stat-trial-tenants').innerText = 0;
        if (document.getElementById('stat-inactive-tenants')) document.getElementById('stat-inactive-tenants').innerText = 0;
        window.renderSuperAdminReportsSummary(currentSuperReportFilter);
        ensureAutoIdGeneratorButton();
        return;
    }

    let selectHtml = '<option value="">-- اختر المنشأة --</option>';

    snap.forEach((d) => {
        const data = d.data();
        allTenantsData.push({ id: d.id, ...data });
        selectHtml += `<option value="${d.id}">${data.businessName || data.name} (${data.country || 'السعودية'})</option>`;
    });

    await window.runSubscriptionLifecycleCheck(false);

    let total = 0, active = 0, trial = 0, inactive = 0;
    allTenantsData.forEach((t) => {
        total++;
        const sub = computeSubscriptionState(t);
        if (sub.isTrial) trial++;
        if (t.isActive && sub.statusType !== 'inactive') {
            active++;
        } else {
            inactive++;
        }
    });

    renderTenantsTable(allTenantsData);
    window.renderSuperAdminReportsSummary(currentSuperReportFilter);
    if (selectEl) selectEl.innerHTML = selectHtml;
    if (assignSelectEl) assignSelectEl.innerHTML = selectHtml;
    
    if(document.getElementById('stat-total-tenants')) document.getElementById('stat-total-tenants').innerText = total;
    if(document.getElementById('stat-active-tenants')) document.getElementById('stat-active-tenants').innerText = active;
    if(document.getElementById('stat-trial-tenants')) document.getElementById('stat-trial-tenants').innerText = trial;
    if(document.getElementById('stat-inactive-tenants')) document.getElementById('stat-inactive-tenants').innerText = inactive;

    ensureAutoIdGeneratorButton();
};

window.filterTenants = function() {
    const searchInput = document.getElementById('search-tenants-input');
    const statusFilterEl = document.getElementById('filter-tenants-status');
    if (!searchInput || !statusFilterEl) return;

    const search = searchInput.value.toLowerCase();
    const statusFilter = statusFilterEl.value;

    const filtered = allTenantsData.filter(t => {
        const bName = t.businessName || t.name || '';
        const matchSearch = bName.toLowerCase().includes(search) || String(t.id).toLowerCase().includes(search) || (t.country && t.country.toLowerCase().includes(search));
        const sub = computeSubscriptionState(t);
        const matchStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && t.isActive && sub.statusType === 'active') ||
            (statusFilter === 'grace' && t.isActive && sub.statusType === 'grace') ||
            (statusFilter === 'inactive' && (!t.isActive || sub.statusType === 'inactive'));
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
            <th class="p-3">اسم المنشأة</th><th class="p-3">المعرف والدولة</th><th class="p-3">الباقة والعملة</th><th class="p-3">الحالة والانتهاء</th><th class="p-3">إجراءات</th>
        </tr></thead><tbody class="divide-y divide-gray-100">`;

    tenants.forEach(data => {
        const sub = computeSubscriptionState(data);
        const planBadge = sub.isLifetime
            ? '<span class="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-semibold">اشتراك دائم</span>'
            : (sub.isTrial
                ? '<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-semibold">تجريبي / مجاني</span>'
                : '<span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">مدفوع</span>');

        let statusBadge = '<span class="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs font-bold">موقوف</span>';
        if (data.isActive && sub.statusType === 'grace') {
            statusBadge = `<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-bold">${sub.statusLabel}</span>`;
        } else if (data.isActive && sub.statusType === 'active') {
            statusBadge = `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">${sub.statusLabel}</span>`;
        }

        const expFormatted = sub.isLifetime
            ? 'دائم (لا ينتهي)'
            : (data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('ar-SA') : '--');
        const bName = data.businessName || data.name || '--';
        html += `<tr class="hover:bg-gray-50">
            <td class="p-3 font-semibold">${bName}</td>
            <td class="p-3 text-xs"><span class="font-mono text-indigo-600">${data.id}</span><br><span class="text-gray-500">${data.country || 'المملكة العربية السعودية'}</span></td>
            <td class="p-3 text-xs">${planBadge} <span class="font-semibold">${sub.planLabel}</span> (${data.currency || 'ريال'})</td>
            <td class="p-3 text-xs">${statusBadge}<br><span class="text-[11px] text-gray-500">ينتهي: ${expFormatted}</span></td>
            <td class="p-3 flex gap-1.5 flex-wrap">
                <button onclick="toggleTenantStatus('${data.id}', ${Boolean(data.isActive)})" class="px-2 py-1 rounded text-xs text-white ${data.isActive ? 'bg-amber-500' : 'bg-emerald-600'} cursor-pointer">${data.isActive ? 'إيقاف' : 'تنشيط'}</button>
                <button onclick="extendTenantDays('${data.id}', 30)" class="px-2 py-1 rounded text-xs bg-indigo-100 text-indigo-700 cursor-pointer">+30 يوم</button>
                <button onclick="window.previewTenantTheme('${data.theme || 'indigo'}')" class="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700 cursor-pointer">معاينة السكيم</button>
                <button onclick="deleteTenant('${data.id}', '${bName}')" class="px-2 py-1 rounded text-xs bg-red-100 text-red-700 cursor-pointer">حذف</button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    listEl.innerHTML = html;
}

window.createTenant = async function(event) {
    event.preventDefault();
    const tenantIdInput = document.getElementById('tenant-id-input');
    const tenantNameInput = document.getElementById('tenant-name-input');
    const managerEmailInput = document.getElementById('tenant-manager-email-input');
    const countryInput = document.getElementById('tenant-country-input');
    const currencyInput = document.getElementById('tenant-currency-input');
    const planInput = document.getElementById('tenant-plan-input');
    const themeInput = document.getElementById('tenant-theme-input');

    if (!tenantIdInput || !tenantNameInput) return;

    let tenantId = tenantIdInput.value.trim();
    if (!/^[0-9]+$/.test(tenantId)) {
        tenantId = window.generateNextTenantId(false);
    }

    const businessName = tenantNameInput.value.trim();
    const managerEmail = managerEmailInput ? managerEmailInput.value.trim().toLowerCase() : '';
    const country = countryInput ? countryInput.value : "المملكة العربية السعودية";
    const currency = currencyInput ? currencyInput.value : "ريال سعودي";
    const planKey = planInput ? planInput.value : "monthly_30";
    const theme = themeInput ? themeInput.value : "indigo";

    const planCfg = getPlanConfig(planKey);
    const now = new Date();
    const expiresAt = planCfg.isLifetime || planCfg.durationDays === null
        ? null
        : new Date(now.getTime() + (planCfg.durationDays * DAY_MS)).toISOString();

    try {
        const tenantRef = doc(db, "tenants", tenantId);
        const tenantSnap = await getDoc(tenantRef);

        if (tenantSnap.exists()) {
            const suggestedId = window.generateNextTenantId(true);
            alert(`خطأ: معرف المنشأة (${tenantId}) موجود مسبقاً. تم توليد المعرف الرقمي التالي تلقائياً (${suggestedId}) في الحقل.`);
            return;
        }

        await setDoc(tenantRef, {
            businessName,
            name: businessName,
            managerEmail,
            country,
            currency,
            plan: planCfg.key,
            planLabel: planCfg.label,
            billingCycle: planCfg.billingCycle,
            graceDays: planCfg.graceDays,
            theme,
            isActive: true,
            isTrial: planCfg.isTrial,
            isLifetime: planCfg.isLifetime,
            expiresAt,
            preExpiryNotifiedForCycle: false,
            expiryNotifiedForCycle: false,
            createdAt: now.toISOString()
        });

        alert(`تم إنشاء المنشأة بنجاح بالمعرف الرقمي (${tenantId}) وتحديد الباقة (${planCfg.label}) وهويتها البصرية!`);
        tenantNameInput.value = '';
        if (managerEmailInput) managerEmailInput.value = '';
        if (typeof window.loadTenants === 'function') {
            await window.loadTenants();
            window.generateNextTenantId(true);
        }
    } catch (err) {
        console.error("Error creating tenant:", err);
        alert('حدث خطأ أثناء إنشاء المنشأة: ' + err.message);
    }
};

window.toggleTenantStatus = async function(tenantId, currentStatus) {
    const nextActive = !currentStatus;
    const updates = { isActive: nextActive };
    if (nextActive) {
        updates.preExpiryNotifiedForCycle = false;
        updates.expiryNotifiedForCycle = false;
        updates.reactivatedAt = new Date().toISOString();
    }
    await updateDoc(doc(db, "tenants", tenantId), updates);
    if (typeof window.loadTenants === 'function') window.loadTenants();
};

window.extendTenantDays = async function(tenantId, days) {
    const tDoc = await getDoc(doc(db, "tenants", tenantId));
    if (!tDoc.exists()) return;
    const data = tDoc.data();
    let currentExp = data.expiresAt ? new Date(data.expiresAt) : new Date();
    if (currentExp < new Date()) currentExp = new Date();
    currentExp.setDate(currentExp.getDate() + days);

    await updateDoc(doc(db, "tenants", tenantId), {
        expiresAt: currentExp.toISOString(),
        isActive: true,
        isLifetime: false,
        preExpiryNotifiedForCycle: false,
        expiryNotifiedForCycle: false,
        renewedAt: new Date().toISOString()
    });
    alert(`تم تمديد وتنشيط اشتراك المنشأة بـ ${days} يوماً بنجاح!`);
    if (typeof window.loadTenants === 'function') window.loadTenants();
};

window.deleteTenant = async function(tenantId, businessName) {
    if (!confirm(`هل أنت متأكد من حذف المنشأة "${businessName}"؟`)) return;
    await deleteDoc(doc(db, "tenants", tenantId));
    if (typeof window.loadTenants === 'function') window.loadTenants();
};

// ==========================================
// 3. إدارة المستخدمين والصلاحيات المتعددة
// ==========================================
window.assignExtraRoleToUser = async function(e) {
    e.preventDefault();
    const emailInput = document.getElementById('target-user-email');
    const facilitySelect = document.getElementById('assign-facility-id');
    const roleSelect = document.getElementById('assign-role-type');

    if (!emailInput || !facilitySelect || !roleSelect) return;

    const email = emailInput.value.trim().toLowerCase();
    const facilityId = facilitySelect.value;
    const role = roleSelect.value;

    if (!facilityId) return alert("الرجاء اختيار المنشأة أولاً.");

    try {
        const usersSnap = await getDocs(collection(db, "users"));
        let targetUid = null;
        let userData = null;

        usersSnap.forEach(d => {
            if ((d.data().email || '').toLowerCase() === email) {
                targetUid = d.id;
                userData = d.data();
            }
        });

        if (!targetUid) {
            alert("لم يتم العثور على مستخدم مسجل بهذا البريد الإلكتروني في النظام.");
            return;
        }

        let permissions = Array.isArray(userData.permissions) ? [...userData.permissions] : [];

        if (permissions.length === 0 && userData.role) {
            permissions.push({
                facilityId: userData.tenantId || userData.registeredTenant || '1001',
                facilityName: userData.facilityName || 'المنشأة الأساسية',
                role: userData.role
            });
        }

        const exists = permissions.some(p => p.facilityId === facilityId && p.role === role);
        if (exists) {
            alert("هذا المستخدم يمتلك هذه الصلاحية بالفعل في هذه المنشأة.");
            return;
        }

        const matchedTenant = allTenantsData.find(t => String(t.id) === String(facilityId));
        const facilityName = matchedTenant ? (matchedTenant.businessName || matchedTenant.name) : facilityId;

        permissions.push({
            facilityId: facilityId,
            facilityName: facilityName,
            role: role
        });

        await updateDoc(doc(db, "users", targetUid), {
            permissions: permissions
        });

        alert(`تم بنجاح منح صلاحية (${getArabicRoleName(role)}) للمستخدم (${userData.name || email}) في منشأة (${facilityName})!`);
        emailInput.value = '';
        if (typeof window.loadUsers === 'function') window.loadUsers();

    } catch (err) {
        console.error("خطأ في منح الصلاحية:", err);
        alert("حدث خطأ أثناء تحديث صلاحيات المستخدم: " + err.message);
    }
};

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
        const hasRoleInPerms = Array.isArray(u.permissions) && u.permissions.some(p => p.role === roleFilter || (roleFilter === 'tenant_admin' && p.role === 'manager'));
        const matchRole = roleFilter === 'all' || u.role === roleFilter || hasRoleInPerms;
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
            <th class="p-3">الاسم</th><th class="p-3">الهواتف والبريد</th><th class="p-3">النوع والدولة والمدينة</th><th class="p-3">الصلاحيات والمنشآت</th><th class="p-3">المناسبات والاهتمامات</th><th class="p-3">الإجراءات والبيانات</th>
        </tr></thead><tbody class="divide-y divide-gray-100">`;
    
    users.forEach((u) => {
        let permsHtml = '';
        if (Array.isArray(u.permissions) && u.permissions.length > 0) {
            permsHtml = u.permissions.map(p => 
                `<span class="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[11px] font-semibold mb-1 ml-1">${getArabicRoleName(p.role)} (${p.facilityId})</span>`
            ).join('');
        } else {
            permsHtml = `<span class="font-mono text-xs">${u.role} (${u.tenantId || u.registeredTenant || 'عام'})</span>`;
        }

        html += `<tr class="hover:bg-gray-50">
            <td class="p-3 font-semibold">${u.name || '--'}</td>
            <td class="p-3 text-xs" dir="ltr">${u.phone || '--'}<br><span class="text-gray-500">${u.email || ''}</span></td>
            <td class="p-3 text-xs">${u.gender || '--'} | ${u.country || '--'} - ${u.city || '--'}<br><span class="text-gray-400">${u.address || ''}</span></td>
            <td class="p-3 text-xs">${permsHtml}</td>
            <td class="p-3 text-xs">
                <div><i class="fa-solid fa-cake-candles text-pink-500 ml-1"></i>${u.birthdate || 'غير مسجل'}</div>
                <div><i class="fa-solid fa-ring text-amber-500 ml-1"></i>${u.anniversary || 'غير مسجل'}</div>
                <div><i class="fa-solid fa-heart text-indigo-500 ml-1"></i>${u.hobbies || '--'}</div>
            </td>
            <td class="p-3 flex flex-col gap-1.5">
                <button onclick="viewCustomerFullProfile('${u.id}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-1.5">
                    <i class="fa-regular fa-eye"></i>
                    <span>عرض البيانات الشخصية</span>
                </button>
                <button onclick="adminUpdateUserPassword('${u.email}')" class="px-3 py-1 rounded text-xs bg-amber-100 text-amber-800 font-semibold hover:bg-amber-200 cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-1.5">
                    <i class="fa-solid fa-key"></i>
                    <span>إعادة تعيين الباسورد</span>
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
        
        const initialPermissions = [{
            facilityId: tenantId,
            facilityName: selectEl.options[selectEl.selectedIndex].text.split('(')[0].trim(),
            role: role
        }];

        await setDoc(doc(db, "users", userCred.user.uid), {
            name, phone, secondaryPhone, email, role, tenantId, 
            permissions: initialPermissions,
            isBlocked: false, createdAt: new Date().toISOString()
        });

        if (role === 'tenant_admin' || role === 'manager') {
            await updateDoc(doc(db, "tenants", tenantId), {
                managerEmail: email.toLowerCase()
            }).catch(() => {});
        }

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
        let permsList = '';
        if (Array.isArray(data.permissions) && data.permissions.length > 0) {
            permsList = data.permissions.map(p => `${getArabicRoleName(p.role)} - ${p.facilityName || p.facilityId}`).join(' | ');
        } else {
            permsList = data.role || 'عميل';
        }

        contentEl.innerHTML = `
            <div class="space-y-3 bg-gray-50 p-4 rounded-xl border">
                <p><strong>الاسم الكامل:</strong> <span class="text-indigo-900 font-bold">${data.name || '--'}</span></p>
                <p><strong>رقم الهاتف الأساسي:</strong> <span class="font-mono" dir="ltr">${data.phone || '--'}</span></p>
                <p><strong>رقم الهاتف الإضافي:</strong> <span class="font-mono" dir="ltr">${data.secondaryPhone || '--'}</span></p>
                <p><strong>البريد الإلكتروني:</strong> <span class="font-mono" dir="ltr">${data.email || '--'}</span></p>
                <p><strong>الصلاحيات الممنوحة:</strong> <span class="font-semibold text-indigo-700">${permsList}</span></p>
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
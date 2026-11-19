// مصفوفة السكيمات العشرة للمنشآت مع التدرجات اللونية القوية
export const TENANT_THEMES = {
    indigo:  { name: "الأزرق الملكي (Indigo Royal)", primary: '#4338ca', hover: '#312e81', light: '#eef2ff', text: '#312e81', border: '#c7d2fe', gradient: 'linear-gradient(135deg, #4338ca 0%, #1e1b4b 100%)', cardGradient: 'from-indigo-700 via-purple-800 to-slate-900 border-indigo-400/30' },
    rose:    { name: "الوردي الفاخر - دودي روز", primary: '#be185d', hover: '#831843', light: '#fdf2f8', text: '#831843', border: '#fbcfe8', gradient: 'linear-gradient(135deg, #db2777 0%, #831843 100%)', cardGradient: 'from-rose-700 via-pink-800 to-slate-900 border-rose-400/30' },
    emerald: { name: "الأخضر الزمردي (Emerald Spa)", primary: '#047857', hover: '#064e3b', light: '#ecfdf5', text: '#064e3b', border: '#a7f3d0', gradient: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)', cardGradient: 'from-emerald-700 via-teal-800 to-slate-900 border-emerald-400/30' },
    purple:  { name: "البنفسجي المخملي (Velvet Purple)", primary: '#7e22ce', hover: '#581c87', light: '#faf5ff', text: '#581c87', border: '#e9d5ff', gradient: 'linear-gradient(135deg, #9333ea 0%, #581c87 100%)', cardGradient: 'from-purple-700 via-fuchsia-800 to-slate-900 border-purple-400/30' },
    amber:   { name: "الذهبي الدافئ (Luxury Gold)", primary: '#b45309', hover: '#78350f', light: '#fffbeb', text: '#78350f', border: '#fde68a', gradient: 'linear-gradient(135deg, #d97706 0%, #78350f 100%)', cardGradient: 'from-amber-700 via-orange-800 to-slate-900 border-amber-400/30' },
    teal:    { name: "الفيروزي العصري (Modern Teal)", primary: '#0f766e', hover: '#134e4a', light: '#f0fdfa', text: '#134e4a', border: '#99f6e4', gradient: 'linear-gradient(135deg, #0d9488 0%, #134e4a 100%)', cardGradient: 'from-teal-700 via-cyan-800 to-slate-900 border-teal-400/30' },
    crimson: { name: "الأحمر القرمزي (Crimson Beauty)", primary: '#b91c1c', hover: '#7f1d1d', light: '#fef2f2', text: '#7f1d1d', border: '#fecaca', gradient: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)', cardGradient: 'from-red-700 via-rose-800 to-slate-900 border-red-400/30' },
    slate:   { name: "الرمادي الداكن الفخم (Executive)", primary: '#1e293b', hover: '#0f172a', light: '#f8fafc', text: '#0f172a', border: '#cbd5e1', gradient: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)', cardGradient: 'from-slate-800 via-zinc-900 to-stone-900 border-slate-600/30' },
    cyan:    { name: "الأزرق السماوي (Ocean Cyan)", primary: '#0369a1', hover: '#0c4a6e', light: '#f0f9ff', text: '#0c4a6e', border: '#bae6fd', gradient: 'linear-gradient(135deg, #0284c7 0%, #0c4a6e 100%)', cardGradient: 'from-sky-700 via-blue-800 to-slate-900 border-sky-400/30' },
    brown:   { name: "البني الكلاسيكي (Coffee & Chocolate)", primary: '#78350f', hover: '#451a03', light: '#fefce8', text: '#451a03', border: '#fef08a', gradient: 'linear-gradient(135deg, #92400e 0%, #451a03 100%)', cardGradient: 'from-stone-800 via-amber-950 to-neutral-900 border-amber-700/30' }
};

// فتح وإغلاق قائمة تبديل الصلاحيات المرتبطة بأيقونة الثلاث شرطات
window.toggleRoleSwitcherMenu = function() {
    const dropdown = document.getElementById('role-switcher-dropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('hidden');
};

document.addEventListener('click', function(event) {
    const container = document.getElementById('role-menu-container');
    const dropdown = document.getElementById('role-switcher-dropdown');
    if (!container || !dropdown || dropdown.classList.contains('hidden')) return;
    if (!container.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
});

// تطبيق السكيم والتدرج اللوني الواضح على واجهة التطبيق بالكامل
window.applyTenantTheme = function(themeKey = 'indigo') {
    const theme = TENANT_THEMES[themeKey] || TENANT_THEMES.indigo;
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', theme.primary);
    root.style.setProperty('--theme-primary-hover', theme.hover);
    root.style.setProperty('--theme-light', theme.light);
    root.style.setProperty('--theme-text', theme.text);
    root.style.setProperty('--theme-border', theme.border);
    
    if (theme.gradient) {
        root.style.setProperty('--theme-gradient', theme.gradient);
    }
};

// معاينة فورية للون عند تغييره من القائمة قبل الحفظ
window.previewTenantTheme = function(themeKey) {
    window.applyTenantTheme(themeKey);
};

// دالة نسخ النصوص للحافظة
window.copyTextValue = function(elementId) {
    const input = document.getElementById(elementId);
    if (!input) return;
    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value);
    alert('تم نسخ الرابط بنجاح إلى الحافظة!');
};

// مشاركة عبر واتساب
window.shareViaWhatsApp = function(linkInputId, customMessage = '') {
    const input = document.getElementById(linkInputId);
    if (!input) return;
    const text = encodeURIComponent(`${customMessage}\n${input.value}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
};

// تحميل QR كصورة PNG
window.downloadQrPng = function(qrContainerId, filename = 'qrcode.png') {
    const container = document.getElementById(qrContainerId);
    if (!container) return;
    const img = container.querySelector('img');
    const canvas = container.querySelector('canvas');
    
    let imageUrl = '';
    if (img && img.src) {
        imageUrl = img.src;
    } else if (canvas) {
        imageUrl = canvas.toDataURL("image/png");
    }

    if (!imageUrl) {
        alert('تعذر العثور على صورة الباركود للتحميل.');
        return;
    }

    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

// نظام التبويبات لمدير المنشأة
window.switchAdminTab = function(tabName, ev) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'theme-bg-primary', 'text-white', 'font-bold');
        btn.classList.add('bg-gray-100', 'text-gray-700', 'font-semibold');
    });

    const targetTab = document.getElementById(`admin-tab-${tabName}`);
    if (targetTab) targetTab.classList.remove('hidden');

    if (ev && ev.currentTarget) {
        ev.currentTarget.classList.remove('bg-gray-100', 'text-gray-700', 'font-semibold');
        ev.currentTarget.classList.add('bg-indigo-600', 'theme-bg-primary', 'text-white', 'font-bold');
    }
};

// نظام التبويبات للعميل
window.switchCustomerTab = function(tabName, ev) {
    document.querySelectorAll('.cust-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.cust-tab-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'theme-bg-primary', 'text-white', 'font-bold');
        btn.classList.add('bg-gray-100', 'text-gray-700', 'font-semibold');
    });

    const targetTab = document.getElementById(`cust-tab-${tabName}`);
    if (targetTab) targetTab.classList.remove('hidden');

    if (ev && ev.currentTarget) {
        ev.currentTarget.classList.remove('bg-gray-100', 'text-gray-700', 'font-semibold');
        ev.currentTarget.classList.add('bg-indigo-600', 'theme-bg-primary', 'text-white', 'font-bold');
    }
};

// نظام التبويبات لبوابة المنشأة للعميل
window.switchPortalTab = function(tabName, ev) {
    document.querySelectorAll('.portal-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.portal-tab-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'theme-bg-primary', 'text-white', 'font-bold');
        btn.classList.add('bg-gray-100', 'text-gray-700', 'font-semibold');
    });

    const targetTab = document.getElementById(`portal-tab-${tabName}`);
    if (targetTab) targetTab.classList.remove('hidden');

    if (ev && ev.currentTarget) {
        ev.currentTarget.classList.remove('bg-gray-100', 'text-gray-700', 'font-semibold');
        ev.currentTarget.classList.add('bg-indigo-600', 'theme-bg-primary', 'text-white', 'font-bold');
    }
};
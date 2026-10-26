import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookmarkIcon,
  CalculatorIcon,
  ChartIcon,
  CloseIcon,
  FlaskIcon,
  HomeIcon,
  LeafIcon,
  LivestockIcon,
  MenuIcon,
  SettingsIcon,
} from './icons';
import { DemoLabel, SafetyNotice } from './SafetyNotice';
import { ENGINE_VERSION } from '../domain/optimization/formulate';

const NAV_ITEMS = [
  { to: '/', label: 'لوحة المعلومات', Icon: HomeIcon, end: true },
  { to: '/formulate', label: 'صياغة عليقة جديدة', Icon: FlaskIcon, end: false },
  { to: '/ingredients', label: 'قاعدة الأعلاف', Icon: LeafIcon, end: false },
  { to: '/livestock', label: 'مواشيّ', Icon: LivestockIcon, end: false },
  { to: '/compare', label: 'المقارنة', Icon: ChartIcon, end: false },
  { to: '/calculator', label: 'حاسبة التكلفة', Icon: CalculatorIcon, end: false },
  { to: '/saved', label: 'العليق المحفوظة', Icon: BookmarkIcon, end: false },
  { to: '/settings', label: 'الإعدادات والنسخ الاحتياطي', Icon: SettingsIcon, end: false },
] as const;

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-sm">
        <LeafIcon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className={`font-extrabold text-brand-900 ${compact ? 'text-base' : 'text-xl'}`}>علفتي الذكية</p>
        <p className="text-[11px] font-semibold text-slate-500">تغذية متوازنة، تكلفة أقل، إنتاج أفضل</p>
      </div>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="التنقل الرئيسي" className="space-y-1">
      {NAV_ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
              isActive ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-700 hover:bg-sand-100'
            }`
          }
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-sand-50">
      <a href="#main-content" className="skip-link">
        تجاوز إلى المحتوى
      </a>

      <div className="mx-auto flex w-full max-w-[1500px]">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-y-auto border-l border-sand-200 bg-white px-4 py-5 lg:flex">
          <Brand />
          <div className="mt-6 flex-1">
            <NavList />
          </div>
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
            <p className="text-[11px] font-extrabold text-violet-950">نسخة عرض توضيحية</p>
            <p className="mt-1 text-[11px] leading-5 text-violet-900">
              لا توجد بعد معاملات متطلبات غذائية موثّقة من نسخة أصلية. أي حل ناتج هو حل رياضي
              وليس إثباتاً لتوازن غذائي.
            </p>
          </div>
          <p className="mt-3 text-[10px] leading-4 text-slate-400">
            محرك التحسين {ENGINE_VERSION} · بيانات محلية على جهازك
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-sand-200 bg-white/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="lg:hidden">
                <Brand compact />
              </div>
              <div className="hidden min-w-0 lg:block">
                <p className="text-sm font-bold text-slate-700">مساحة عمل مربّي الأغنام والماعز</p>
                <p className="text-xs text-slate-500">الأسعار بالدينار الجزائري (دج) — كل الكميات محددة الأساس</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:block">
                  <DemoLabel />
                </div>
                <button
                  type="button"
                  className="btn-secondary min-h-10 px-3 lg:hidden"
                  onClick={() => setMenuOpen((value) => !value)}
                  aria-expanded={menuOpen}
                  aria-controls="mobile-nav"
                  aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
                >
                  {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="border-t border-violet-100 bg-violet-50 px-4 py-1.5 sm:hidden">
              <DemoLabel />
            </div>
            {menuOpen ? (
              <div id="mobile-nav" className="border-t border-sand-200 bg-white px-3 py-3 lg:hidden">
                <NavList onNavigate={() => setMenuOpen(false)} />
              </div>
            ) : null}
          </header>

          <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>

          <footer className="space-y-4 border-t border-sand-200 bg-white px-4 py-6 sm:px-6 lg:px-8">
            <SafetyNotice />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <p>علفتي الذكية — نسخة عرض توضيحية. الأسعار والبيانات التجريبية غير معتمدة.</p>
              <p>جميع البيانات تُحفظ محلياً في هذا المتصفح. لا يوجد تسجيل دخول ولا خادم.</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

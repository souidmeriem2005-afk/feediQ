import { useEffect } from 'react';
import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAppStore } from './state/store';
import DashboardPage from './pages/DashboardPage';
import FormulatePage from './pages/FormulatePage';
import IngredientsPage from './pages/IngredientsPage';
import LivestockPage from './pages/LivestockPage';
import ComparePage from './pages/ComparePage';
import CalculatorPage from './pages/CalculatorPage';
import SavedPage from './pages/SavedPage';
import SettingsPage from './pages/SettingsPage';
import { LeafIcon, WarningIcon } from './components/icons';
import { SafetyNotice } from './components/SafetyNotice';

function LoadingScreen({ errorAr, onRetry }: { errorAr: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 p-6">
      <div className="w-full max-w-lg space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-700 text-white">
          <LeafIcon className="h-9 w-9" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900">علفتي الذكية</h1>
          <p className="mt-1 text-sm text-slate-500">تغذية متوازنة، تكلفة أقل، إنتاج أفضل</p>
        </div>
        {errorAr ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-right text-sm leading-6 text-red-900">
              <WarningIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">تعذّر فتح قاعدة البيانات المحلية</p>
                <p>{errorAr}</p>
                <p className="mt-1 text-xs">
                  قد يكون التخزين المحلي معطلاً في هذا المتصفح (وضع التصفح الخاص مثلاً).
                </p>
              </div>
            </div>
            <button type="button" className="btn-primary" onClick={onRetry}>
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-sand-200">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-600" />
            </div>
            <p className="text-sm text-slate-500">جارٍ تحضير قاعدة البيانات المحلية…</p>
          </div>
        )}
        <SafetyNotice compact />
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <h1 className="text-2xl font-extrabold text-slate-900">الصفحة غير موجودة</h1>
      <p className="mt-2 text-sm text-slate-500">الرابط الذي طلبته غير معروف داخل التطبيق.</p>
      <Link to="/" className="btn-primary mt-5">
        العودة إلى لوحة المعلومات
      </Link>
    </div>
  );
}

export default function App() {
  const loadState = useAppStore((state) => state.loadState);
  const errorAr = useAppStore((state) => state.errorAr);
  const init = useAppStore((state) => state.init);
  const refresh = useAppStore((state) => state.refresh);

  useEffect(() => {
    void init();
  }, [init]);

  if (loadState !== 'ready') {
    return (
      <LoadingScreen
        errorAr={errorAr}
        onRetry={() => {
          void refresh().then(() => {
            if (useAppStore.getState().loadState !== 'ready') void init();
          });
        }}
      />
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="formulate" element={<FormulatePage />} />
          <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="livestock" element={<LivestockPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="calculator" element={<CalculatorPage />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="saved/:formulationId" element={<SavedPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

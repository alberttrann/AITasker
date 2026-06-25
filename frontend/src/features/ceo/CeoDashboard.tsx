import { Routes, Route } from 'react-router-dom';
import TopNav from "@/components/layout/TopNav";
import ProfilePage from "@/components/pages/UserProfilePage";
import ProfileSettingPage from "@/components/pages/ProfileSettingPage";
import WalletPage from "@/components/wallet/WalletPage";

function CeoOverview() {
  return (
    <div className="p-md sm:p-lg bg-background min-h-screen">
      <div className="bg-surface rounded-xl border border-outline-variant p-md shadow-sm">
        <h1 className="font-headline-md text-headline-md text-primary mb-xs">
          CEO Dashboard
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          You are currently viewing the Client/CEO overview page.
        </p>
      </div>
    </div>
  );
}

export default function CeoDashboard() {
  return (
    <>
    <TopNav />
    <div className="bg-background min-h-screen">
      <Routes>
        <Route index element={<CeoOverview />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="account-setting" element={<ProfileSettingPage />} />
        <Route path="wallet" element={<WalletPage />} />
      </Routes>
    </div>
    </>
  );
}
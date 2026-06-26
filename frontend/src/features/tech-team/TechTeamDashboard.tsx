import TopNav from '../../components/layout/TopNav'; // Điều chỉnh lại đường dẫn import TopNav cho đúng với cấu trúc thư mục của bạn
import Stage4Form from './stage4/Stage4Form';

export default function TechTeamDashboard() {
  const handoffSessionId = sessionStorage.getItem('handoff_sessionId');

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-['DM_Sans']">
      {/* 1. Hiển thị thanh điều hướng ở trên cùng */}
      <TopNav />

      {/* 2. Phần nội dung chính hiển thị bên dưới */}
      <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 py-8">
        {handoffSessionId ? (
          // Hiển thị form Stage 4 nếu có handoff_sessionId trong sessionStorage
          <Stage4Form />
        ) : (
          // Hiển thị giao diện Dashboard mặc định của Tech Team khi không có form cần điền
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-[0px_2px_6px_rgba(15,23,42,0.03)]">
              <h1 className="text-2xl font-bold text-slate-900 font-['Plus_Jakarta_Sans']">
                Tech Team Dashboard
              </h1>
              <p className="text-slate-600 mt-1 text-sm">
                You are currently viewing the Tech Team overview page.
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-16 text-center bg-white shadow-[0px_1px_3px_rgba(15,23,42,0.02)]">
              <h3 className="text-lg font-bold text-slate-900 mb-1 font-['Plus_Jakarta_Sans']">
                Tech Team Dashboard
              </h3>
              <p className="text-slate-500 text-sm">
                This section is currently in development.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
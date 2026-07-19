"use client";

import { useContext } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useauth";
import { AuthModalContext } from "./layout";

export default function UnifiedDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  
  const { openModal } = useContext(AuthModalContext);

  const handleRestrictedAction = (route: string) => {
    if (!loading && user) {
      router.push(route);
    } else {
      // Just open the modal. When they log in, the page refreshes.
      // They will have to click the button again manually.
      openModal();
    }
  };

  return (
    <div className="max-w-6xl w-full mx-auto p-6 md:p-10 flex flex-col gap-10">
      
      {/* APP INFO SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Welcome to Exam Assistant</h2>
        <p className="text-lg text-slate-600 mb-8 max-w-3xl leading-relaxed">
          Your personal workspace for AI-powered exam generation. Upload any course material, syllabus, or existing question paper in PDF format. Our AI automatically extracts existing questions or generates brand new ones based on your custom difficulty settings.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
            <h3 className="font-bold text-blue-900 mb-2">1. Upload Content</h3>
            <p className="text-sm text-slate-600">Provide a PDF of your textbook or a past question paper.</p>
          </div>
          <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
            <h3 className="font-bold text-blue-900 mb-2">2. AI Extraction</h3>
            <p className="text-sm text-slate-600">We securely process the text and generate a structured exam.</p>
          </div>
          <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
            <h3 className="font-bold text-blue-900 mb-2">3. Take Exam</h3>
            <p className="text-sm text-slate-600">Run timed tests and review detailed scoring instantly.</p>
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button 
          onClick={() => handleRestrictedAction("/exams/create")}
          className="group flex flex-col items-center justify-center p-12 bg-white rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-all text-center cursor-pointer shadow-sm"
        >
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">+</div>
          <h3 className="text-2xl font-bold text-slate-800">Create Exam</h3>
          <p className="text-slate-500 mt-2">Generate a new test from your documents.</p>
        </button>

        <button 
          onClick={() => handleRestrictedAction("/history")}
          className="group flex flex-col items-center justify-center p-12 bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center cursor-pointer shadow-sm"
        >
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">📊</div>
          <h3 className="text-2xl font-bold text-slate-800">View History</h3>
          <p className="text-slate-500 mt-2">Review your past scores and performance.</p>
        </button>
      </div>

    </div>
  );
}
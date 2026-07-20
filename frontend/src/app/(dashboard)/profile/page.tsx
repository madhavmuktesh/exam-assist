"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  type ProfileResponse,
} from "@/features/profile/api";
import { useAuth } from "@/hooks/useauth";

function getApiErrorMessage(error: any, fallback = "Failed to load profile.") {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg).filter(Boolean).join(", ");
  }

  if (detail && typeof detail === "object" && "msg" in detail) {
    return String(detail.msg);
  }

  return fallback;
}

export default function ProfilePage() {
  const { refreshUser, logout } = useAuth();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone_number: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getProfile();
        setProfile(data);
        setProfileForm({
          full_name: data.full_name ?? "",
          phone_number: data.phone_number ?? "",
        });
      } catch (err: any) {
        setPageError(getApiErrorMessage(err, "Failed to load profile."));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setProfileMessage(null);
    setProfileError(null);

    try {
      setSavingProfile(true);

      const updated = await updateProfile({
        full_name: profileForm.full_name.trim(),
        phone_number: profileForm.phone_number.trim(),
      });

      setProfile(updated);
      setProfileForm({
        full_name: updated.full_name ?? "",
        phone_number: updated.phone_number ?? "",
      });

      await refreshUser();

      setProfileMessage("Profile updated successfully.");
    } catch (err: any) {
      setProfileError(getApiErrorMessage(err, "Failed to update profile."));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (!passwordForm.current_password || !passwordForm.new_password) {
      setPasswordError("Please fill in all password fields.");
      return;
    }

    if (passwordForm.new_password.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    try {
      setSavingPassword(true);

      const res = await changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });

      setPasswordMessage(res.message || "Password updated successfully.");
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err: any) {
      setPasswordError(getApiErrorMessage(err, "Failed to change password."));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteMessage(null);
    setDeleteError(null);

    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This will permanently remove your profile, exams, questions, responses, and results."
    );

    if (!confirmed) return;

    try {
      setDeletingAccount(true);
      const res = await deleteAccount();
      setDeleteMessage(res.message || "Account deleted successfully.");
      logout();
    } catch (err: any) {
      setDeleteError(getApiErrorMessage(err, "Failed to delete account."));
      setDeletingAccount(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200"></div>
            <div className="h-4 w-64 animate-pulse rounded-lg bg-slate-100"></div>
          </div>
          <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-slate-100"></div>
                <div className="h-5 w-32 animate-pulse rounded bg-slate-200"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-[350px] animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm"></div>
          <div className="h-[350px] animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm"></div>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="border border-red-200 rounded-xl p-6 bg-red-50 shadow-sm">
          <p className="text-red-600 font-medium">{pageError}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm">
          <p className="text-slate-600">No profile data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-800">Profile Settings</h1>
          <p className="text-slate-500 text-sm">
            Manage your personal details, password, and account settings.
          </p>
        </div>

        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-500 font-medium">Email</p>
            <p className="text-sm md:text-base font-semibold text-slate-800 break-all">
              {profile.email}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500 font-medium">Full Name</p>
            <p className="text-sm md:text-base font-semibold text-slate-800">
              {profile.full_name || "Not set"}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500 font-medium">Phone</p>
            <p className="text-sm md:text-base font-semibold text-slate-800">
              {profile.phone_number || "Not set"}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500 font-medium">Joined</p>
            <p className="text-sm md:text-base font-semibold text-slate-800">
              {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-800">Update Profile</h2>
            <p className="text-sm text-slate-500">
              Update your basic account information.
            </p>
          </div>

          {profileMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {profileMessage}
            </div>
          )}

          {profileError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {profileError}
            </div>
          )}

          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-500 outline-none cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                disabled={savingProfile}
                value={profileForm.full_name}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    full_name: e.target.value,
                  }))
                }
                placeholder="Enter your full name"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                disabled={savingProfile}
                value={profileForm.phone_number}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    phone_number: e.target.value,
                  }))
                }
                placeholder="Enter your phone number"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2"
            >
              {savingProfile && (
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {savingProfile ? "Saving..." : "Update profile"}
            </button>
          </form>
        </div>

        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-800">Change Password</h2>
            <p className="text-sm text-slate-500">
              Choose a new password to keep your account secure.
            </p>
          </div>

          {passwordMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {passwordMessage}
            </div>
          )}

          {passwordError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {passwordError}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  disabled={savingPassword}
                  value={passwordForm.current_password}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      current_password: e.target.value,
                    }))
                  }
                  placeholder="Enter current password"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-12 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-700 focus:outline-none"
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  disabled={savingPassword}
                  value={passwordForm.new_password}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      new_password: e.target.value,
                    }))
                  }
                  placeholder="Enter new password"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-12 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-700 focus:outline-none"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  disabled={savingPassword}
                  value={passwordForm.confirm_password}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      confirm_password: e.target.value,
                    }))
                  }
                  placeholder="Confirm new password"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 pr-12 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-700 focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2"
            >
              {savingPassword && (
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {savingPassword ? "Updating..." : "Change password"}
            </button>
          </form>
        </div>
      </div>

      <div className="border border-rose-200 rounded-xl p-6 bg-rose-50 shadow-sm space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-rose-700">Delete Account</h2>
          <p className="text-sm text-rose-600">
            This action is permanent. Your account and all associated exam data will
            be removed.
          </p>
        </div>

        {deleteMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {deleteMessage}
          </div>
        )}

        {deleteError && (
          <div className="rounded-lg border border-rose-300 bg-white px-4 py-3 text-sm text-rose-700">
            {deleteError}
          </div>
        )}

        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-800 focus-visible:ring-offset-2"
        >
          {deletingAccount && (
            <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {deletingAccount ? "Deleting..." : "Delete account"}
        </button>
      </div>
    </div>
  );
}
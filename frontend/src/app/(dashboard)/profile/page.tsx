"use client";

import { useEffect, useState } from "react";
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  type ProfileResponse,
} from "@/features/profile/api";
import { logout } from "@/features/auth/api";

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
      "Are you sure you want to delete your account? This will permanently remove your profile, exams, questions, responses, and results.",
    );

    if (!confirmed) return;

    try {
      setDeletingAccount(true);
      const res = await deleteAccount();
      setDeleteMessage(res.message || "Account deleted successfully.");
      logout();
    } catch (err: any) {
      setDeleteError(getApiErrorMessage(err, "Failed to delete account."));
    } finally {
      setDeletingAccount(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm">
          <p className="text-slate-600">Loading profile...</p>
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
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {profileMessage}
            </div>
          )}

          {profileError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={profileForm.full_name}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    full_name: e.target.value,
                  }))
                }
                placeholder="Enter your full name"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                value={profileForm.phone_number}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    phone_number: e.target.value,
                  }))
                }
                placeholder="Enter your phone number"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
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
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {passwordMessage}
            </div>
          )}

          {passwordError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {passwordError}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={passwordForm.current_password}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    current_password: e.target.value,
                  }))
                }
                placeholder="Enter current password"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    new_password: e.target.value,
                  }))
                }
                placeholder="Enter new password"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirm_password: e.target.value,
                  }))
                }
                placeholder="Confirm new password"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingPassword ? "Updating..." : "Change password"}
            </button>
          </form>
        </div>
      </div>

      <div className="border border-red-200 rounded-xl p-6 bg-red-50 shadow-sm space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-red-700">Delete Account</h2>
          <p className="text-sm text-red-600">
            This action is permanent. Your account and all associated exam data will
            be removed.
          </p>
        </div>

        {deleteMessage && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {deleteMessage}
          </div>
        )}

        {deleteError && (
          <div className="rounded-lg border border-red-300 bg-white px-4 py-3 text-sm text-red-700">
            {deleteError}
          </div>
        )}

        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {deletingAccount ? "Deleting..." : "Delete account"}
        </button>
      </div>
    </div>
  );
}
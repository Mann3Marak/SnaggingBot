"use client";
import DeleteInspectionCard from "@/components/admin/DeleteInspectionCard";
import AddUserCard from "@/components/admin/AddUserCard";
import ReprintReportCard from "@/components/admin/ReprintReportCard";
import EditReportCard from "@/components/admin/EditReportCard";
import AddProjectCard from "@/components/dashboard/AddProjectCard";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function AdminQuickActions() {
  const { user, loading } = useAuthUser();

  if (loading) return null;

  // Extra client-side guard
  if (!user || user.role !== "admin") return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-nhome-foreground">Admin Actions</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <AddProjectCard />
        </div>
        <div>
          <DeleteInspectionCard />
        </div>
        <div>
          <AddUserCard />
        </div>
        <div>
          <ReprintReportCard />
        </div>
        <div>
          <EditReportCard />
        </div>
      </div>
    </section>
  );
}
